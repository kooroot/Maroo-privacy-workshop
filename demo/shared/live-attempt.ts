import { arch, platform, release } from 'node:os';
import type { Hex, LiveAttemptEvidence } from './types.ts';

const SECRET_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b((?:COMPANY_)?PRIVATE_KEY|MNEMONIC|SEED_PHRASE)\s*=\s*[^\s]+/gi, '$1=<redacted>'],
  [/Authorization:\s*Bearer\s+[^\s]+/gi, 'Authorization: Bearer <redacted>']
];

interface ErrorLike {
  name?: unknown;
  message?: unknown;
  shortMessage?: unknown;
  details?: unknown;
  metaMessages?: unknown;
  code?: unknown;
  data?: unknown;
}

export interface SafeErrorEvidence {
  [key: string]: unknown;
  name: string;
  message: string;
  details?: string;
  metaMessages?: string[];
  code?: string | number;
  data?: string;
}

export interface LiveAttemptControl {
  enter(nextStage: string): void;
  markRpcSubmission(): void;
  markTxHash(hash: Hex): void;
}

interface CaptureLiveAttemptOptions {
  kind: string;
  command: string;
  environment: Record<string, unknown>;
  details?: Record<string, unknown>;
  execute: (control: LiveAttemptControl) => Promise<Record<string, unknown> & { receiptStatus?: string }>;
  now?: () => Date;
}

export function redactEvidenceText(value: unknown, limit = 2000): string {
  let safe = String(value ?? '');
  for (const [pattern, replacement] of SECRET_PATTERNS) safe = safe.replace(pattern, replacement);
  return safe.slice(0, limit);
}

export function safeError(error: unknown): SafeErrorEvidence {
  const source: ErrorLike = error && typeof error === 'object' ? error as ErrorLike : { message: error };
  const result: SafeErrorEvidence = {
    name: redactEvidenceText(source.name ?? 'Error', 120),
    message: redactEvidenceText(source.shortMessage ?? source.message ?? error, 2000)
  };
  if (source.details) result.details = redactEvidenceText(source.details, 2000);
  if (Array.isArray(source.metaMessages)) result.metaMessages = source.metaMessages.map((item) => redactEvidenceText(item, 800));
  if (typeof source.code === 'number' || typeof source.code === 'string') result.code = source.code;
  if (source.data !== undefined) {
    let data: string | undefined;
    try {
      data = typeof source.data === 'string' ? source.data : JSON.stringify(source.data, (_, value) => typeof value === 'bigint' ? value.toString() : value);
    } catch {
      data = String(source.data);
    }
    result.data = redactEvidenceText(data, 4000);
  }
  return result;
}

export function runtimeEvidence(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    os: `${platform()} ${release()}`,
    arch: arch(),
    bun: Bun.version,
    packages: {
      '@maroo-chain/viem': '0.3.0',
      viem: '2.56.3'
    },
    ...extra
  };
}

export async function captureLiveAttempt({
  kind,
  command,
  environment,
  details = {},
  execute,
  now = () => new Date()
}: CaptureLiveAttemptOptions): Promise<LiveAttemptEvidence> {
  let stage = 'prepared';
  let rpcSubmissionInvoked = false;
  let txHash: Hex | undefined;
  const startedAt = now().toISOString();
  const control: LiveAttemptControl = {
    enter(nextStage) {
      stage = nextStage;
    },
    markRpcSubmission() {
      stage = 'rpc-broadcast';
      rpcSubmissionInvoked = true;
    },
    markTxHash(hash) {
      txHash = hash;
      stage = 'receipt-wait';
    }
  };

  try {
    const execution = await execute(control);
    const receiptStatus = execution.receiptStatus ?? 'unknown';
    const outcome = receiptStatus === 'success' ? 'included-success' : receiptStatus === 'reverted' ? 'included-revert' : 'submitted';
    return {
      schema: 'maroo-workshop/live-state-change-attempt@1',
      label: '[Live Testnet]',
      utc: startedAt,
      completedUtc: now().toISOString(),
      kind,
      outcome,
      stage,
      stateChangingTransactionAttempted: rpcSubmissionInvoked,
      assignmentAttemptCandidate: rpcSubmissionInvoked,
      reproductionCommand: redactEvidenceText(command),
      environment,
      ...details,
      ...(txHash ? { txHash } : {}),
      ...execution
    };
  } catch (error) {
    return {
      schema: 'maroo-workshop/live-state-change-attempt@1',
      label: '[Live Testnet]',
      utc: startedAt,
      completedUtc: now().toISOString(),
      kind,
      outcome: 'rejected',
      stage,
      stateChangingTransactionAttempted: rpcSubmissionInvoked,
      assignmentAttemptCandidate: rpcSubmissionInvoked,
      reproductionCommand: redactEvidenceText(command),
      environment,
      ...details,
      ...(txHash ? { txHash } : {}),
      error: safeError(error)
    };
  }
}
