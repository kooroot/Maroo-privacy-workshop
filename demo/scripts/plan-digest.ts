#!/usr/bin/env bun
import { validatePayrollPlan } from '../shared/contracts.ts';
import { fail, parseArgs, readJson, requiredStringArg } from '../shared/io.ts';
import type { PayrollPlan } from '../shared/types.ts';

const args = parseArgs(process.argv.slice(2));

try {
  const planPath = requiredStringArg(args, 'plan');
  const result = validatePayrollPlan(await readJson<PayrollPlan>(planPath));
  process.stdout.write(`${result.planDigest}\n`);
} catch (error) {
  fail(error);
}
