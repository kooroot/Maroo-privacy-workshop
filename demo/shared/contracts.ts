import { createHash } from 'node:crypto';
import type {
  DepositBundle,
  EvidenceSet,
  Hex,
  PayrollBatchBundle,
  PayrollPlan,
  PreparedTransaction,
  Receipt
} from './types.ts';

export const LABELS = new Set(['[Live Testnet]', '[Local]', '[Simulation]', '[Docs Only]'] as const);
export const PRIVACY_PRECOMPILE = '0x100000000000000000000000000000000000000b';
export const CHAIN_ID = 450815;
export const DEPOSIT_SELECTOR = '0xe6eb7771';
export const BATCH_SELECTOR = '0x3bbb329b';
export const DEPOSIT_EVENT_TOPIC = '0xe94fdc798d990ba081f57f5497bc5502379cc0db08b512c87d808678e51787c2';
export const BATCH_EVENT_TOPIC = '0x6d05fa8aae795dcf34d91bd04ddbba7216fd2c617658871a5bd696edf53e3c35';

const PLAN_SCHEMA = 'maroo-workshop/payroll-plan@1';
const BUNDLE_SCHEMA = 'maroo-workshop/prepared-transaction@1';
const RECEIPT_SCHEMA = 'maroo-workshop/receipt@1';
const SCAN_SCHEMA = 'maroo-workshop/employee-scan@1';
const AUDIT_SCHEMA = 'maroo-workshop/audit-report@1';

interface ValidationOptions {
  now?: number;
  live?: boolean;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isDecimal(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value);
}

function isHex(value: unknown, byteLength?: number): value is Hex {
  if (typeof value !== 'string' || !/^0x(?:[0-9a-fA-F]{2})*$/.test(value)) return false;
  return byteLength === undefined || value.length === 2 + byteLength * 2;
}

function isHash(value: unknown): value is Hex {
  return isHex(value, 32);
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, stable(record[key])]));
  }
  return value;
}

export function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')}`;
}

export function inspectOkrwParamsResponse(data: string) {
  assert(isHex(data), 'OKRW getParams response is not valid ABI hex');
  const responseBytes = (data.length - 2) / 2;
  assert(responseBytes > 0, 'OKRW getParams response is empty');
  return {
    raw: data,
    responseBytes,
    observedShape: responseBytes === 32 ? 'address-only' : 'not-address-only'
  };
}

export function validatePayrollPlan(plan: PayrollPlan) {
  assert(plan?.schema === PLAN_SCHEMA, `plan.schema must be ${PLAN_SCHEMA}`);
  assert(typeof plan.batchId === 'string' && plan.batchId.length >= 8, 'plan.batchId is required');
  assert(plan.asset?.symbol === 'OKRW', 'plan asset must be OKRW');
  assert(plan.asset?.decimals === 18, 'plan asset decimals must be 18');
  assert(isDecimal(plan.totalBaseUnits) && BigInt(plan.totalBaseUnits) > 0n, 'plan totalBaseUnits must be positive decimal text');
  assert(Array.isArray(plan.employees) && plan.employees.length === 3, 'plan must contain exactly three employees');

  const ids = new Set();
  const profiles = new Set();
  let sum = 0n;
  for (const employee of plan.employees) {
    assert(/^EMP-[A-C]$/.test(employee.id), `unexpected employee id: ${employee.id}`);
    assert(!ids.has(employee.id), `duplicate employee id: ${employee.id}`);
    assert(typeof employee.profileRef === 'string' && employee.profileRef.startsWith('workshop-profile://'), `invalid profileRef for ${employee.id}`);
    assert(!profiles.has(employee.profileRef), `profileRef must be unique: ${employee.profileRef}`);
    assert(isDecimal(employee.amountBaseUnits) && BigInt(employee.amountBaseUnits) > 0n, `invalid amount for ${employee.id}`);
    ids.add(employee.id);
    profiles.add(employee.profileRef);
    sum += BigInt(employee.amountBaseUnits);
  }
  assert([...ids].sort().join(',') === 'EMP-A,EMP-B,EMP-C', 'plan must contain EMP-A, EMP-B, and EMP-C');
  assert(sum === BigInt(plan.totalBaseUnits), `employee sum ${sum} does not equal total ${plan.totalBaseUnits}`);
  return { planDigest: digest(plan), totalBaseUnits: plan.totalBaseUnits, employeeCount: 3 };
}

