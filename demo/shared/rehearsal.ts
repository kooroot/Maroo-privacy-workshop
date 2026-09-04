import { createHash } from 'node:crypto';
import {
  BATCH_SELECTOR,
  DEPOSIT_SELECTOR,
  PRIVACY_PRECOMPILE,
  digest,
  validatePayrollPlan
} from './contracts.ts';
import type {
  AuditReport,
  DepositBundle,
  EmployeeScan,
  EvidenceSet,
  Hex,
  PayrollBatchBundle,
  PayrollOutput,
  PayrollPlan,
  Receipt
} from './types.ts';

export const OFFLINE_REHEARSAL_NOW = 2_000_000_000;

function hashHex(label: string): Hex {
  return `0x${createHash('sha256').update(label).digest('hex')}`;
}

export function buildOfflineEvidence(plan: PayrollPlan, now = OFFLINE_REHEARSAL_NOW): EvidenceSet & { fixtureDigest: string } {
  const { planDigest } = validatePayrollPlan(plan);
  const depositBundle: DepositBundle = {
    schema: 'maroo-workshop/prepared-transaction@1',
    label: '[Simulation]',
    kind: 'deposit',
    generatedBy: 'offline-rehearsal',
    broadcastable: false,
    chainId: 450815,
    to: PRIVACY_PRECOMPILE,
    valueWei: plan.totalBaseUnits,
    calldata: `${DEPOSIT_SELECTOR}${'00'.repeat(32)}`,
    planDigest,
    public: {
      noteCommitment: hashHex('treasury-note'),
      encryptedNoteDigest: hashHex('treasury-encrypted-note'),
      proofDigest: hashHex('deposit-proof')
    }
  };

  const outputs: PayrollOutput[] = plan.employees.map((employee, index) => ({
    index,
    employeeId: employee.id,
    profileRef: employee.profileRef,
    amountBaseUnits: employee.amountBaseUnits,
    commitment: hashHex(`output-${employee.id}`),
    ciphertextDigest: hashHex(`ciphertext-${employee.id}`)
  }));
  const batchBundle: PayrollBatchBundle = {
    schema: 'maroo-workshop/prepared-transaction@1',
    label: '[Simulation]',
    kind: 'payroll-batch',
    generatedBy: 'offline-rehearsal',
    broadcastable: false,
    chainId: 450815,
    to: PRIVACY_PRECOMPILE,
    valueWei: '0',
    calldata: `${BATCH_SELECTOR}${'00'.repeat(32)}`,
    planDigest,
    expiresAtUnix: now + 3600,
    public: {
      root: hashHex('root'),
      inputCount: 1,
      outputCount: 3,
      nullifierDigests: [hashHex('nullifier')],
      outputs,
      auditKeyId: 'workshop-auditor',
      auditKeyEpoch: 1,
      auditPayloadDigest: hashHex('audit-payload')
    }
  };

  const depositReceipt: Receipt = {
    schema: 'maroo-workshop/receipt@1',
    label: '[Simulation]',
    kind: 'deposit',
    planDigest,
    txHash: hashHex('deposit-tx'),
    status: '0x1',
    blockNumber: 101,
    event: {
      name: 'PrivacyDeposit',
      amountBaseUnits: plan.totalBaseUnits,
      noteCommitment: depositBundle.public.noteCommitment
    }
  };
  const batchReceipt: Receipt = {
    schema: 'maroo-workshop/receipt@1',
    label: '[Simulation]',
    kind: 'payroll-batch',
    planDigest,
    txHash: hashHex('batch-tx'),
    status: '0x1',
    blockNumber: 102,
    event: {
      name: 'PrivacySingleProofBatchTransfer',
      root: batchBundle.public.root,
      inputCount: 1,
      outputCount: 3
    }
  };
  const scans: EmployeeScan[] = plan.employees.map((employee, index) => ({
    schema: 'maroo-workshop/employee-scan@1',
    label: '[Simulation]',
    employeeId: employee.id,
    profileRef: employee.profileRef,
    planDigest,
    txHash: batchReceipt.txHash,
    status: 'owned',
    outputIndex: index,
    amountBaseUnits: employee.amountBaseUnits,
    commitment: outputs[index].commitment
  }));
  const audit: AuditReport = {
    schema: 'maroo-workshop/audit-report@1',
    label: '[Simulation]',
    status: 'verified',
    planDigest,
    txHash: batchReceipt.txHash,
    employeeIds: plan.employees.map((employee) => employee.id),
    totalBaseUnits: plan.totalBaseUnits,
    auditKeyId: batchBundle.public.auditKeyId,
    auditKeyEpoch: batchBundle.public.auditKeyEpoch,
    disclosureDigest: batchBundle.public.auditPayloadDigest
  };
  return { plan, depositBundle, batchBundle, depositReceipt, batchReceipt, scans, audit, fixtureDigest: digest({ planDigest, outputs }) };
}
