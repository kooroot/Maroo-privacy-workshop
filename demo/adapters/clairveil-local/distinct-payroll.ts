import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess, SpawnSyncOptionsWithStringEncoding } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { CLAIRVEIL_PAYROLL_ALLOCATIONS, LOCAL_PAYROLL_SCHEMA, validateLocalPayrollEvidence } from '../../shared/local-evidence.ts';
import type { EmployeeId, LocalEmployeeScan, LocalPayrollEvidence, LocalPublicObservation } from '../../shared/types.ts';

const TX_WAIT_ATTEMPTS = 90;
const TX_WAIT_MS = 500;
const GAS_PRICES = '8500000000uclair';
const BATCH_GAS = '80000000';

type RunOptions = Omit<SpawnSyncOptionsWithStringEncoding, 'encoding'> & { sensitive?: boolean };
interface NodeArgs { home: string; node: string; chainId: string }
interface NoteRecord { tx_hash?: string; amount?: string | number; status?: string }
interface ScanResult { notes?: NoteRecord[]; [key: string]: unknown }
interface StatusResult { sync_info?: { latest_block_height?: string | number } }
interface TransactionAttribute { key?: string; value?: string }
interface TransactionEvent { type?: string; attributes?: TransactionAttribute[] }
interface TransactionResult {
  txhash?: string;
  code?: string | number;
  height?: string | number;
  input_count?: string | number;
  output_count?: string | number;
  payload_hash?: string;
  logs?: Array<{ events?: TransactionEvent[] }>;
  events?: TransactionEvent[];
}
interface AuditorResult { public_key_hex?: string }
interface ShieldedAddressResult { address?: string }
interface EmployeeRuntime {
  id: EmployeeId;
  profile: string;
  amount: number;
  shieldedAddress: string;
  before: ScanResult;
}

function run(command: string, args: string[], options: RunOptions = {}): string {
  const { sensitive = false, ...spawnOptions } = options;
  const child = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 20 * 60 * 1000,
    ...spawnOptions
  });
  if (child.error) throw child.error;
  if (child.status !== 0) {
    const detail = sensitive
      ? '<sensitive command output suppressed>'
      : [child.stdout, child.stderr].filter(Boolean).join('\n').slice(-12_000);
    throw new Error(`${command} exited ${child.status}\n${detail}`);
  }
  return child.stdout.trim();
}

function runJson<T = Record<string, unknown>>(command: string, args: string[], options: RunOptions = {}): T {
  const stdout = run(command, args, options);
  try {
    return JSON.parse(stdout) as T;
  } catch {
    throw new Error(`${command} did not return JSON\n${stdout.slice(-4000)}`);
  }
}

function runExpectedFailure(command: string, args: string[], expected: RegExp, options: RunOptions = {}): string {
  const { sensitive = false, ...spawnOptions } = options;
  const child = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 20 * 60 * 1000,
    ...spawnOptions
  });
  if (child.error) throw child.error;
  const detail = [child.stdout, child.stderr].filter(Boolean).join('\n');
  if (child.status === 0) throw new Error(`${command} unexpectedly succeeded; expected ${expected.source}`);
  const match = detail.match(expected);
  if (!match) {
    const diagnostic = sensitive ? '<sensitive command output suppressed>' : detail.slice(-12_000);
    throw new Error(`${command} failed for an unexpected reason\n${diagnostic}`);
  }
  return match[0];
}

async function reservePorts(count: number): Promise<number[]> {
  const servers = [];
  try {
    for (let index = 0; index < count; index += 1) {
      const server = createServer();
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
      });
      servers.push(server);
    }
    return servers.map((server) => (server.address() as AddressInfo).port);
  } finally {
    await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  }
}

export function parseEnvironmentFile(contents: string): Record<string, string> {
  return Object.fromEntries(contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separator = line.indexOf('=');
      if (separator < 1) throw new Error(`invalid artifact environment line: ${line}`);
      return [line.slice(0, separator), line.slice(separator + 1)];
    }));
}

