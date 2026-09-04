import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  http,
  isAddress
} from 'viem';
import type { Address, TransactionReceipt } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { Abis, Addresses, marooPublicActions, marooTestnet } from '@maroo-chain/viem';
import {
  CHAIN_ID,
  inspectOkrwParamsResponse,
  PRIVACY_PRECOMPILE,
  validatePayrollPlan,
  validatePreparedTransaction
} from '../../shared/contracts.ts';
import {
  DEFAULT_ENV_PATH,
  DEFAULT_PLAN_PATH,
  loadEnv,
  mergeEnvironment,
  optionalStringArg,
  readJson
} from '../../shared/io.ts';
import { captureLiveAttempt, runtimeEvidence } from '../../shared/live-attempt.ts';
import type { Adapter, CliArgs, Environment, Hex, PayrollPlan, PreparedTransaction } from '../../shared/types.ts';

const GET_PARAMS_SELECTOR = '0x5e615a6b';
const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex;
const PRIVACY_PROBE_GAS = 1_000_000n;

interface MarooEnvironment extends Environment {
  MAROO_RPC_URL: string;
  MAROO_CHAIN_ID: string;
  MAROO_OKRW_PRECOMPILE: string;
  MAROO_PCL_PRECOMPILE: string;
  MAROO_EAS_PRECOMPILE: string;
  MAROO_PRIVACY_PRECOMPILE: string;
}

interface ParticipantAddresses {
  companyAccount: Address;
  employeeAccount: Address;
}

type PrivacyProbeOperation = 'deposit' | 'transfer';

function messageOf(error: unknown): string {
  const typed = error as Error & { shortMessage?: string };
  const message = error instanceof Error ? typed.shortMessage ?? error.message : String(error);
  return message.replace(/0x[0-9a-fA-F]{64}/g, '<redacted-32-byte-value>').slice(0, 800);
}

function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Uint8Array) return `0x${Buffer.from(value).toString('hex')}`;
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, jsonSafe(entry)]));
  }
  return value;
}

function assertPublicEnvironment(env: Environment): asserts env is MarooEnvironment {
  if (!/^https:\/\//.test(env.MAROO_RPC_URL ?? '')) throw new Error('MAROO_RPC_URL must be an https URL');
  if (String(env.MAROO_CHAIN_ID) !== String(CHAIN_ID)) throw new Error(`MAROO_CHAIN_ID must be ${CHAIN_ID}`);
  const expected = {
    MAROO_OKRW_PRECOMPILE: Addresses.okrw,
    MAROO_PCL_PRECOMPILE: Addresses.pcl,
    MAROO_EAS_PRECOMPILE: Addresses.eas,
    MAROO_PRIVACY_PRECOMPILE: Addresses.privacy
  };
  for (const [key, address] of Object.entries(expected)) {
    if (String(env[key]).toLowerCase() !== address.toLowerCase()) throw new Error(`${key} must be ${address}`);
  }
}

async function context(args: CliArgs) {
  const envPath = optionalStringArg(args, 'env') ?? DEFAULT_ENV_PATH;
  const env = mergeEnvironment(await loadEnv(envPath));
  assertPublicEnvironment(env);
  const client = createPublicClient({ chain: marooTestnet, transport: http(env.MAROO_RPC_URL) })
    .extend(marooPublicActions());
  return { client, env, envPath };
}

function participantAddresses(env: Environment): ParticipantAddresses {
  const companyAccount = env.COMPANY_ACCOUNT;
  const employeeAccount = env.EMPLOYEE_ACCOUNT;
  if (typeof companyAccount !== 'string' || !isAddress(companyAccount)) throw new Error('COMPANY_ACCOUNT must be a public EVM address');
  if (typeof employeeAccount !== 'string' || !isAddress(employeeAccount)) throw new Error('EMPLOYEE_ACCOUNT must be a public EVM address');
  if (companyAccount.toLowerCase() === employeeAccount.toLowerCase()) {
    throw new Error('COMPANY_ACCOUNT and EMPLOYEE_ACCOUNT must be different');
  }
  return { companyAccount, employeeAccount };
}

function companySignerFromEnvironment(env: Environment) {
  const participants = participantAddresses(env);
  const privateKey = env.COMPANY_PRIVATE_KEY;
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey ?? '')) {
    throw new Error('COMPANY_PRIVATE_KEY must be a testnet-only 32-byte hex key in the env file');
  }
  const account = privateKeyToAccount(privateKey as Hex);
  if (account.address.toLowerCase() !== participants.companyAccount.toLowerCase()) {
    throw new Error('COMPANY_PRIVATE_KEY does not match COMPANY_ACCOUNT');
  }
  return { account, ...participants };
}

