import { spawnSync } from 'node:child_process';
import type { SpawnSyncOptionsWithStringEncoding } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DEFAULT_CLAIRVEIL_PATH, optionalStringArg } from '../../shared/io.ts';
import { runDistinctEmployeePayroll } from './distinct-payroll.ts';
import type { CliArgs, ExecutionResult, LocalPayrollEvidence } from '../../shared/types.ts';

export const EXPECTED_CLAIRVEIL_SHA = 'ca85b02708fdd75259d4d2ee2d671c21198cec69';

type RunOptions = Omit<SpawnSyncOptionsWithStringEncoding, 'encoding'>;
interface ClairveilReadiness {
  label: '[Local]';
  mode: 'readiness-only';
  clairveil: string;
  clairveilCommit: string;
  go: string;
  stateChangingTransaction: false;
}

function run(command: string, commandArgs: string[], options: RunOptions = {}): string {
  const child = spawnSync(command, commandArgs, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, ...options });
  if (child.error) throw child.error;
  if (child.status !== 0) {
    const detail = [child.stdout, child.stderr].filter(Boolean).join('\n').slice(-8000);
    throw new Error(`${command} exited ${child.status}\n${detail}`);
  }
  return child.stdout.trim();
}

export async function ready(args: CliArgs): Promise<ExecutionResult<ClairveilReadiness>> {
  const clairveil = resolve(optionalStringArg(args, 'clairveil') ?? DEFAULT_CLAIRVEIL_PATH);
  await Promise.all([
    stat(join(clairveil, 'cmd/clairveild/main.go')),
    stat(join(clairveil, 'cmd/clairveil-setup/main.go')),
    stat(join(clairveil, 'x/privacy/client/cli/tx_batch_transfer_16x32.go'))
  ]);
  const sha = run('git', ['-C', clairveil, 'rev-parse', 'HEAD']);
  if (sha !== EXPECTED_CLAIRVEIL_SHA) throw new Error(`Clairveil SHA mismatch: expected ${EXPECTED_CLAIRVEIL_SHA}, got ${sha}`);
  const go = run('go', ['version']);
  return {
    marker: `CLAIRVEIL LOCAL READY: ${sha}`,
    result: { label: '[Local]', mode: 'readiness-only', clairveil, clairveilCommit: sha, go, stateChangingTransaction: false }
  };
}

export async function payroll(args: CliArgs): Promise<ExecutionResult<LocalPayrollEvidence>> {
  const readiness = await ready(args);
  const clairveil = readiness.result.clairveil;
  const workDir = await mkdtemp(join(tmpdir(), 'maroo-workshop-local-payroll-'));
  let succeeded = false;
  try {
    const result = await runDistinctEmployeePayroll({
      clairveil,
      clairveilCommit: readiness.result.clairveilCommit,
      workDir
    });
    succeeded = true;
    return { marker: 'CLAIRVEIL LOCAL PAYROLL AND FAILURE CONTROLS VERIFIED: EMP-A 100, EMP-B 120, EMP-C 80uclair', result };
  } finally {
    if (succeeded || !args['keep-on-failure']) await rm(workDir, { recursive: true, force: true });
    else process.stderr.write(`retained failed local work dir: ${workDir}\n`);
  }
}

export const clairveilLocalAdapter = Object.freeze({ ready, payroll });