function commandArgs({ home, node, chainId }: NodeArgs): string[] {
  return ['--keyring-backend', 'test', '--home', home, '--node', node, '--chain-id', chainId];
}

async function patchNodeConfiguration(home: string, ports: number[]): Promise<void> {
  const [rpc, p2p, abci, grpc, api, pprof] = ports;
  const configPath = join(home, 'config', 'config.toml');
  const appPath = join(home, 'config', 'app.toml');
  const config = (await readFile(configPath, 'utf8'))
    .replace('proxy_app = "tcp://127.0.0.1:26658"', `proxy_app = "tcp://127.0.0.1:${abci}"`)
    .replace('laddr = "tcp://127.0.0.1:26657"', `laddr = "tcp://127.0.0.1:${rpc}"`)
    .replace('laddr = "tcp://0.0.0.0:26656"', `laddr = "tcp://127.0.0.1:${p2p}"`)
    .replace('pprof_laddr = "localhost:6060"', `pprof_laddr = "localhost:${pprof}"`);
  const app = (await readFile(appPath, 'utf8'))
    .replace('address = "tcp://localhost:1317"', `address = "tcp://127.0.0.1:${api}"`)
    .replace('address = "localhost:9090"', `address = "127.0.0.1:${grpc}"`);
  await Promise.all([writeFile(configPath, config), writeFile(appPath, app)]);
}

async function setAuditIdentity(home: string, disclosureKeyHex: string): Promise<void> {
  const genesisPath = join(home, 'config', 'genesis.json');
  const genesis = JSON.parse(await readFile(genesisPath, 'utf8')) as {
    app_state: { privacy: { audit_master_pubkey: string; audit_key_id: string; audit_key_epoch: string } };
  };
  genesis.app_state.privacy.audit_master_pubkey = Buffer.from(disclosureKeyHex, 'hex').toString('base64');
  genesis.app_state.privacy.audit_key_id = 'master';
  genesis.app_state.privacy.audit_key_epoch = '1';
  await writeFile(genesisPath, `${JSON.stringify(genesis, null, 2)}\n`);
}

async function waitForNode(binary: string, nodeArgs: NodeArgs, nodeProcess: ChildProcess, logPath: string, env: NodeJS.ProcessEnv): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (nodeProcess.exitCode !== null) {
      throw new Error(`Clairveil local node exited early\n${(await readFile(logPath, 'utf8')).slice(-8000)}`);
    }
    try {
      const status = runJson<StatusResult>(binary, ['status', '--node', nodeArgs.node], { env, timeout: 3000 });
      if (Number(status.sync_info?.latest_block_height) >= 1) return;
    } catch {
      // The RPC socket is expected to reject connections while the node starts.
    }
    await delay(TX_WAIT_MS);
  }
  throw new Error(`timed out waiting for Clairveil local node\n${(await readFile(logPath, 'utf8')).slice(-8000)}`);
}

async function waitForTransaction(binary: string, txHash: string, node: string, env: NodeJS.ProcessEnv): Promise<TransactionResult> {
  for (let attempt = 0; attempt < TX_WAIT_ATTEMPTS; attempt += 1) {
    try {
      return runJson<TransactionResult>(binary, ['query', 'tx', txHash, '--node', node, '--output', 'json'], { env, timeout: 5000 });
    } catch {
      await delay(TX_WAIT_MS);
    }
  }
  throw new Error(`timed out waiting for local transaction inclusion: ${txHash}`);
}

function noteCount(scan: ScanResult): number {
  return Array.isArray(scan.notes) ? scan.notes.length : 0;
}