export function createParticipantPlan(basePlan: PayrollPlan, participant: number): PayrollPlan {
  validatePayrollPlan(basePlan);
  assert(Number.isInteger(participant) && participant >= 1 && participant <= 20, 'participant must be an integer from 1 through 20');
  const suffix = String(participant).padStart(2, '0');
  const plan = structuredClone(basePlan);
  plan.batchId = `COMPANY-P${suffix}-WORKSHOP-PAYROLL`;
  plan.employees = plan.employees.map((employee) => ({
    ...employee,
    profileRef: `workshop-profile://company-p${suffix}/${employee.id.toLowerCase()}`
  }));
  validatePayrollPlan(plan);
  return plan;
}

export function validatePreparedTransaction(
  bundle: PreparedTransaction,
  plan: PayrollPlan,
  { now = Math.floor(Date.now() / 1000), live = false }: ValidationOptions = {}
) {
  const planState = validatePayrollPlan(plan);
  assert(bundle?.schema === BUNDLE_SCHEMA, `bundle.schema must be ${BUNDLE_SCHEMA}`);
  assert(bundle.kind === 'deposit' || bundle.kind === 'payroll-batch', 'bundle.kind must be deposit or payroll-batch');
  assert(LABELS.has(bundle.label), `invalid evidence label: ${bundle.label}`);
  assert(bundle.planDigest === planState.planDigest, 'bundle planDigest does not match payroll plan');
  assert(bundle.chainId === CHAIN_ID, `bundle.chainId must be ${CHAIN_ID}`);
  assert(String(bundle.to).toLowerCase() === PRIVACY_PRECOMPILE, 'bundle target must be the Privacy precompile');
  assert(isDecimal(bundle.valueWei), 'bundle.valueWei must be decimal text');
  assert(isHex(bundle.calldata) && bundle.calldata.length > 10, 'bundle.calldata must be non-empty even-length hex');
  assert(typeof bundle.generatedBy === 'string' && bundle.generatedBy.length > 0, 'bundle.generatedBy is required');
  assert(typeof bundle.broadcastable === 'boolean', 'bundle.broadcastable must be boolean');

  if (live) {
    assert(bundle.label === '[Live Testnet]', 'broadcast requires [Live Testnet] label');
    assert(bundle.broadcastable === true, 'broadcast requires broadcastable=true from the compatible adapter');
    assert(bundle.generatedBy !== 'offline-rehearsal', 'offline rehearsal bundle cannot be broadcast');
  }

  if (bundle.kind === 'deposit') {
    assert(bundle.calldata.slice(0, 10).toLowerCase() === DEPOSIT_SELECTOR, `deposit calldata selector must be ${DEPOSIT_SELECTOR}`);
    assert(bundle.valueWei === plan.totalBaseUnits, 'deposit valueWei must equal payroll total');
    assert(isHex(bundle.public?.noteCommitment, 32), 'deposit noteCommitment must be 32 bytes');
    assert(isHash(bundle.public?.encryptedNoteDigest), 'deposit encryptedNoteDigest must be bytes32');
    assert(isHash(bundle.public?.proofDigest), 'deposit proofDigest must be bytes32');
  } else {
    assert(bundle.calldata.slice(0, 10).toLowerCase() === BATCH_SELECTOR, `payroll calldata selector must be ${BATCH_SELECTOR}`);
    assert(bundle.valueWei === '0', 'payroll batch must not attach msg.value');
    assert(Number.isInteger(bundle.public?.inputCount) && bundle.public.inputCount >= 1 && bundle.public.inputCount <= 16, 'batch inputCount must be 1..16');
    assert(bundle.public?.outputCount === 3, 'batch outputCount must be 3');
    assert(isHex(bundle.public?.root, 32), 'batch root must be 32 bytes');
    assert(Array.isArray(bundle.public?.nullifierDigests) && bundle.public.nullifierDigests.length === bundle.public.inputCount, 'nullifierDigests must match inputCount');
    assert(bundle.public.nullifierDigests.every(isHash), 'every nullifier digest must be bytes32');
    assert(Array.isArray(bundle.public?.outputs) && bundle.public.outputs.length === 3, 'batch must expose three output bindings');
    const expected = new Map(plan.employees.map((employee) => [employee.id, employee]));
    const indexes = new Set();
    for (const output of bundle.public.outputs) {
      const employee = expected.get(output.employeeId);
      assert(employee, `unknown output employee: ${output.employeeId}`);
      assert(Number.isInteger(output.index) && output.index >= 0 && output.index < 3, `invalid output index for ${output.employeeId}`);
      assert(!indexes.has(output.index), `duplicate output index: ${output.index}`);
      assert(output.profileRef === employee.profileRef, `output profileRef mismatch for ${output.employeeId}`);
      assert(output.amountBaseUnits === employee.amountBaseUnits, `output amount mismatch for ${output.employeeId}`);
      assert(isHex(output.commitment, 32), `output commitment must be 32 bytes for ${output.employeeId}`);
      assert(isHash(output.ciphertextDigest), `ciphertextDigest must be bytes32 for ${output.employeeId}`);
      indexes.add(output.index);
      expected.delete(output.employeeId);
    }
    assert(expected.size === 0 && indexes.size === 3, 'every employee must map to one distinct output');
    assert(typeof bundle.public.auditKeyId === 'string' && bundle.public.auditKeyId.length > 0, 'auditKeyId is required');
    assert(Number.isInteger(bundle.public.auditKeyEpoch) && bundle.public.auditKeyEpoch >= 1, 'auditKeyEpoch must be positive');
    assert(isHash(bundle.public.auditPayloadDigest), 'auditPayloadDigest must be bytes32');
    assert(Number.isInteger(bundle.expiresAtUnix) && bundle.expiresAtUnix > now + 60, 'batch request is expired or has less than 60 seconds remaining');
  }
  return { kind: bundle.kind, selector: bundle.calldata.slice(0, 10), planDigest: planState.planDigest };
}

