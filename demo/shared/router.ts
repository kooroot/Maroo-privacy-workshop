import type { AdapterMap, CliArgs, ExecutionResult, Target } from './types.ts';

export const TARGETS = Object.freeze(['maroo-testnet', 'clairveil-local'] as const);

export async function runTarget({
  target,
  action,
  args = { _: [] },
  adapters
}: {
  target: unknown;
  action: unknown;
  args?: CliArgs;
  adapters: AdapterMap;
}): Promise<ExecutionResult> {
  if (typeof target !== 'string' || !TARGETS.includes(target as Target)) {
    throw new Error(`--target must be one of: ${TARGETS.join(', ')}`);
  }
  const adapter = adapters[target as Target];
  if (!adapter || typeof adapter !== 'object') throw new Error(`adapter is not registered: ${target}`);
  if (typeof action !== 'string') throw new Error(`unsupported action for ${target}: <missing>`);
  const handler = adapter[action];
  if (typeof handler !== 'function') {
    throw new Error(`unsupported action for ${target}: ${action ?? '<missing>'}`);
  }
  return handler(args);
}
