#!/usr/bin/env bun
import { marooTestnetAdapter } from '../adapters/maroo-testnet/index.ts';
import { clairveilLocalAdapter } from '../adapters/clairveil-local/index.ts';
import { fail, optionalStringArg, parseArgs, writeJson } from '../shared/io.ts';
import { runTarget } from '../shared/router.ts';
import type { AdapterMap } from '../shared/types.ts';

const args = parseArgs(process.argv.slice(2));
const adapters: AdapterMap = Object.freeze({
  'maroo-testnet': marooTestnetAdapter,
  'clairveil-local': clairveilLocalAdapter
});

try {
  const execution = await runTarget({ target: args.target, action: args.action, args, adapters });
  const out = optionalStringArg(args, 'out');
  if (out) await writeJson(out, execution.result);
  process.stdout.write(`${JSON.stringify(execution.result, null, 2)}\n${execution.marker}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
