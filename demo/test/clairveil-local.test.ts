import { describe, expect, it } from 'bun:test';
import {
  employeeScanEvidence,
  parseEnvironmentFile,
  publicBatchObservation
} from '../adapters/clairveil-local/distinct-payroll.ts';
import { validateLocalPayrollEvidence } from '../shared/local-evidence.ts';

describe('Clairveil distinct-employee runner', () => {
  it('parses the generated artifact checksum environment', () => {
    expect(parseEnvironmentFile('A=one\n# comment\nB=two\n')).toEqual({ A: 'one', B: 'two' });
  });

  it('rejects malformed artifact environment lines', () => {
    expect(() => parseEnvironmentFile('MISSING_SEPARATOR')).toThrow('invalid artifact environment line');
  });

  it('accepts exactly one employee note bound to the batch transaction', () => {
    const evidence = employeeScanEvidence({
      employee: { id: 'EMP-A', profile: 'employee-a', shieldedAddress: 'clairs1employeea' },
      before: { notes: [] },
      after: { notes: [{ tx_hash: 'ABC123', amount: '100', status: 'spendable' }] },
      txHash: 'abc123',
      amount: 100
    });
    expect(evidence).toMatchObject({
      employeeId: 'EMP-A',
      newNoteCount: 1,
      matchingBatchNoteCount: 1,
      receivedAmount: '100uclair'
    });
  });

  it('fails closed when the recipient scan is not bound to the batch transaction', () => {
    expect(() => employeeScanEvidence({
      employee: { id: 'EMP-B', profile: 'employee-b', shieldedAddress: 'clairs1employeeb' },
      before: { notes: [] },
      after: { notes: [{ tx_hash: 'different', amount: '2', status: 'spendable' }] },
      txHash: 'expected',
      amount: 2
    })).toThrow('scan did not prove exactly one');
  });

  it('separates public batch shape from private employee payroll values', () => {
    const observation = publicBatchObservation({
      height: '12',
      logs: [{ events: [{
        type: 'batch_transfer',
        attributes: [
          { key: 'input_count', value: '1' },
          { key: 'output_count', value: '3' },
          { key: 'commitment_root', value: 'commitment-root' },
          { key: 'nullifier_root', value: 'nullifier-root' }
        ]
      }] }]
    }, 'ABC123');
    expect(observation).toMatchObject({
      txHash: 'ABC123',
      inputCount: 1,
      outputCount: 3,
      plaintextEmployeeIdsObserved: false,
      plaintextAmountsObserved: false
    });
  });

  it('rejects a public event fixture that leaks payroll plaintext', () => {
    expect(() => publicBatchObservation({
      height: '12',
      events: [{
        type: 'batch_transfer',
        attributes: [
          { key: 'input_count', value: '1' },
          { key: 'output_count', value: '3' },
          { key: 'commitment_root', value: 'commitment-root' },
          { key: 'nullifier_root', value: 'nullifier-root' },
          { key: 'employee_id', value: 'EMP-B' }
        ]
      }]
    }, 'ABC123')).toThrow('unexpectedly exposes employee_id');
  });

  it('revalidates the committed actual local evidence', async () => {
    const evidence = await Bun.file(new URL('../../evidence/local/payroll-summary.json', import.meta.url)).json();
    expect(validateLocalPayrollEvidence(evidence)).toBe(evidence);
    expect(evidence.payrollAllocations).toEqual([
      { employeeId: 'EMP-A', amount: '100uclair' },
      { employeeId: 'EMP-B', amount: '120uclair' },
      { employeeId: 'EMP-C', amount: '80uclair' }
    ]);
    expect(evidence.employeeScans.map((scan: { receivedAmount: string }) => scan.receivedAmount)).toEqual([
      '100uclair', '120uclair', '80uclair'
    ]);
    expect(evidence.transactions.payrollBatch.proofArtifactDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(evidence.failureControls).toMatchObject({
      overspend: {
        requestedAmount: '301uclair',
        broadcastAttempted: false,
        treasuryStateUnchanged: true
      },
      wrongRecipient: {
        intendedEmployeeId: 'EMP-B',
        actualRecipientEmployeeId: 'EMP-C',
        chainOutcome: 'success',
        payrollOutcome: 'failed'
      }
    });
  });

  it('rejects a local evidence file with a duplicated employee profile', async () => {
    const evidence = structuredClone(await Bun.file(new URL('../../evidence/local/payroll-summary.json', import.meta.url)).json());
    evidence.employeeScans[2].profile = evidence.employeeScans[1].profile;
    expect(() => validateLocalPayrollEvidence(evidence)).toThrow('profiles must be distinct');
  });

  it('rejects a local allocation that differs from the 100/120/80 payroll plan', async () => {
    const evidence = structuredClone(await Bun.file(new URL('../../evidence/local/payroll-summary.json', import.meta.url)).json());
    evidence.payrollAllocations[1].amount = '119uclair';
    expect(() => validateLocalPayrollEvidence(evidence)).toThrow('EMP-B allocation must be 120uclair');
  });
});
