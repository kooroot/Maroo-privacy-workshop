#!/usr/bin/env bun
import { mkdir, readdir, realpath, rename } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail, parseArgs } from '../shared/io.ts';

const args = parseArgs(process.argv.slice(2));
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const evidenceRoot = join(root, 'evidence');
const activeNames = ['live-testnet', 'local', 'simulation', 'run'];

try {
  const realEvidence = await realpath(evidenceRoot);
  if (realEvidence !== evidenceRoot) throw new Error('evidence root must not be a symlink');
  const moves = [];
  for (const name of activeNames) {
    const directory = join(evidenceRoot, name);
    await mkdir(directory, { recursive: true });
    if (await realpath(directory) !== directory) throw new Error(`${name} must not be a symlink`);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      moves.push({ source: join(directory, entry.name), section: name, name: entry.name });
    }
  }
  if (moves.length === 0) {
    process.stdout.write('RESET PREVIEW: no active evidence files\n');
    process.exit(0);
  }
  process.stdout.write(`RESET PREVIEW: ${moves.length} active evidence entries\n`);
  for (const move of moves) process.stdout.write(`- evidence/${move.section}/${move.name}\n`);
  if (!args.apply) {
    process.stdout.write('No files moved. Re-run with --apply to archive these entries.\n');
    process.exit(0);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archive = join(evidenceRoot, 'archive', stamp);
  for (const move of moves) {
    const destination = join(archive, move.section, move.name);
    await mkdir(dirname(destination), { recursive: true });
    await rename(move.source, destination);
  }
  process.stdout.write(`EVIDENCE ARCHIVED: evidence/archive/${stamp}\n`);
} catch (error) {
  fail(error);
}
