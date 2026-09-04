#!/usr/bin/env bun
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { validateEvidenceSet, validatePreparedTransaction } from '../shared/contracts.ts';
import { DEFAULT_PLAN_PATH, readJson, writeJson, fail, optionalStringArg, parseArgs } from '../shared/io.ts';
import { buildOfflineEvidence } from '../shared/rehearsal.ts';
import type { PayrollPlan } from '../shared/types.ts';

const args = parseArgs(process.argv.slice(2));

try {
  if (!args.offline) throw new Error('rehearsal is intentionally offline; pass --offline');
  const plan = await readJson<PayrollPlan>(optionalStringArg(args, 'plan') ?? DEFAULT_PLAN_PATH);
  const now = 2_000_000_000;
  const data = buildOfflineEvidence(plan, now);
  const outDir = optionalStringArg(args, 'out-dir');
  const temporary = !outDir;
  const workDir = temporary ? await mkdtemp(join(tmpdir(), 'maroo-workshop-rehearsal-')) : resolve(outDir);
  try {
    const files: Array<readonly [string, unknown]> = [
      ['payroll-plan.json', data.plan],
      ['deposit-bundle.json', data.depositBundle],
      ['payroll-bundle.json', data.batchBundle],
      ['deposit-receipt.json', data.depositReceipt],
      ['payroll-receipt.json', data.batchReceipt],
      ['scan-emp-a.json', data.scans[0]],
      ['scan-emp-b.json', data.scans[1]],
      ['scan-emp-c.json', data.scans[2]],
      ['audit-report.json', data.audit]
    ];
    await Promise.all(files.map(([name, value]) => writeJson(join(workDir, name), value)));
    validateEvidenceSet(data, { now });

    const badBatch = structuredClone(data.batchBundle);
    badBatch.public.outputCount = 2;
    let rejectedShape = false;
    try {
      validatePreparedTransaction(badBatch, plan, { now });
    } catch {
      rejectedShape = true;
    }
    if (!rejectedShape) throw new Error('negative control failed: two-output batch was accepted');

    let rejectedMissingScan = false;
    try {
      validateEvidenceSet({ ...data, scans: data.scans.slice(0, 2) }, { now });
    } catch {
      rejectedMissingScan = true;
    }
    if (!rejectedMissingScan) throw new Error('negative control failed: missing employee scan was accepted');

    const wrongRecipientBinding = structuredClone(data.batchBundle);
    const employeeBOutput = wrongRecipientBinding.public.outputs.find((output) => output.employeeId === 'EMP-B');
    const employeeC = plan.employees.find((employee) => employee.id === 'EMP-C');
    if (!employeeBOutput || !employeeC) throw new Error('recipient-binding control lacks EMP-B/EMP-C data');
    employeeBOutput.profileRef = employeeC.profileRef;
    let recipientBindingError = '';
    try {
      validatePreparedTransaction(wrongRecipientBinding, plan, { now });
    } catch (error) {
      recipientBindingError = error instanceof Error ? error.message : String(error);
    }
    if (!recipientBindingError.includes('output profileRef mismatch for EMP-B')) {
      throw new Error(`negative control failed: wrong EMP-B recipient binding was not rejected (${recipientBindingError || 'no error'})`);
    }
  } finally {
    if (temporary) await rm(workDir, { recursive: true, force: true });
  }
  process.stdout.write('MAROO ADAPTER RECIPIENT CONTROL PASSED: wrong EMP-B profile rejected before broadcast\n');
  process.stdout.write('OFFLINE REHEARSAL PASSED: deposit -> payroll -> employee scans -> audit\n');
} catch (error) {
  fail(error);
}
