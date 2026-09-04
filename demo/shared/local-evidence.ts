import type { LocalPayrollEvidence } from './types.ts';

export const LOCAL_PAYROLL_SCHEMA = 'maroo-workshop/local-payroll-evidence@5' as const;
export const CLAIRVEIL_PAYROLL_ALLOCATIONS = Object.freeze([
  { employeeId: 'EMP-A', profile: 'employee-a', amount: 100 },
  { employeeId: 'EMP-B', profile: 'employee-b', amount: 120 },
  { employeeId: 'EMP-C', profile: 'employee-c', amount: 80 }
] as const);

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function validateLocalPayrollEvidence(evidence: LocalPayrollEvidence): LocalPayrollEvidence {
  invariant(evidence?.schema === LOCAL_PAYROLL_SCHEMA, `local evidence schema must be ${LOCAL_PAYROLL_SCHEMA}`);
  invariant(evidence.label === '[Local]', 'local evidence label must be [Local]');
  invariant(evidence.workflow === 'clairveil-distinct-employee-one-proof-batch', 'local evidence workflow is invalid');
  invariant(evidence.asset === 'uclair', 'local evidence asset must be uclair');
  invariant(evidence.payrollItemCount === 3 && evidence.distinctRecipientCount === 3, 'local payroll must contain three distinct recipients');
  invariant(evidence.payrollTotal === '300uclair', 'local payroll total must be 300uclair');
  invariant(evidence.proofCount === 1 && evidence.transactionEnvelopeCount === 1, 'local payroll must use one proof and one batch transaction');
  invariant(evidence.finalPayrollStatus === 'Confirmed' && evidence.stateChangingTransaction === true, 'local payroll is not confirmed');
  invariant(/^[0-9a-f]{40}$/i.test(evidence.clairveilCommit ?? ''), 'local evidence needs a 40-hex Clairveil commit');

  const { deposit, payrollBatch } = evidence.transactions ?? {};
  invariant(/^[0-9a-f]{64}$/i.test(deposit?.txHash ?? '') && deposit.code === 0, 'local deposit transaction is invalid');
  invariant(deposit.amount === evidence.payrollTotal, 'local deposit amount does not equal payroll total');
  invariant(/^[0-9a-f]{64}$/i.test(payrollBatch?.txHash ?? '') && payrollBatch.code === 0, 'local payroll transaction is invalid');
  invariant(payrollBatch.inputCount === 1 && payrollBatch.outputCount === 3, 'local payroll must prove one input and three outputs');
  invariant(/^[0-9a-f]{64}$/i.test(payrollBatch.payloadHash ?? ''), 'local payroll payload hash is invalid');
  invariant(/^sha256:[0-9a-f]{64}$/i.test(payrollBatch.proofArtifactDigest ?? ''), 'local payroll proof artifact digest is invalid');

  invariant(Array.isArray(evidence.payrollAllocations) && evidence.payrollAllocations.length === 3, 'local evidence needs three payroll allocations');
  for (const expected of CLAIRVEIL_PAYROLL_ALLOCATIONS) {
    const allocation = evidence.payrollAllocations.find((entry) => entry.employeeId === expected.employeeId);
    invariant(allocation?.amount === `${expected.amount}uclair`, `${expected.employeeId} allocation must be ${expected.amount}uclair`);
  }

  invariant(Array.isArray(evidence.employeeScans) && evidence.employeeScans.length === 3, 'local evidence needs three employee scans');
  const expectedEmployees = ['EMP-A', 'EMP-B', 'EMP-C'];
  const employeeIds = evidence.employeeScans.map((scan) => scan.employeeId).sort();
  invariant(employeeIds.join(',') === expectedEmployees.join(','), 'local employee IDs must be EMP-A/B/C');
  invariant(new Set(evidence.employeeScans.map((scan) => scan.profile)).size === 3, 'local employee profiles must be distinct');
  invariant(new Set(evidence.employeeScans.map((scan) => scan.recipientAddressDigest)).size === 3, 'local recipient address digests must be distinct');
  for (const scan of evidence.employeeScans) {
    const expected = CLAIRVEIL_PAYROLL_ALLOCATIONS.find((entry) => entry.employeeId === scan.employeeId);
    invariant(expected, `${scan.employeeId} is not a canonical payroll employee`);
    invariant(/^sha256:[0-9a-f]{64}$/i.test(scan.recipientAddressDigest ?? ''), `${scan.employeeId} recipient digest is invalid`);
    invariant(scan.newNoteCount === 1 && scan.matchingBatchNoteCount === 1, `${scan.employeeId} scan is not bound to exactly one batch note`);
    invariant(scan.receivedAmount === `${expected.amount}uclair`, `${scan.employeeId} amount does not match the payroll allocation`);
  }

  const publicObserver = evidence.observationComparison?.publicObserver;
  invariant(publicObserver?.txHash === payrollBatch.txHash && publicObserver.height === payrollBatch.height, 'public observation must identify the payroll batch');
  invariant(publicObserver.eventType === 'batch_transfer', 'public observation must use the batch_transfer event');
  invariant(publicObserver.inputCount === 1 && publicObserver.outputCount === 3, 'public observation must expose the one-input/three-output shape');
  invariant(Array.isArray(publicObserver.attributeNames) && publicObserver.attributeNames.includes('commitment_root'), 'public observation must expose commitment_root');
  invariant(publicObserver.attributeNames.includes('nullifier_root'), 'public observation must expose nullifier_root');
  invariant(publicObserver.plaintextEmployeeIdsObserved === false && publicObserver.plaintextAmountsObserved === false, 'public event must not claim plaintext payroll fields');
  invariant(evidence.observationComparison.employeeObservers?.length === 3, 'private employee observation must contain three scans');
  for (const expected of CLAIRVEIL_PAYROLL_ALLOCATIONS) {
    const observation = evidence.observationComparison.employeeObservers.find((entry) => entry.employeeId === expected.employeeId);
    invariant(observation?.receivedAmount === `${expected.amount}uclair` && observation.matchingBatchNoteCount === 1, `${expected.employeeId} private observation is invalid`);
  }

  const overspend = evidence.failureControls?.overspend;
  invariant(overspend?.classification === 'privacy-resource-rejection', 'overspend must be classified as a Privacy resource rejection');
  invariant(overspend.availableAmount === '300uclair' && overspend.requestedAmount === '301uclair', 'overspend control must request one more unit than the treasury note');
  invariant(overspend.rejectedAt === 'wallet-input-selection-before-proof' && overspend.broadcastAttempted === false, 'overspend must fail before proof and broadcast');
  invariant(overspend.error.includes('selected inputs do not fund batch payment total 301uclair'), 'overspend evidence lacks the expected Clairveil error');
  invariant(overspend.treasuryNoteCountBefore === overspend.treasuryNoteCountAfter && overspend.treasuryStateUnchanged === true, 'overspend rejection changed the treasury note state');

  const wrongRecipient = evidence.failureControls?.wrongRecipient;
  invariant(wrongRecipient?.classification === 'business-intent-failure', 'wrong recipient must be classified as a business-intent failure');
  invariant(wrongRecipient.intendedEmployeeId === 'EMP-B' && wrongRecipient.actualRecipientEmployeeId === 'EMP-C', 'wrong-recipient control must substitute EMP-C for EMP-B');
  invariant(wrongRecipient.amount === '120uclair', 'wrong-recipient control amount must be 120uclair');
  invariant(/^[0-9a-f]{64}$/i.test(wrongRecipient.setupDepositTxHash) && /^[0-9a-f]{64}$/i.test(wrongRecipient.transferTxHash), 'wrong-recipient control transaction hashes are invalid');
  invariant(wrongRecipient.transferCode === 0 && wrongRecipient.chainOutcome === 'success', 'wrong-recipient transaction must succeed on chain');
  invariant(wrongRecipient.intendedEmployeeNewNoteCount === 0, 'intended EMP-B must receive no new note in the wrong-recipient control');
  invariant(wrongRecipient.actualRecipientNewNoteCount === 1 && wrongRecipient.actualRecipientMatchingNoteCount === 1, 'actual EMP-C recipient must receive exactly one matching note');
  invariant(wrongRecipient.payrollOutcome === 'failed', 'wrong-recipient control must fail the payroll intent');
  invariant(String(evidence.boundary ?? '').includes('without Maroo OKRW'), 'local evidence must preserve the Maroo boundary');
  return evidence;
}