export function buildPrivacyProbeTransaction(operation: PrivacyProbeOperation, nowSec = Math.floor(Date.now() / 1000)) {
  if (operation === 'deposit') {
    const data = encodeFunctionData({
      abi: Abis.privacy,
      functionName: 'deposit',
      args: [{ noteCommitment: ZERO_BYTES32, encryptedNote: ZERO_BYTES32, proof: ZERO_BYTES32 }]
    });
    return {
      transaction: { to: Addresses.privacy, data, value: 1n, gas: PRIVACY_PROBE_GAS },
      details: {
        operation,
        target: Addresses.privacy,
        selector: data.slice(0, 10),
        valueWei: '1',
        gasLimit: PRIVACY_PROBE_GAS.toString(),
        expectedResult: 'rejection',
        invalidInput: 'all-zero placeholder commitment, encrypted note, and proof; no success claim'
      }
    };
  }
  if (operation === 'transfer') {
    const data = encodeFunctionData({
      abi: Abis.privacy,
      functionName: 'transfer',
      args: [{
        proof: ZERO_BYTES32,
        root: ZERO_BYTES32,
        nullifiers: [ZERO_BYTES32],
        newCommitments: [ZERO_BYTES32],
        cipherTexts: [ZERO_BYTES32],
        viewTags: ['0x00'],
        userPrivacyPolicy: 0,
        userDisclosureDigest: '0x',
        userDisclosureMode: 0,
        userDisclosureTargetPubkey: '0x',
        userDisclosurePayload: '0x',
        auditDisclosureDigest: '0x',
        auditDisclosureTargetPubkey: '0x',
        auditDisclosurePayload: '0x',
        selfViewDisclosureDigest: '0x',
        selfViewDisclosurePayload: '0x',
        expiresAtUnix: BigInt(nowSec + 300)
      }]
    });
    return {
      transaction: { to: Addresses.privacy, data, value: 0n, gas: PRIVACY_PROBE_GAS },
      details: {
        operation,
        target: Addresses.privacy,
        selector: data.slice(0, 10),
        valueWei: '0',
        gasLimit: PRIVACY_PROBE_GAS.toString(),
        expectedResult: 'rejection',
        invalidInput: 'all-zero placeholder root, nullifier, commitments, ciphertext, and proof; no success claim'
      }
    };
  }
  throw new Error('privacy probe operation must be deposit or transfer');
}

function attemptCommand(args: CliArgs): string {
  const tokens = [
    'bun run demo/scripts/run.ts',
    '--target maroo-testnet',
    '--action attempt',
    `--kind ${args.kind}`
  ];
  const plan = optionalStringArg(args, 'plan');
  const bundle = optionalStringArg(args, 'bundle');
  if (plan) tokens.push(`--plan ${plan}`);
  if (bundle) tokens.push(`--bundle ${bundle}`);
  tokens.push(`--env ${optionalStringArg(args, 'env') ?? 'demo/.env'}`);
  tokens.push('--broadcast --ack-state-change MAROO_TESTNET_ONLY');
  const out = optionalStringArg(args, 'out');
  if (out) tokens.push(`--out ${out}`);
  return tokens.join(' ');
}

