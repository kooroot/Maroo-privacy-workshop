import { afterAll, describe, it } from 'bun:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  BATCH_SELECTOR,
  createParticipantPlan,
  inspectOkrwParamsResponse,
  DEPOSIT_SELECTOR,
  digest,
  validateEvidenceSet,
  validatePayrollPlan,
  validatePreparedTransaction
} from '../shared/contracts.ts';
import { DEFAULT_PLAN_PATH } from '../shared/io.ts';
import { buildOfflineEvidence } from '../shared/rehearsal.ts';
import type { PayrollPlan } from '../shared/types.ts';

const plan = JSON.parse(await readFile(DEFAULT_PLAN_PATH, 'utf8'));
const now = 2_000_000_000;

describe('payroll plan', () => {
  it('binds three unique employees to a 300 OKRW total', () => {
    const result = validatePayrollPlan(plan);
    assert.equal(result.employeeCount, 3);
    assert.equal(result.totalBaseUnits, '300000000000000000000');
    assert.equal(result.planDigest, digest(plan));
  });

  it('rejects a total that does not equal employee allocations', () => {
    const bad = structuredClone(plan);
    bad.totalBaseUnits = '301000000000000000000';
    assert.throws(() => validatePayrollPlan(bad), /does not equal total/);
  });

  it('rejects a reused shielded profile', () => {
    const bad = structuredClone(plan);
    bad.employees[1].profileRef = bad.employees[0].profileRef;
    assert.throws(() => validatePayrollPlan(bad), /profileRef must be unique/);
  });

  it('creates a distinct plan for each individual participant', () => {
    const participant01 = createParticipantPlan(plan, 1);
    const participant20 = createParticipantPlan(plan, 20);
    assert.equal(participant01.batchId, 'COMPANY-P01-WORKSHOP-PAYROLL');
    assert.equal(participant20.batchId, 'COMPANY-P20-WORKSHOP-PAYROLL');
    assert.notEqual(participant01.employees[0].profileRef, participant20.employees[0].profileRef);
    assert.notEqual(digest(participant01), digest(participant20));
    assert.throws(() => createParticipantPlan(plan, 21), /participant must be an integer from 1 through 20/);
  });
});

describe('OKRW ABI decoding', () => {
  it('classifies an address-only response without claiming tuple compatibility', () => {
    const address = '1234567890abcdef1234567890abcdef12345678';
    const encoded = `0x${address.padStart(64, '0')}`;
    assert.deepEqual(inspectOkrwParamsResponse(encoded), {
      raw: encoded,
      responseBytes: 32,
      observedShape: 'address-only'
    });
  });
});

describe('prepared transaction contract', () => {
  const data = buildOfflineEvidence(plan, now);

  it('accepts deposit and 1-input/3-output payroll bundles', () => {
    assert.equal(validatePreparedTransaction(data.depositBundle, plan, { now }).selector, DEPOSIT_SELECTOR);
    assert.equal(validatePreparedTransaction(data.batchBundle, plan, { now }).selector, BATCH_SELECTOR);
  });

  it('rejects an expired payroll request', () => {
    const bad = structuredClone(data.batchBundle);
    bad.expiresAtUnix = now;
    assert.throws(() => validatePreparedTransaction(bad, plan, { now }), /expired/);
  });

  it('rejects a two-output batch', () => {
    const bad = structuredClone(data.batchBundle);
    bad.public.outputCount = 2;
    assert.throws(() => validatePreparedTransaction(bad, plan, { now }), /outputCount must be 3/);
  });

  it('rejects an employee output bound to the wrong profile', () => {
    const bad = structuredClone(data.batchBundle);
    bad.public.outputs[1].profileRef = bad.public.outputs[0].profileRef;
    assert.throws(() => validatePreparedTransaction(bad, plan, { now }), /profileRef mismatch/);
  });

  it('prevents an offline fixture from entering the live broadcast path', () => {
    assert.throws(() => validatePreparedTransaction(data.batchBundle, plan, { now, live: true }), /broadcast requires/);
  });
});

describe('evidence reconciliation', () => {
  const data = buildOfflineEvidence(plan, now);

  it('reconciles deposit, batch, three scans, and audit report', () => {
    const result = validateEvidenceSet(data, { now });
    assert.equal(result.employeeScans, 3);
    assert.equal(result.auditStatus, 'verified');
  });

  it('rejects a missing employee scan', () => {
    assert.throws(() => validateEvidenceSet({ ...data, scans: data.scans.slice(1) }, { now }), /three employee scans/);
  });

  it('rejects a scan bound to the wrong commitment', () => {
    const scans = structuredClone(data.scans);
    scans[0].commitment = `0x${'ff'.repeat(32)}`;
    assert.throws(() => validateEvidenceSet({ ...data, scans }, { now }), /commitment mismatch/);
  });

  it('rejects an audit report with the wrong total', () => {
    const audit = structuredClone(data.audit);
    audit.totalBaseUnits = '299000000000000000000';
    assert.throws(() => validateEvidenceSet({ ...data, audit }, { now }), /audit total mismatch/);
  });
});

afterAll(() => process.stdout.write('WORKSHOP CONTRACT TESTS PASSED\n'));