function spendableNoteFingerprint(scan: ScanResult): string {
  return JSON.stringify((scan.notes ?? [])
    .filter((note) => note.status === 'spendable')
    .map((note) => ({ txHash: String(note.tx_hash ?? '').toLowerCase(), amount: String(note.amount ?? '') }))
    .sort((left, right) => `${left.txHash}:${left.amount}`.localeCompare(`${right.txHash}:${right.amount}`)));
}

function matchingNoteCount(scan: ScanResult, txHash: string, amount: number): number {
  return (scan.notes ?? []).filter((note) =>
    String(note.tx_hash ?? '').toLowerCase() === txHash.toLowerCase() &&
    String(note.amount) === String(amount) &&
    note.status === 'spendable').length;
}

export function publicBatchObservation(receipt: TransactionResult, txHash: string): LocalPublicObservation {
  const events = [...(receipt.events ?? []), ...(receipt.logs ?? []).flatMap((log) => log.events ?? [])];
  const event = events.find((candidate) => candidate.type === 'batch_transfer');
  if (!event) throw new Error(`public receipt ${txHash} is missing batch_transfer event`);
  const attributes = Object.fromEntries((event.attributes ?? []).map(({ key = '', value = '' }) => [key, value]));
  const publicText = JSON.stringify(event);
  const forbiddenKeys = ['amount', 'recipient', 'employee_id'];
  for (const key of forbiddenKeys) {
    if (Object.prototype.hasOwnProperty.call(attributes, key)) throw new Error(`public batch event unexpectedly exposes ${key}`);
  }
  for (const plaintext of ['EMP-A', 'EMP-B', 'EMP-C', '100uclair', '120uclair', '80uclair']) {
    if (publicText.includes(plaintext)) throw new Error(`public batch event unexpectedly exposes payroll plaintext ${plaintext}`);
  }
  const inputCount = Number(attributes.input_count);
  const outputCount = Number(attributes.output_count);
  if (inputCount !== 1 || outputCount !== 3) throw new Error(`public batch shape is ${inputCount} inputs and ${outputCount} outputs`);
  if (!attributes.commitment_root || !attributes.nullifier_root) throw new Error('public batch event is missing commitment/nullifier roots');
  return {
    txHash,
    height: String(receipt.height ?? ''),
    eventType: 'batch_transfer',
    inputCount,
    outputCount,
    attributeNames: Object.keys(attributes).sort(),
    plaintextEmployeeIdsObserved: false,
    plaintextAmountsObserved: false
  };
}

function scanRecipient(binary: string, profile: string, nodeArgs: NodeArgs, env: NodeJS.ProcessEnv): ScanResult {
  return runJson<ScanResult>(binary, [
    'tx', 'privacy', 'list-notes',
    '--from', profile,
    '--keyring-backend', 'test',
    '--home', nodeArgs.home,
    '--node', nodeArgs.node,
    '--rescan-wallet',
    '--json'
  ], { env });
}

export function employeeScanEvidence({
  employee,
  before,
  after,
  txHash,
  amount
}: {
  employee: Pick<EmployeeRuntime, 'id' | 'profile' | 'shieldedAddress'>;
  before: ScanResult;
  after: ScanResult;
  txHash: string;
  amount: number;
}): LocalEmployeeScan {
  const matchingNotes = (after.notes ?? []).filter((note) =>
    String(note.tx_hash ?? '').toLowerCase() === txHash.toLowerCase() &&
    String(note.amount) === String(amount) &&
    note.status === 'spendable');
  const evidence = {
    employeeId: employee.id,
    profile: employee.profile,
    recipientAddressDigest: `sha256:${createHash('sha256').update(employee.shieldedAddress).digest('hex')}`,
    beforeNoteCount: noteCount(before),
    afterNoteCount: noteCount(after),
    newNoteCount: noteCount(after) - noteCount(before),
    matchingBatchNoteCount: matchingNotes.length,
    receivedAmount: `${amount}uclair`
  };
  if (evidence.newNoteCount !== 1 || evidence.matchingBatchNoteCount !== 1) {
    throw new Error(`${employee.id} scan did not prove exactly one ${amount}uclair note from ${txHash}`);
  }
  return evidence;
}