async function observe<T>(name: string, task: () => Promise<T>) {
  try {
    return { name, status: 'pass', value: jsonSafe(await task()) };
  } catch (error) {
    return { name, status: 'error', error: messageOf(error) };
  }
}

export async function doctor(args: CliArgs) {
  const { client, env } = await context(args);
  if (args.offline) {
    return {
      marker: 'MAROO TESTNET DOCTOR PASSED: offline configuration',
      result: {
        label: '[Docs Only]',
        mode: 'offline-configuration',
        chainId: CHAIN_ID,
        rpc: env.MAROO_RPC_URL,
        addresses: {
          okrw: env.MAROO_OKRW_PRECOMPILE,
          pcl: env.MAROO_PCL_PRECOMPILE,
          eas: env.MAROO_EAS_PRECOMPILE,
          privacy: env.MAROO_PRIVACY_PRECOMPILE
        }
      }
    };
  }

  const chainId = await client.getChainId();
  if (chainId !== CHAIN_ID) throw new Error(`chain id mismatch: expected ${CHAIN_ID}, got ${chainId}`);
  const [okrwRaw, okrwTyped, pclParams, globalPolicies, privacyPolicies] = await Promise.all([
    client.request({ method: 'eth_call', params: [{ to: Addresses.okrw, data: GET_PARAMS_SELECTOR }, 'latest'] }),
    observe('okrw.getParams', () => client.okrw.getParams()),
    observe('pcl.getParams', () => client.pcl.getParams()),
    observe('pcl.globalPolicies', () => client.pcl.globalPolicies()),
    observe('pcl.contractPolicies(privacy)', () => client.pcl.contractPolicies({ contract: Addresses.privacy }))
  ]);
  const okrwObservation = inspectOkrwParamsResponse(okrwRaw);
  const checks = {
    network: 'pass',
    okrwRpc: 'pass',
    okrwTypedAbi: okrwTyped.status,
    pcl: [pclParams, globalPolicies, privacyPolicies].every((entry) => entry.status === 'pass') ? 'pass' : 'error',
    privacyAddress: env.MAROO_PRIVACY_PRECOMPILE.toLowerCase() === PRIVACY_PRECOMPILE ? 'pass' : 'error'
  };
  const failedChecks = Object.entries(checks).filter(([, status]) => status !== 'pass').map(([name]) => name);
  if (failedChecks.length > 0) throw new Error(`Maroo doctor failed checks: ${failedChecks.join(', ')}`);
  return {
    marker: `MAROO TESTNET DOCTOR PASSED: chain ${chainId}`,
    result: {
      label: '[Live Testnet]',
      utc: new Date().toISOString(),
      mode: 'read-only-doctor',
      chainId,
      checks,
      okrw: { ...okrwObservation, typed: okrwTyped },
      pcl: { params: pclParams, globalPolicies, privacyPolicies },
      privacy: { address: env.MAROO_PRIVACY_PRECOMPILE, callableThroughPclPolicyLookup: privacyPolicies.status === 'pass' },
      stateChangingTransaction: false
    }
  };
}

export async function preflight(args: CliArgs) {
  const { client, env } = await context(args);
  const plan = await readJson<PayrollPlan>(optionalStringArg(args, 'plan') ?? DEFAULT_PLAN_PATH);
  validatePayrollPlan(plan);
  const participants = participantAddresses(env);
  const observedChainId = await client.getChainId();
  if (observedChainId !== CHAIN_ID) throw new Error(`chain id mismatch: expected ${CHAIN_ID}, got ${observedChainId}`);
  const balance = await client.getBalance({ address: participants.companyAccount });
  const doctorResult = await doctor(args);
  const funding = balance > BigInt(plan.totalBaseUnits) ? 'deposit-minimum-pass' : 'funding-required';
  return {
    marker: 'MAROO PREFLIGHT CAPTURED: account, balance, OKRW, PCL, Privacy',
    result: {
      ...doctorResult.result,
      mode: 'read-only-preflight',
      ...participants,
      balanceWei: balance.toString(),
      requiredDepositWei: plan.totalBaseUnits,
      checks: { ...doctorResult.result.checks, account: 'pass', funding }
    }
  };
}