export function validateEvidenceSet(
  { plan, depositBundle, batchBundle, depositReceipt, batchReceipt, scans, audit }: EvidenceSet,
  options: ValidationOptions = {}
) {
  const { planDigest } = validatePayrollPlan(plan);
  const preparedOptions = options.live ? { ...options, now: 0 } : options;
  validatePreparedTransaction(depositBundle, plan, preparedOptions);
  validatePreparedTransaction(batchBundle, plan, preparedOptions);
  assert(depositBundle.kind === 'deposit' && batchBundle.kind === 'payroll-batch', 'evidence requires deposit and payroll-batch bundles');

  validateReceipt(depositReceipt, { kind: 'deposit', planDigest, bundle: depositBundle });
  validateReceipt(batchReceipt, { kind: 'payroll-batch', planDigest, bundle: batchBundle });
  assert(Array.isArray(scans) && scans.length === 3, 'exactly three employee scans are required');
  const expected = new Map(plan.employees.map((employee) => [employee.id, employee]));
  const outputByEmployee = new Map(batchBundle.public.outputs.map((output) => [output.employeeId, output]));
  for (const scan of scans) {
    assert(scan?.schema === SCAN_SCHEMA, `scan.schema must be ${SCAN_SCHEMA}`);
    assert(LABELS.has(scan.label), `invalid scan label: ${scan.label}`);
    assert(scan.planDigest === planDigest, `scan planDigest mismatch for ${scan.employeeId}`);
    assert(scan.txHash === batchReceipt.txHash, `scan txHash mismatch for ${scan.employeeId}`);
    assert(scan.status === 'owned', `scan status must be owned for ${scan.employeeId}`);
    const employee = expected.get(scan.employeeId);
    const output = outputByEmployee.get(scan.employeeId);
    assert(employee && output, `unexpected or duplicate scan employee: ${scan.employeeId}`);
    assert(scan.profileRef === employee.profileRef, `scan profileRef mismatch for ${scan.employeeId}`);
    assert(scan.amountBaseUnits === employee.amountBaseUnits, `scan amount mismatch for ${scan.employeeId}`);
    assert(scan.outputIndex === output.index, `scan output index mismatch for ${scan.employeeId}`);
    assert(scan.commitment === output.commitment, `scan commitment mismatch for ${scan.employeeId}`);
    expected.delete(scan.employeeId);
  }
  assert(expected.size === 0, `missing employee scans: ${[...expected.keys()].join(', ')}`);

  assert(audit?.schema === AUDIT_SCHEMA, `audit.schema must be ${AUDIT_SCHEMA}`);
  assert(LABELS.has(audit.label), `invalid audit label: ${audit.label}`);
  assert(audit.status === 'verified', 'audit status must be verified');
  assert(audit.planDigest === planDigest, 'audit planDigest mismatch');
  assert(audit.txHash === batchReceipt.txHash, 'audit txHash mismatch');
  assert(audit.totalBaseUnits === plan.totalBaseUnits, 'audit total mismatch');
  assert(audit.auditKeyId === batchBundle.public.auditKeyId && audit.auditKeyEpoch === batchBundle.public.auditKeyEpoch, 'audit key binding mismatch');
  assert(audit.disclosureDigest === batchBundle.public.auditPayloadDigest, 'audit disclosure digest mismatch');
  assert(Array.isArray(audit.employeeIds) && [...audit.employeeIds].sort().join(',') === 'EMP-A,EMP-B,EMP-C', 'audit must cover all three employees');

  if (options.live) {
    const labels = [depositBundle.label, batchBundle.label, depositReceipt.label, batchReceipt.label, ...scans.map((scan) => scan.label), audit.label];
    assert(labels.every((label) => label === '[Live Testnet]'), 'live evidence set must use [Live Testnet] on every artifact');
  }

  return { planDigest, depositTxHash: depositReceipt.txHash, batchTxHash: batchReceipt.txHash, employeeScans: 3, auditStatus: 'verified' };
}