async function stopProcess(child?: ChildProcess): Promise<void> {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  await Promise.race([exited, delay(3000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

export async function runDistinctEmployeePayroll({
  clairveil,
  clairveilCommit,
  workDir
}: {
  clairveil: string;
  clairveilCommit: string;
  workDir: string;
}): Promise<LocalPayrollEvidence> {
  const home = join(workDir, 'home');
  const artifacts = join(workDir, 'artifacts');
  const nodeLogPath = join(workDir, 'clairveild.log');
  const binary = join(workDir, 'clairveild-workshop');
  const setup = join(workDir, 'clairveil-setup-workshop');
  const chainId = 'clairveil-workshop-local-1';
  const ports = await reservePorts(6);
  const node = `tcp://127.0.0.1:${ports[0]}`;
  const nodeArgs = { home, node, chainId };
  const profiles: EmployeeRuntime[] = CLAIRVEIL_PAYROLL_ALLOCATIONS.map((allocation) => ({
    id: allocation.employeeId,
    profile: allocation.profile,
    amount: allocation.amount,
    shieldedAddress: '',
    before: { notes: [] }
  }));
  const itemCount = profiles.length;
  let nodeProcess: ChildProcess | undefined;
  let nodeLog: FileHandle | undefined;

  try {
    await mkdir(home, { recursive: true });
    run('go', ['build', '-o', binary, './cmd/clairveild'], { cwd: clairveil });
    run('go', ['build', '-o', setup, './cmd/clairveil-setup'], { cwd: clairveil });
    run(setup, ['--out', artifacts]);
    const artifactEnvironment = parseEnvironmentFile(await readFile(join(artifacts, 'privacy_zk_checksums.env'), 'utf8'));
    const env = {
      ...process.env,
      ...artifactEnvironment,
      CLAIRVEIL_PRIVACY_ZK_ARTIFACT_DIR: artifacts,
      CLAIRVEIL_PRIVACY_ZK_PREFLIGHT_MODE: 'strict'
    };

    for (const profile of ['alice', ...profiles.map((entry) => entry.profile), 'auditor']) {
      run(binary, ['keys', 'add', profile, '--keyring-backend', 'test', '--home', home, '--output', 'json'], { env, sensitive: true });
    }
    const transparentAddresses = Object.fromEntries(['alice', ...profiles.map((entry) => entry.profile), 'auditor']
      .map((profile) => [profile, run(binary, ['keys', 'show', '-a', profile, '--keyring-backend', 'test', '--home', home], { env })])) as Record<string, string>;
    const auditor = runJson<AuditorResult>(binary, ['tx', 'privacy', 'show-disclosure-pubkey', '--from', 'auditor', '--keyring-backend', 'test', '--home', home, '--output', 'json'], { env });
    if (typeof auditor.public_key_hex !== 'string') throw new Error('auditor disclosure public key is missing');

    run(binary, ['init', 'workshop-local', '--chain-id', chainId, '--home', home], { env });
    await patchNodeConfiguration(home, ports);
    for (const address of Object.values(transparentAddresses)) {
      run(binary, ['add-genesis-account', address, '100000000000000000000uclair', '--home', home], { env });
    }
    run(binary, ['gentx', 'alice', '9000000000000000000uclair', '--chain-id', chainId, '--keyring-backend', 'test', '--home', home], { env });
    run(binary, ['collect-gentxs', '--home', home], { env });
    await setAuditIdentity(home, auditor.public_key_hex);
    run(binary, ['validate', '--home', home], { env });

    nodeLog = await open(nodeLogPath, 'w');
    nodeProcess = spawn(binary, ['start', '--home', home, '--minimum-gas-prices', '0uclair'], {
      env,
      stdio: ['ignore', nodeLog.fd, nodeLog.fd]
    });
    await waitForNode(binary, nodeArgs, nodeProcess, nodeLogPath, env);

    for (const employee of profiles) {
      const shielded = runJson<ShieldedAddressResult>(binary, ['tx', 'privacy', 'show-address', '--from', employee.profile, '--keyring-backend', 'test', '--home', home, '--output', 'json'], { env });
      if (!String(shielded.address ?? '').startsWith('clairs1')) throw new Error(`invalid shielded address for ${employee.id}`);
      employee.shieldedAddress = String(shielded.address);
      employee.before = scanRecipient(binary, employee.profile, nodeArgs, env);
    }
    if (new Set(profiles.map((entry) => entry.shieldedAddress)).size !== itemCount) {
      throw new Error('employee shielded addresses are not distinct');
    }

    const total = profiles.reduce((sum, employee) => sum + employee.amount, 0);
    const common = commandArgs(nodeArgs);
    const deposit = runJson<TransactionResult>(binary, [
      'tx', 'privacy', 'deposit', `${total}uclair`,
      '--from', 'alice', ...common,
      '--gas', '3000000', '--gas-prices', GAS_PRICES,
      '--yes', '--output', 'json'
    ], { env });
    if (typeof deposit.txhash !== 'string') throw new Error('local deposit response is missing txhash');
    const depositReceipt = await waitForTransaction(binary, deposit.txhash, node, env);
    if (Number(depositReceipt.code ?? 0) !== 0) throw new Error(`local deposit failed with code ${depositReceipt.code}`);

    const treasuryBeforeOverspend = scanRecipient(binary, 'alice', nodeArgs, env);
    const spendableTreasury = (treasuryBeforeOverspend.notes ?? []).filter((note) => note.status === 'spendable');
    if (spendableTreasury.length !== 1 || String(spendableTreasury[0]?.amount) !== String(total)) {
      throw new Error(`expected one spendable ${total}uclair treasury note before overspend control`);
    }
    const overspendPreparedPath = join(workDir, 'overspend-prepared.json');
    const overspendPayments = profiles.flatMap((employee, index) => [
      '--payment', `${employee.shieldedAddress},${employee.amount + (index === 0 ? 1 : 0)}uclair`
    ]);
    const overspendError = runExpectedFailure(binary, [
      'tx', 'privacy', 'prepare-batch-transfer',
      ...overspendPayments,
      '--input-index', '1',
      '--output-mode', 'compact',
      '--prepared-out', overspendPreparedPath,
      '--expires-in', '7200',
      '--from', 'alice', ...common,
      '--rescan-wallet', '--output', 'json'
    ], /selected inputs do not fund batch payment total 301uclair/, { env });
    const treasuryAfterOverspend = scanRecipient(binary, 'alice', nodeArgs, env);
    if (spendableNoteFingerprint(treasuryBeforeOverspend) !== spendableNoteFingerprint(treasuryAfterOverspend)) {
      throw new Error('overspend control changed the treasury note state');
    }

    const preparedPath = join(workDir, 'payroll-prepared.json');
    const proofPath = join(workDir, 'payroll-proof.json');
    const payments = profiles.flatMap((employee) => ['--payment', `${employee.shieldedAddress},${employee.amount}uclair`]);
    const batch = runJson<TransactionResult>(binary, [
      'tx', 'privacy', 'transfer-batch-16x32',
      ...payments,
      '--output-mode', 'compact',
      '--prepared-out', preparedPath,
      '--proof-out', proofPath,
      '--expires-in', '7200',
      '--from', 'alice', ...common,
      '--gas', BATCH_GAS, '--gas-prices', GAS_PRICES,
      '--yes', '--rescan-wallet', '--output', 'json'
    ], { env });
    if (typeof batch.txhash !== 'string') throw new Error('local batch response is missing txhash');
    const batchReceipt = await waitForTransaction(binary, batch.txhash, node, env);
    if (Number(batchReceipt.code ?? 0) !== 0 || Number(batch.code ?? 0) !== 0) {
      throw new Error(`local one-proof payroll failed with code ${batchReceipt.code ?? batch.code}`);
    }
    if (Number(batch.input_count) !== 1 || Number(batch.output_count) !== itemCount) {
      throw new Error(`unexpected one-proof batch shape: ${batch.input_count} input, ${batch.output_count} outputs`);
    }
    const proofArtifact = await readFile(proofPath);
    if (proofArtifact.length === 0) throw new Error('local payroll proof artifact is empty');
    const proofArtifactDigest = `sha256:${createHash('sha256').update(proofArtifact).digest('hex')}`;

    const employeeScans: LocalEmployeeScan[] = [];
    const happyPathScans = new Map<string, ScanResult>();
    for (const employee of profiles) {
      const after = scanRecipient(binary, employee.profile, nodeArgs, env);
      happyPathScans.set(employee.profile, after);
      employeeScans.push(employeeScanEvidence({ employee, before: employee.before, after, txHash: batch.txhash, amount: employee.amount }));
    }

    const publicObserver = publicBatchObservation(batchReceipt, batch.txhash);

    const wrongRecipientAmount = 120;
    const wrongRecipientDeposit = runJson<TransactionResult>(binary, [
      'tx', 'privacy', 'deposit', `${wrongRecipientAmount}uclair`,
      '--from', 'alice', ...common,
      '--gas', '3000000', '--gas-prices', GAS_PRICES,
      '--yes', '--output', 'json'
    ], { env });
    if (typeof wrongRecipientDeposit.txhash !== 'string') throw new Error('wrong-recipient setup deposit is missing txhash');
    const wrongRecipientDepositReceipt = await waitForTransaction(binary, wrongRecipientDeposit.txhash, node, env);
    if (Number(wrongRecipientDepositReceipt.code ?? 0) !== 0) throw new Error(`wrong-recipient setup deposit failed with code ${wrongRecipientDepositReceipt.code}`);

    const intendedEmployee = profiles.find((employee) => employee.id === 'EMP-B');
    const actualRecipient = profiles.find((employee) => employee.id === 'EMP-C');
    if (!intendedEmployee || !actualRecipient) throw new Error('wrong-recipient control profiles are missing');
    const wrongRecipientTransfer = runJson<TransactionResult>(binary, [
      'tx', 'privacy', 'transfer-batch-16x32',
      '--payment', `${actualRecipient.shieldedAddress},${wrongRecipientAmount}uclair`,
      '--output-mode', 'compact',
      '--prepared-out', join(workDir, 'wrong-recipient-prepared.json'),
      '--proof-out', join(workDir, 'wrong-recipient-proof.json'),
      '--expires-in', '7200',
      '--from', 'alice', ...common,
      '--gas', BATCH_GAS, '--gas-prices', GAS_PRICES,
      '--yes', '--rescan-wallet', '--output', 'json'
    ], { env });
    if (typeof wrongRecipientTransfer.txhash !== 'string') throw new Error('wrong-recipient transfer is missing txhash');
    const wrongRecipientReceipt = await waitForTransaction(binary, wrongRecipientTransfer.txhash, node, env);
    if (Number(wrongRecipientReceipt.code ?? 0) !== 0 || Number(wrongRecipientTransfer.code ?? 0) !== 0) {
      throw new Error(`wrong-recipient transfer failed with code ${wrongRecipientReceipt.code ?? wrongRecipientTransfer.code}`);
    }
    const intendedBefore = happyPathScans.get(intendedEmployee.profile);
    const actualBefore = happyPathScans.get(actualRecipient.profile);
    if (!intendedBefore || !actualBefore) throw new Error('wrong-recipient control lacks happy-path scan baselines');
    const intendedAfter = scanRecipient(binary, intendedEmployee.profile, nodeArgs, env);
    const actualAfter = scanRecipient(binary, actualRecipient.profile, nodeArgs, env);
    const intendedEmployeeNewNoteCount = noteCount(intendedAfter) - noteCount(intendedBefore);
    const actualRecipientNewNoteCount = noteCount(actualAfter) - noteCount(actualBefore);
    const actualRecipientMatchingNoteCount = matchingNoteCount(actualAfter, wrongRecipientTransfer.txhash, wrongRecipientAmount);
    if (intendedEmployeeNewNoteCount !== 0 || actualRecipientNewNoteCount !== 1 || actualRecipientMatchingNoteCount !== 1) {
      throw new Error('wrong-recipient control did not demonstrate EMP-B missing and EMP-C receiving the 120uclair note');
    }

    const evidence: LocalPayrollEvidence = {
      schema: LOCAL_PAYROLL_SCHEMA,
      label: '[Local]',
      utc: new Date().toISOString(),
      clairveilCommit,
      workflow: 'clairveil-distinct-employee-one-proof-batch',
      asset: 'uclair',
      payrollItemCount: itemCount,
      payrollAllocations: profiles.map((employee) => ({ employeeId: employee.id, amount: `${employee.amount}uclair` })),
      payrollTotal: `${total}uclair`,
      distinctRecipientCount: new Set(profiles.map((entry) => entry.shieldedAddress)).size,
      proofCount: 1,
      transactionEnvelopeCount: 1,
      transactions: {
        deposit: {
          txHash: deposit.txhash,
          height: String(depositReceipt.height ?? ''),
          code: Number(depositReceipt.code ?? 0),
          amount: `${total}uclair`
        },
        payrollBatch: {
          txHash: batch.txhash,
          height: String(batchReceipt.height ?? ''),
          code: Number(batchReceipt.code ?? 0),
          payloadHash: String(batch.payload_hash ?? ''),
          proofArtifactDigest,
          inputCount: Number(batch.input_count),
          outputCount: Number(batch.output_count)
        }
      },
      employeeScans,
      observationComparison: {
        publicObserver,
        employeeObservers: employeeScans.map(({ employeeId, receivedAmount, matchingBatchNoteCount }) => ({
          employeeId,
          receivedAmount,
          matchingBatchNoteCount
        }))
      },
      failureControls: {
        overspend: {
          classification: 'privacy-resource-rejection',
          availableAmount: '300uclair',
          requestedAmount: '301uclair',
          rejectedAt: 'wallet-input-selection-before-proof',
          broadcastAttempted: false,
          error: overspendError,
          treasuryNoteCountBefore: noteCount(treasuryBeforeOverspend),
          treasuryNoteCountAfter: noteCount(treasuryAfterOverspend),
          treasuryStateUnchanged: true
        },
        wrongRecipient: {
          classification: 'business-intent-failure',
          intendedEmployeeId: 'EMP-B',
          actualRecipientEmployeeId: 'EMP-C',
          amount: '120uclair',
          setupDepositTxHash: wrongRecipientDeposit.txhash,
          transferTxHash: wrongRecipientTransfer.txhash,
          transferCode: 0,
          intendedEmployeeNewNoteCount,
          actualRecipientNewNoteCount,
          actualRecipientMatchingNoteCount,
          chainOutcome: 'success',
          payrollOutcome: 'failed'
        }
      },
      finalPayrollStatus: 'Confirmed',
      stateChangingTransaction: true,
      boundary: 'Actual Clairveil x/privacy local-chain 300uclair deposit and one-proof BatchJoinSplit16x32 payroll allocating EMP-A/B/C 100/120/80uclair, plus an overspend rejection and a successful-but-misdirected synthetic payment control. This is uclair/Cosmos localnet without Maroo OKRW, EVM ABI, or PCL enforcement.'
    };
    return validateLocalPayrollEvidence(evidence);
  } finally {
    await stopProcess(nodeProcess);
    await nodeLog?.close();
  }
}