export async function submit(args: CliArgs) {
  const planPath = optionalStringArg(args, 'plan');
  const bundlePath = optionalStringArg(args, 'bundle');
  if (!planPath || !bundlePath) throw new Error('submit requires --plan and --bundle');
  const { client, env } = await context(args);
  const plan = await readJson<PayrollPlan>(planPath);
  const bundle = await readJson<PreparedTransaction>(bundlePath);
  validatePreparedTransaction(bundle, plan, { live: true });
  const participants = participantAddresses(env);
  const observedChainId = await client.getChainId();
  if (observedChainId !== bundle.chainId) throw new Error('environment chain id does not match bundle');
  const transaction = {
    account: participants.companyAccount,
    to: bundle.to,
    data: bundle.calldata,
    value: BigInt(bundle.valueWei)
  };
  const gas = await client.estimateGas(transaction);
  const result: {
    label: '[Live Testnet]';
    utc: string;
    mode: string;
    kind: PreparedTransaction['kind'];
    planDigest: string;
    selector: string;
    gasEstimate: string;
    txHash?: Hex;
    blockNumber?: string;
    receiptStatus?: string;
  } = {
    label: '[Live Testnet]',
    utc: new Date().toISOString(),
    mode: args.broadcast ? 'broadcast' : 'estimate-only',
    kind: bundle.kind,
    planDigest: bundle.planDigest,
    selector: bundle.calldata.slice(0, 10),
    gasEstimate: gas.toString()
  };
  if (args.broadcast) {
    const { account } = companySignerFromEnvironment(env);
    const wallet = createWalletClient({ account, chain: marooTestnet, transport: http(env.MAROO_RPC_URL) });
    const txHash = await wallet.sendTransaction({
      account,
      to: bundle.to,
      data: bundle.calldata,
      value: BigInt(bundle.valueWei),
      gas
    });
    const receipt = await client.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
    result.txHash = txHash;
    result.blockNumber = receipt.blockNumber.toString();
    result.receiptStatus = receipt.status;
  }
  return { marker: `${args.broadcast ? 'MAROO TRANSACTION BROADCAST' : 'MAROO ESTIMATE PASSED'}: ${bundle.kind}`, result };
}

