import type { LiveAttemptEvidence } from './types.ts';

export function validateLiveAttemptEvidence(evidence?: LiveAttemptEvidence): string[] {
  const issues: string[] = [];
  if (!evidence) return ['live attempt evidence file is missing or invalid'];

  if (evidence.schema !== 'maroo-workshop/live-state-change-attempt@1') issues.push('live attempt evidence schema is invalid');
  if (evidence.label !== '[Live Testnet]') issues.push('live attempt label must be [Live Testnet]');
  if (!['privacy-bundle', 'privacy-deposit-transfer-probes'].includes(evidence.kind ?? '')) issues.push('live attempt kind must be privacy-bundle or privacy-deposit-transfer-probes');
  if (evidence.stateChangingTransactionAttempted !== true || evidence.assignmentAttemptCandidate !== true) issues.push('live evidence does not record an RPC state-change submission attempt');
  if (!evidence.utc || !evidence.reproductionCommand || !evidence.environment) issues.push('live evidence lacks UTC, reproduction command, or environment');
  if (evidence.environment?.chainId !== 450815) issues.push('live evidence chainId must be 450815');

  const validateTerminal = (terminal: LiveAttemptEvidence, label: string): void => {
    if (!['included-success', 'included-revert', 'rejected'].includes(terminal.outcome ?? '')) {
      issues.push(`${label} outcome must be included-success, included-revert, or rejected`);
      return;
    }
    if (terminal.outcome === 'included-success' || terminal.outcome === 'included-revert') {
      if (!/^0x[0-9a-f]{64}$/i.test(terminal.txHash ?? '') || !/^https:\/\//.test(terminal.explorerUrl ?? '')) {
        issues.push(`included ${label} needs txHash and explorerUrl`);
      }
      const expectedReceipt = terminal.outcome === 'included-success' ? 'success' : 'reverted';
      if (terminal.receiptStatus !== expectedReceipt) issues.push(`${label} receiptStatus must be ${expectedReceipt}`);
      return;
    }
    if (!['rpc-broadcast', 'receipt-wait'].includes(terminal.stage ?? '')) issues.push(`rejected ${label} stage must be rpc-broadcast or receipt-wait`);
    if (!terminal.error?.message) issues.push(`rejected ${label} needs the captured error`);
  };

  if (evidence.kind === 'privacy-deposit-transfer-probes') {
    if (evidence.outcome !== 'probe-sequence-complete') issues.push('privacy probe sequence outcome must be probe-sequence-complete');
    for (const operation of ['deposit', 'transfer'] as const) {
      const probe = evidence.probes?.[operation];
      if (probe?.schema !== 'maroo-workshop/live-state-change-attempt@1' || probe?.kind !== `privacy-${operation}-probe`) {
        issues.push(`privacy ${operation} probe evidence is missing or invalid`);
        continue;
      }
      if (probe.probe?.operation !== operation || probe.probe?.target?.toLowerCase() !== '0x100000000000000000000000000000000000000b') {
        issues.push(`privacy ${operation} probe target or operation is invalid`);
      }
      if (probe.stateChangingTransactionAttempted !== true) issues.push(`privacy ${operation} probe did not invoke RPC submission`);
      validateTerminal(probe, `privacy ${operation} probe`);
    }
  } else {
    validateTerminal(evidence, 'live evidence');
  }
  return issues;
}

const SECRET_CANDIDATES: ReadonlyArray<readonly [string, RegExp]> = [
  ['private-key', /\b(?:COMPANY_)?PRIVATE_KEY\s*=\s*(?:0x)?[0-9a-fA-F]{64}\b/g],
  ['private-key-field', /\b(?:private[_-]?key|secret[_-]?key)\b["']?\s*[:=]\s*["']?(?:0x)?[0-9a-fA-F]{64}\b/gi],
  ['secret-assignment', /\b(?:API_KEY|API_TOKEN|ACCESS_TOKEN|CLIENT_SECRET|PASSWORD)\s*[:=]\s*["']?(?!(?:REPLACE|CHANGE_ME|YOUR_|<redacted>|<[^>]+>))[A-Za-z0-9._~+\/=:-]{16,}/gi],
  ['bearer-token', /Authorization:\s*Bearer\s+(?!<redacted>|REPLACE)[A-Za-z0-9._~+\/-]{16,}/gi],
  ['mnemonic', /\b(?:MNEMONIC|SEED_PHRASE)\s*=\s*["']?(?!REPLACE)(?:[a-z]+\s+){11,23}[a-z]+/gi],
  ['pem-private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g],
  ['openai-token', /\bsk-[A-Za-z0-9_-]{20,}\b/g],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g],
  ['url-credentials', /https?:\/\/[^/\s:@]+:[^/\s@]+@/gi]
];

export function secretCategories(document: string): string[] {
  return SECRET_CANDIDATES.filter(([, pattern]) => {
    pattern.lastIndex = 0;
    return pattern.test(document);
  }).map(([category]) => category);
}
