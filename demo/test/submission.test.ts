import { describe, expect, test } from 'bun:test';
import { secretCategories, validateLiveAttemptEvidence } from '../shared/submission.ts';
import type { LiveAttemptEvidence } from '../shared/types.ts';

const rejectedBundle: LiveAttemptEvidence = {
  schema: 'maroo-workshop/live-state-change-attempt@1',
  label: '[Live Testnet]',
  kind: 'privacy-bundle',
  stateChangingTransactionAttempted: true,
  assignmentAttemptCandidate: true,
  utc: '2026-09-04T00:00:00Z',
  reproductionCommand: 'bun run attempt',
  environment: { chainId: 450815 },
  outcome: 'rejected',
  stage: 'rpc-broadcast',
  error: { message: 'rpc rejected' }
};

const includedRevertProbe = (operation: 'deposit' | 'transfer'): LiveAttemptEvidence => ({
  schema: 'maroo-workshop/live-state-change-attempt@1',
  label: '[Live Testnet]',
  kind: `privacy-${operation}-probe`,
  stateChangingTransactionAttempted: true,
  assignmentAttemptCandidate: true,
  utc: '2026-09-04T00:00:00Z',
  reproductionCommand: 'bun run attempt',
  environment: { chainId: 450815 },
  outcome: 'included-revert',
  stage: 'receipt-collected',
  txHash: `0x${operation === 'deposit' ? 'a' : 'b'}${'0'.repeat(63)}`,
  explorerUrl: `https://example.test/tx/${operation}`,
  receiptStatus: 'reverted',
  probe: {
    operation,
    target: '0x100000000000000000000000000000000000000b'
  }
});

const probeSequence: LiveAttemptEvidence = {
  ...rejectedBundle,
  kind: 'privacy-deposit-transfer-probes',
  outcome: 'probe-sequence-complete',
  probes: {
    deposit: includedRevertProbe('deposit'),
    transfer: includedRevertProbe('transfer')
  }
};

describe('submission evidence contract', () => {
  test('accepts complete RPC rejection evidence as the assignment permits', () => {
    expect(validateLiveAttemptEvidence(rejectedBundle)).toEqual([]);
  });

  test('accepts an included-revert deposit and transfer sequence', () => {
    expect(validateLiveAttemptEvidence(probeSequence)).toEqual([]);
  });

  test('rejects a missing transfer probe', () => {
    const missingTransfer = structuredClone(probeSequence);
    if (!missingTransfer.probes) throw new Error('probe sequence fixture is missing probes');
    delete missingTransfer.probes.transfer;
    expect(validateLiveAttemptEvidence(missingTransfer).join('\n')).toContain('privacy transfer probe evidence is missing');
  });

  test('rejects evidence that did not invoke RPC submission', () => {
    expect(validateLiveAttemptEvidence({ ...rejectedBundle, stateChangingTransactionAttempted: false }).join('\n'))
      .toContain('does not record');
  });

  test('rejects a transaction still pending receipt classification', () => {
    expect(validateLiveAttemptEvidence({ ...rejectedBundle, outcome: 'submitted' }).join('\n'))
      .toContain('outcome must be');
  });

  test('detects actual-looking secrets but not documented placeholders', () => {
    expect(secretCategories(`COMPANY_PRIVATE_KEY=0x${'12'.repeat(32)}`)).toEqual(['private-key']);
    expect(secretCategories('COMPANY_PRIVATE_KEY=REPLACE_WITH_COMPANY_TESTNET_PRIVATE_KEY')).toEqual([]);
  });

  test('detects common credential formats without flagging placeholders', () => {
    expect(secretCategories(`API_KEY=${'a'.repeat(24)}`)).toContain('secret-assignment');
    expect(secretCategories(['ghp_', 'b'.repeat(36)].join(''))).toContain('github-token');
    expect(secretCategories(['AKIA', 'C'.repeat(16)].join(''))).toContain('aws-access-key');
    expect(secretCategories('API_KEY=REPLACE_WITH_TEST_API_KEY')).toEqual([]);
  });
});