export async function attempt(args: CliArgs) {
  if (!args.broadcast || args['ack-state-change'] !== 'MAROO_TESTNET_ONLY') {
    throw new Error('attempt requires --broadcast --ack-state-change MAROO_TESTNET_ONLY; env/key is not read before this check');
  }
  const kind = optionalStringArg(args, 'kind');
  if (!kind || !['privacy-bundle', 'privacy-deposit-transfer-probes'].includes(kind)) {
    throw new Error('--kind must be privacy-bundle or privacy-deposit-transfer-probes');
  }

  const { client, env } = await context(args);
  const { account, companyAccount, employeeAccount } = companySignerFromEnvironment(env);
  const chainId = await client.getChainId();
  if (chainId !== CHAIN_ID) throw new Error(`chain id mismatch: expected ${CHAIN_ID}, got ${chainId}`);
  const wallet = createWalletClient({ account, chain: marooTestnet, transport: http(env.MAROO_RPC_URL) });
  const environment = runtimeEvidence({
    chainId,
    rpc: env.MAROO_RPC_URL,
    companyAccount,
    employeeAccount,
    sdk: '@maroo-chain/viem@0.3.0'
  });
  const explorerBase = String(env.MAROO_EXPLORER_URL ?? '').replace(/\/$/, '');
  const command = attemptCommand(args);

  if (kind === 'privacy-deposit-transfer-probes') {
    const runProbe = async (operation: PrivacyProbeOperation) => {
      const { transaction, details } = buildPrivacyProbeTransaction(operation);
      return captureLiveAttempt({
        kind: `privacy-${operation}-probe`,
        command,
        environment,
        details: { probe: details },
        execute: async (control) => {
          control.enter('transaction-preparation');
          const preparedTransaction = await wallet.prepareTransactionRequest({ account, ...transaction });
          const serializedTransaction = await wallet.signTransaction(preparedTransaction);
          control.markRpcSubmission();
          const txHash = await client.sendRawTransaction({ serializedTransaction });
          control.markTxHash(txHash);
          const receipt = await client.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
          control.enter('receipt-collected');
          return {
            txHash,
            explorerUrl: explorerBase ? `${explorerBase}/tx/${txHash}` : undefined,
            receiptStatus: receipt.status,
            blockNumber: receipt.blockNumber.toString(),
            gasUsed: receipt.gasUsed.toString()
          };
        }
      });
    };
    const deposit = await runProbe('deposit');
    const transfer = await runProbe('transfer');
    const bothAttempted = [deposit, transfer].every((probe) => probe.stateChangingTransactionAttempted);
    const result = {
      schema: 'maroo-workshop/live-state-change-attempt@1',
      label: '[Live Testnet]',
      utc: deposit.utc,
      completedUtc: transfer.completedUtc,
      kind,
      outcome: 'probe-sequence-complete',
      stage: 'probe-sequence-complete',
      stateChangingTransactionAttempted: bothAttempted,
      assignmentAttemptCandidate: bothAttempted,
      reproductionCommand: command,
      environment,
      boundary: 'Two intentionally invalid but ABI-valid calls were sent to the Maroo IPrivacy precompile. They demonstrate live deposit/transfer rejection paths, not valid ZK proof generation, private deposit success, or employee delivery.',
      probes: { deposit, transfer }
    };
    return {
      marker: bothAttempted
        ? 'MAROO PRIVACY DEPOSIT+TRANSFER PROBES RECORDED'
        : 'MAROO PRIVACY PROBES NOT BOTH ATTEMPTED',
      result
    };
  }

  const result = await captureLiveAttempt({
    kind,
    command,
    environment,
    execute: async (control) => {
      const planPath = optionalStringArg(args, 'plan');
      const bundlePath = optionalStringArg(args, 'bundle');
      if (!planPath || !bundlePath) throw new Error('privacy-bundle attempt requires --plan and --bundle');
      control.enter('bundle-validation');
      const plan = await readJson<PayrollPlan>(planPath);
      const bundle = await readJson<PreparedTransaction>(bundlePath);
      validatePreparedTransaction(bundle, plan, { live: true });
      if (bundle.kind !== 'deposit') throw new Error('morning live attempt accepts a reviewed deposit bundle only');
      const request = { account, to: bundle.to, data: bundle.calldata, value: BigInt(bundle.valueWei) };
      const boundary = 'Reviewed Maroo Privacy deposit bundle; receipt success still does not prove employee payroll delivery.';
      control.enter('rpc-estimate');
      const gas = await client.estimateGas(request);
      const transaction = { ...request, gas };

      control.enter('transaction-preparation');
      const preparedTransaction = await wallet.prepareTransactionRequest(transaction);
      const serializedTransaction = await wallet.signTransaction(preparedTransaction);
      control.markRpcSubmission();
      const txHash = await client.sendRawTransaction({ serializedTransaction });
      control.markTxHash(txHash);
      const receipt = await client.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
      control.enter('receipt-collected');
      return {
        txHash,
        explorerUrl: explorerBase ? `${explorerBase}/tx/${txHash}` : undefined,
        receiptStatus: receipt.status,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        boundary
      };
    }
  });
  const marker = result.stateChangingTransactionAttempted
    ? `MAROO STATE CHANGE ATTEMPT RECORDED: ${result.outcome}`
    : `MAROO STATE CHANGE NOT ATTEMPTED: ${result.stage}`;
  return { marker, result };
}

