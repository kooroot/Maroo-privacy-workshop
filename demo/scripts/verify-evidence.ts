#!/usr/bin/env bun
import { validateEvidenceSet } from '../shared/contracts.ts';
import { fail, optionalStringArg, parseArgs, readJson, requiredStringArg, writeJson } from '../shared/io.ts';
import type { AuditReport, DepositBundle, EmployeeScan, PayrollBatchBundle, PayrollPlan, Receipt } from '../shared/types.ts';

const args = parseArgs(process.argv.slice(2));

try {
  const scanPaths = requiredStringArg(args, 'scans').split(',').filter(Boolean);
  if (scanPaths.length !== 3) throw new Error('--scans requires exactly three comma-separated files');
  const result = validateEvidenceSet({
    plan: await readJson<PayrollPlan>(requiredStringArg(args, 'plan')),
    depositBundle: await readJson<DepositBundle>(requiredStringArg(args, 'deposit-bundle')),
    batchBundle: await readJson<PayrollBatchBundle>(requiredStringArg(args, 'batch-bundle')),
    depositReceipt: await readJson<Receipt>(requiredStringArg(args, 'deposit-receipt')),
    batchReceipt: await readJson<Receipt>(requiredStringArg(args, 'batch-receipt')),
    scans: await Promise.all(scanPaths.map((path) => readJson<EmployeeScan>(path))),
    audit: await readJson<AuditReport>(requiredStringArg(args, 'audit'))
  }, { live: Boolean(args.live) });
  const index = { schema: 'maroo-workshop/evidence-index@1', utc: new Date().toISOString(), ...result };
  const out = optionalStringArg(args, 'out');
  if (out) await writeJson(out, index);
  process.stdout.write(`${JSON.stringify(index, null, 2)}\nEVIDENCE VERIFIED: deposit + 3 employee outputs + audit\n`);
} catch (error) {
  fail(error);
}
