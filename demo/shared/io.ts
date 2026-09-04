import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CliArgs, Environment } from './types.ts';

export const DEMO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = resolve(DEMO_ROOT, '..');
export const DEFAULT_PLAN_PATH = join(DEMO_ROOT, 'fixtures/payroll-plan.json');
export const DEFAULT_ENV_PATH = join(DEMO_ROOT, '.env');
export const DEFAULT_ENV_EXAMPLE_PATH = join(DEMO_ROOT, '.env.example');
export const DEFAULT_CLAIRVEIL_PATH = resolve(REPO_ROOT, '../clairveil');

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (!token.startsWith('--')) {
      args._!.push(token);
      continue;
    }
    const [rawKey, inlineValue] = token.slice(2).split('=', 2);
    if (!rawKey) throw new Error(`invalid argument: ${token}`);
    if (inlineValue !== undefined) {
      args[rawKey] = inlineValue;
    } else if (argv[index + 1] && !argv[index + 1]!.startsWith('--')) {
      args[rawKey] = argv[index + 1]!;
      index += 1;
    } else {
      args[rawKey] = true;
    }
  }
  return args;
}

export function optionalStringArg(args: CliArgs, key: string): string | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`--${key} requires a value`);
  return value;
}

export function requiredStringArg(args: CliArgs, key: string): string {
  const value = optionalStringArg(args, key);
  if (!value) throw new Error(`missing --${key}`);
  return value;
}

export async function readJson<T = unknown>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(path), 'utf8')) as T;
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

export async function loadEnv(path: string): Promise<Environment> {
  const text = await readFile(resolve(path), 'utf8');
  const result: Environment = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) throw new Error(`invalid env line: ${rawLine}`);
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

export function mergeEnvironment(fileValues: Environment): Environment {
  return { ...fileValues, ...process.env };
}

export function fail(message: unknown): void {
  process.stderr.write(`ERROR: ${message instanceof Error ? message.message : String(message)}\n`);
  process.exitCode = 1;
}
