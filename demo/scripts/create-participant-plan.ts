#!/usr/bin/env bun
import { createParticipantPlan, validatePayrollPlan } from '../shared/contracts.ts';
import { DEFAULT_PLAN_PATH, fail, optionalStringArg, parseArgs, readJson, requiredStringArg, writeJson } from '../shared/io.ts';
import type { PayrollPlan } from '../shared/types.ts';

const args = parseArgs(process.argv.slice(2));

try {
  const base = await readJson<PayrollPlan>(optionalStringArg(args, 'base') ?? DEFAULT_PLAN_PATH);
  if (args.all) {
    const outDir = requiredStringArg(args, 'out-dir');
    for (let participant = 1; participant <= 20; participant += 1) {
      const plan = createParticipantPlan(base, participant);
      const suffix = String(participant).padStart(2, '0');
      await writeJson(`${outDir}/participant-${suffix}-payroll-plan.json`, plan);
      process.stdout.write(`PARTICIPANT PLAN CREATED: ${plan.batchId} ${validatePayrollPlan(plan).planDigest}\n`);
    }
  } else {
    const participant = requiredStringArg(args, 'participant');
    const out = requiredStringArg(args, 'out');
    const plan = createParticipantPlan(base, Number(participant));
    const { planDigest } = validatePayrollPlan(plan);
    await writeJson(out, plan);
    process.stdout.write(`PARTICIPANT PLAN CREATED: ${plan.batchId} ${planDigest}\n`);
  }
} catch (error) {
  fail(error);
}
