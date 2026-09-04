#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ready as clairveilReady } from '../adapters/clairveil-local/index.ts';
import { DEFAULT_CLAIRVEIL_PATH, DEMO_ROOT, fail, optionalStringArg, parseArgs } from '../shared/io.ts';

interface ToolVersion {
  command: string;
  firstLine: string;
}

function version(command: string, args = ['--version']): ToolVersion {
  const child = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  if (child.error) throw new Error(`${command} is not available: ${child.error.message}`);
  if (child.status !== 0) {
    const detail = [child.stdout, child.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} version check exited ${child.status}${detail ? `: ${detail}` : ''}`);
  }
  const firstLine = child.stdout.trim().split(/\r?\n/)[0] ?? child.stderr.trim().split(/\r?\n/)[0] ?? '';
  if (!firstLine) throw new Error(`${command} version output is empty`);
  return { command, firstLine };
}

function requireBun14(): void {
  const [major = 0, minor = 0] = Bun.version.split('.').map(Number);
  if (major < 1 || (major === 1 && minor < 4)) {
    throw new Error(`Bun 1.4 or newer is required, got ${Bun.version}`);
  }
}

try {
  const args = parseArgs(process.argv.slice(2));
  const clairveil = resolve(optionalStringArg(args, 'clairveil') ?? DEFAULT_CLAIRVEIL_PATH);
  requireBun14();
  await Promise.all([
    access(join(DEMO_ROOT, 'package.json')),
    access(join(DEMO_ROOT, 'bun.lock')),
    access(join(DEMO_ROOT, '.env.example'))
  ]);
  const tools = {
    bun: { command: 'bun', firstLine: `bun ${Bun.version}` },
    git: version('git'),
    go: version('go', ['version']),
    anvil: version('anvil'),
    cast: version('cast'),
    forge: version('forge')
  };
  const clairveilResult = await clairveilReady({ ...args, clairveil });
  process.stdout.write(`${JSON.stringify({
    mode: 'workshop-environment-readiness',
    platform: `${process.platform}/${process.arch}`,
    tools,
    clairveil: {
      path: clairveilResult.result.clairveil,
      commit: clairveilResult.result.clairveilCommit
    },
    secretsRead: false,
    stateChangingTransaction: false
  }, null, 2)}\n`);
  process.stdout.write(`WORKSHOP ENVIRONMENT READY: Bun ${Bun.version}, Foundry suite, Go, Clairveil ${clairveilResult.result.clairveilCommit}\n`);
} catch (error) {
  fail(error);
}