function validateReceipt(
  receipt: Receipt,
  { kind, planDigest, bundle }: {
    kind: PreparedTransaction['kind'];
    planDigest: string;
    bundle: DepositBundle | PayrollBatchBundle;
  }
) {
  assert(receipt?.schema === RECEIPT_SCHEMA, `receipt.schema must be ${RECEIPT_SCHEMA}`);
  assert(receipt.kind === kind, `receipt kind must be ${kind}`);
  assert(LABELS.has(receipt.label), `invalid receipt label: ${receipt.label}`);
  assert(receipt.planDigest === planDigest, `receipt planDigest mismatch for ${kind}`);
  assert(isHash(receipt.txHash), `receipt txHash must be bytes32 for ${kind}`);
  assert(receipt.status === '0x1', `receipt status must be 0x1 for ${kind}`);
  assert(Number.isInteger(receipt.blockNumber) && receipt.blockNumber >= 1, `receipt blockNumber must be positive for ${kind}`);
  if (kind === 'deposit') {
    assert(bundle.kind === 'deposit', 'deposit receipt requires a deposit bundle');
    assert(receipt.event?.name === 'PrivacyDeposit', 'deposit event must be PrivacyDeposit');
    assert(receipt.event.noteCommitment === bundle.public.noteCommitment, 'deposit event commitment mismatch');
    assert(receipt.event.amountBaseUnits === bundle.valueWei, 'deposit event amount mismatch');
  } else {
    assert(bundle.kind === 'payroll-batch', 'batch receipt requires a payroll-batch bundle');
    assert(receipt.event?.name === 'PrivacySingleProofBatchTransfer', 'batch event name mismatch');
    assert(receipt.event.inputCount === bundle.public.inputCount, 'batch event inputCount mismatch');
    assert(receipt.event.outputCount === 3, 'batch event outputCount must be 3');
    assert(receipt.event.root === bundle.public.root, 'batch event root mismatch');
  }
}

export const SCHEMAS = { PLAN_SCHEMA, BUNDLE_SCHEMA, RECEIPT_SCHEMA, SCAN_SCHEMA, AUDIT_SCHEMA };
