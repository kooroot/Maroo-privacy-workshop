#!/usr/bin/env bun
import { validatePreparedTransaction } from '../shared/contracts.ts';
import { fail, parseArgs, readJson, requiredStringArg } from '../shared/io.ts';
import type { PayrollPlan, PreparedTransaction } from '../shared/types.ts';

const args = parseArgs(process.argv.slice(2));

try {
  const plan = await readJson<PayrollPlan>(requiredStringArg(args, 'plan'));
  const bundle = await readJson<PreparedTransaction>(requiredStringArg(args, 'bundle'));
  const result = validatePreparedTransaction(bundle, plan, { live: Boolean(args.live) });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\nREQUEST VALIDATED: ${result.kind}\n`);
} catch (error) {
  fail(error);
}
