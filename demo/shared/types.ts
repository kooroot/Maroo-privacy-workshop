export type EvidenceLabel = '[Live Testnet]' | '[Local]' | '[Simulation]' | '[Docs Only]';
export type Target = 'maroo-testnet' | 'clairveil-local';
export type Hex = `0x${string}`;
export type EmployeeId = 'EMP-A' | 'EMP-B' | 'EMP-C';

export interface CliArgs {
  _?: string[];
  [key: string]: string | boolean | string[] | undefined;
}

export type Environment = Record<string, string | undefined>;

export interface PayrollEmployee {
  id: EmployeeId;
  amountBaseUnits: string;
  profileRef: string;
}

export interface PayrollPlan {
  schema: 'maroo-workshop/payroll-plan@1';
  batchId: string;
  asset: { symbol: 'OKRW'; decimals: 18 };
  totalBaseUnits: string;
  employees: PayrollEmployee[];
}

export interface DepositPublicData {
  noteCommitment: Hex;
  encryptedNoteDigest: Hex;
  proofDigest: Hex;
}

export interface PayrollOutput {
  index: number;
  employeeId: EmployeeId;
  profileRef: string;
  amountBaseUnits: string;
  commitment: Hex;
  ciphertextDigest: Hex;
}

export interface BatchPublicData {
  root: Hex;
  inputCount: number;
  outputCount: number;
  nullifierDigests: Hex[];
  outputs: PayrollOutput[];
  auditKeyId: string;
  auditKeyEpoch: number;
  auditPayloadDigest: Hex;
}

interface PreparedTransactionBase {
  schema: 'maroo-workshop/prepared-transaction@1';
  label: EvidenceLabel;
  generatedBy: string;
  broadcastable: boolean;
  chainId: number;
  to: Hex;
  valueWei: string;
  calldata: Hex;
  planDigest: string;
}

export interface DepositBundle extends PreparedTransactionBase {
  kind: 'deposit';
  public: DepositPublicData;
}

export interface PayrollBatchBundle extends PreparedTransactionBase {
  kind: 'payroll-batch';
  expiresAtUnix: number;
  public: BatchPublicData;
}

export type PreparedTransaction = DepositBundle | PayrollBatchBundle;

export interface Receipt {
  schema: 'maroo-workshop/receipt@1';
  label: EvidenceLabel;
  kind: PreparedTransaction['kind'];
  planDigest: string;
  txHash: Hex;
  status: '0x1';
  blockNumber: number;
  event: {
    name: 'PrivacyDeposit' | 'PrivacySingleProofBatchTransfer';
    amountBaseUnits?: string;
    noteCommitment?: Hex;
    root?: Hex;
    inputCount?: number;
    outputCount?: number;
  };
}

export interface EmployeeScan {
  schema: 'maroo-workshop/employee-scan@1';
  label: EvidenceLabel;
  employeeId: EmployeeId;
  profileRef: string;
  planDigest: string;
  txHash: Hex;
  status: 'owned';
  outputIndex: number;
  amountBaseUnits: string;
  commitment: Hex;
}

export interface AuditReport {
  schema: 'maroo-workshop/audit-report@1';
  label: EvidenceLabel;
  status: 'verified';
  planDigest: string;
  txHash: Hex;
  employeeIds: EmployeeId[];
  totalBaseUnits: string;
  auditKeyId: string;
  auditKeyEpoch: number;
  disclosureDigest: Hex;
}

export interface EvidenceSet {
  plan: PayrollPlan;
  depositBundle: DepositBundle;
  batchBundle: PayrollBatchBundle;
  depositReceipt: Receipt;
  batchReceipt: Receipt;
  scans: EmployeeScan[];
  audit: AuditReport;
}

export interface ExecutionResult<T = unknown> {
  marker: string;
  result: T;
}

export type AdapterHandler = (args: CliArgs) => Promise<ExecutionResult>;
export type Adapter = Record<string, AdapterHandler>;
export type AdapterMap = Record<Target, Adapter>;

export interface LiveAttemptEvidence {
  schema?: string;
  label?: string;
  utc?: string;
  completedUtc?: string;
  kind?: string;
  outcome?: string;
  stage?: string;
  stateChangingTransactionAttempted?: boolean;
  assignmentAttemptCandidate?: boolean;
  reproductionCommand?: string;
  environment?: Record<string, unknown>;
  txHash?: string;
  explorerUrl?: string;
  receiptStatus?: string;
  error?: { message?: string; [key: string]: unknown };
  probe?: { operation?: string; target?: string; [key: string]: unknown };
  probes?: { deposit?: LiveAttemptEvidence; transfer?: LiveAttemptEvidence };
  [key: string]: unknown;
}

export interface LocalEmployeeScan {
  employeeId: EmployeeId;
  profile: string;
  recipientAddressDigest: string;
  beforeNoteCount: number;
  afterNoteCount: number;
  newNoteCount: number;
  matchingBatchNoteCount: number;
  receivedAmount: string;
}

export interface LocalPublicObservation {
  txHash: string;
  height: string;
  eventType: 'batch_transfer';
  inputCount: number;
  outputCount: number;
  attributeNames: string[];
  plaintextEmployeeIdsObserved: false;
  plaintextAmountsObserved: false;
}

export interface LocalOverspendControl {
  classification: 'privacy-resource-rejection';
  availableAmount: '300uclair';
  requestedAmount: '301uclair';
  rejectedAt: 'wallet-input-selection-before-proof';
  broadcastAttempted: false;
  error: string;
  treasuryNoteCountBefore: number;
  treasuryNoteCountAfter: number;
  treasuryStateUnchanged: true;
}

export interface LocalWrongRecipientControl {
  classification: 'business-intent-failure';
  intendedEmployeeId: 'EMP-B';
  actualRecipientEmployeeId: 'EMP-C';
  amount: '120uclair';
  setupDepositTxHash: string;
  transferTxHash: string;
  transferCode: 0;
  intendedEmployeeNewNoteCount: 0;
  actualRecipientNewNoteCount: 1;
  actualRecipientMatchingNoteCount: 1;
  chainOutcome: 'success';
  payrollOutcome: 'failed';
}

export interface LocalPayrollEvidence {
  schema: string;
  label: string;
  utc: string;
  clairveilCommit: string;
  workflow: string;
  asset: string;
  payrollItemCount: number;
  payrollAllocations: Array<{ employeeId: EmployeeId; amount: string }>;
  payrollTotal: string;
  distinctRecipientCount: number;
  proofCount: number;
  transactionEnvelopeCount: number;
  transactions: {
    deposit: { txHash: string; height: string; code: number; amount: string };
    payrollBatch: {
      txHash: string;
      height: string;
      code: number;
      payloadHash: string;
      proofArtifactDigest: string;
      inputCount: number;
      outputCount: number;
    };
  };
  employeeScans: LocalEmployeeScan[];
  observationComparison: {
    publicObserver: LocalPublicObservation;
    employeeObservers: Array<Pick<LocalEmployeeScan, 'employeeId' | 'receivedAmount' | 'matchingBatchNoteCount'>>;
  };
  failureControls: {
    overspend: LocalOverspendControl;
    wrongRecipient: LocalWrongRecipientControl;
  };
  finalPayrollStatus: string;
  stateChangingTransaction: boolean;
  boundary: string;
}