function matchingEvent(receipt: TransactionReceipt, bundle: PreparedTransaction) {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== PRIVACY_PRECOMPILE) continue;
    try {
      const decoded = decodeEventLog({ abi: Abis.privacy, data: log.data, topics: log.topics });
      const expected = bundle.kind === 'deposit' ? 'PrivacyDeposit' : 'PrivacySingleProofBatchTransfer';
      if (decoded.eventName === expected) return decoded;
    } catch {
      // Another Privacy event can share the address; only the expected ABI event is accepted.
    }
  }
  throw new Error(`expected ${bundle.kind} event was not found`);
}

export async function receipt(args: CliArgs) {
  const planPath = optionalStringArg(args, 'plan');
  const bundlePath = optionalStringArg(args, 'bundle');
  const tx = optionalStringArg(args, 'tx');
  if (!planPath || !bundlePath || !tx) throw new Error('receipt requires --plan, --bundle, and --tx');
  if (!/^0x[0-9a-fA-F]{64}$/.test(tx)) throw new Error('--tx must be a 32-byte transaction hash');
  const { client } = await context(args);
  const plan = await readJson<PayrollPlan>(planPath);
  const bundle = await readJson<PreparedTransaction>(bundlePath);
  validatePreparedTransaction(bundle, plan, { live: true });
  const [chainReceipt, transaction] = await Promise.all([
    client.getTransactionReceipt({ hash: tx as Hex }),
    client.getTransaction({ hash: tx as Hex })
  ]);
  if (chainReceipt.status !== 'success') throw new Error(`transaction failed with status ${chainReceipt.status}`);
  if (transaction.to?.toLowerCase() !== PRIVACY_PRECOMPILE) throw new Error('transaction target is not the Privacy precompile');
  if (transaction.input.toLowerCase() !== bundle.calldata.toLowerCase()) throw new Error('on-chain calldata does not match the reviewed bundle');
  if (transaction.value.toString() !== bundle.valueWei) throw new Error('on-chain value does not match the reviewed bundle');
  const decoded = matchingEvent(chainReceipt, bundle);
  const argsJson = jsonSafe(decoded.args) as Record<string, unknown>;
  const event = bundle.kind === 'deposit'
    ? {
        name: decoded.eventName,
        effectiveSender: String(argsJson.effectiveSender),
        operator: String(argsJson.operator),
        amount: String(argsJson.amount),
        amountBaseUnits: String(argsJson.amount).match(/^[0-9]+/)?.[0],
        noteCommitment: String(argsJson.noteCommitment)
      }
    : {
        name: decoded.eventName,
        effectiveSender: String(argsJson.effectiveSender),
        operator: String(argsJson.operator),
        requestHash: String(argsJson.requestHash),
        root: String(argsJson.root),
        inputCount: Number(argsJson.inputCount),
        outputCount: Number(argsJson.outputCount)
      };
  if (bundle.kind === 'deposit') {
    if (event.amountBaseUnits !== bundle.valueWei) throw new Error(`PrivacyDeposit amount mismatch: ${event.amount}`);
    if (event.noteCommitment.toLowerCase() !== bundle.public.noteCommitment.toLowerCase()) throw new Error('PrivacyDeposit commitment mismatch');
  } else {
    if (!event.root || event.root.toLowerCase() !== bundle.public.root.toLowerCase()) throw new Error('batch event root mismatch');
    if (event.inputCount !== bundle.public.inputCount || event.outputCount !== 3) throw new Error('batch event shape mismatch');
  }
  return {
    marker: `MAROO RECEIPT VERIFIED: ${bundle.kind}`,
    result: {
      schema: 'maroo-workshop/receipt@1',
      label: '[Live Testnet]',
      utc: new Date().toISOString(),
      kind: bundle.kind,
      planDigest: bundle.planDigest,
      txHash: tx,
      status: '0x1',
      blockNumber: Number(chainReceipt.blockNumber),
      gasUsed: chainReceipt.gasUsed.toString(),
      effectiveGasPrice: chainReceipt.effectiveGasPrice.toString(),
      event
    }
  };
}

export const marooTestnetAdapter = Object.freeze({ doctor, preflight, submit, attempt, receipt }) satisfies Adapter;
