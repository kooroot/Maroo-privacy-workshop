import { describe, expect, test } from 'bun:test';
import { decodeFunctionData } from 'viem';
import { Abis, Addresses } from '@maroo-chain/viem';
import { captureLiveAttempt, redactEvidenceText, safeError } from '../shared/live-attempt.ts';
import { attempt, buildPrivacyProbeTransaction } from '../adapters/maroo-testnet/index.ts';

function clock() {
  const values = [new Date('2026-09-04T00:00:00Z'), new Date('2026-09-04T00:00:01Z')];
  return () => values.shift() ?? new Date('2026-09-04T00:00:02Z');
}

describe('live attempt recorder', () => {
  test('checks explicit authorization before reading an env file', async () => {
    await expect(attempt({ kind: 'privacy-deposit-transfer-probes', env: '/does/not/exist' }))
      .rejects.toThrow('env/key is not read before this check');
  });

  test('builds ABI-valid deposit and transfer probes against IPrivacy', () => {
    const deposit = buildPrivacyProbeTransaction('deposit', 2_000_000_000);
    const transfer = buildPrivacyProbeTransaction('transfer', 2_000_000_000);
    expect(deposit.transaction.to).toBe(Addresses.privacy);
    expect(deposit.transaction.value).toBe(1n);
    expect(decodeFunctionData({ abi: Abis.privacy, data: deposit.transaction.data }).functionName).toBe('deposit');
    expect(transfer.transaction.to).toBe(Addresses.privacy);
    expect(transfer.transaction.value).toBe(0n);
    const decodedTransfer = decodeFunctionData({ abi: Abis.privacy, data: transfer.transaction.data });
    expect(decodedTransfer.functionName).toBe('transfer');
    if (decodedTransfer.functionName !== 'transfer') throw new Error('decoded function is not transfer');
    expect(decodedTransfer.args[0].expiresAtUnix).toBe(2_000_000_300n);
    expect(deposit.details.expectedResult).toBe('rejection');
    expect(transfer.details.expectedResult).toBe('rejection');
  });

  test('records an included transaction with public verification data', async () => {
    const txHash = `0x${'ab'.repeat(32)}` as const;
    const result = await captureLiveAttempt({
      kind: 'privacy-deposit-probe',
      command: 'bun run attempt --env demo/.env',
      environment: { chainId: 450815 },
      now: clock(),
      execute: async (control) => {
        control.markRpcSubmission();
        control.markTxHash(txHash);
        return { txHash, receiptStatus: 'success', explorerUrl: `https://example.test/tx/${txHash}` };
      }
    });
    expect(result.outcome).toBe('included-success');
    expect(result.stateChangingTransactionAttempted).toBe(true);
    expect(result.txHash).toBe(txHash);
  });

  test('distinguishes local preparation failure from an RPC submission attempt', async () => {
    const result = await captureLiveAttempt({
      kind: 'privacy-bundle', command: 'bun run attempt', environment: {}, now: clock(),
      execute: async (control) => {
        control.enter('bundle-validation');
        throw new Error('bundle incompatible');
      }
    });
    expect(result.outcome).toBe('rejected');
    expect(result.stage).toBe('bundle-validation');
    expect(result.stateChangingTransactionAttempted).toBe(false);
  });

  test('records RPC rejection as an actual submission attempt and redacts secrets', async () => {
    const secret = `0x${'11'.repeat(32)}`;
    const result = await captureLiveAttempt({
      kind: 'privacy-transfer-probe',
      command: `PRIVATE_KEY=${secret} bun run attempt`,
      environment: {}, now: clock(),
      execute: async (control) => {
        control.markRpcSubmission();
        throw Object.assign(new Error(`rpc rejected PRIVATE_KEY=${secret}`), { code: -32000 });
      }
    });
    expect(result.stateChangingTransactionAttempted).toBe(true);
    expect(result.error?.code).toBe(-32000);
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  test('redaction covers env assignments and bearer credentials', () => {
    expect(redactEvidenceText('COMPANY_PRIVATE_KEY=abc Authorization: Bearer REPLACE_TOKEN_123456')).toBe('COMPANY_PRIVATE_KEY=<redacted> Authorization: Bearer <redacted>');
    expect(safeError(new Error('safe failure')).message).toBe('safe failure');
    expect(safeError({ message: 'rpc failure', data: { amount: 1n } }).data).toBe('{"amount":"1"}');
  });
});
