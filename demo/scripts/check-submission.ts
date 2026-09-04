#!/usr/bin/env bun
import { execFileSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { secretCategories, validateLiveAttemptEvidence } from '../shared/submission.ts';
import { validateLocalPayrollEvidence } from '../shared/local-evidence.ts';
import type { LiveAttemptEvidence, LocalPayrollEvidence } from '../shared/types.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const mode = process.argv[2];
const final = mode === '--final';
const liveEvidencePath = 'evidence/live-testnet/state-change-attempt.json';

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function read(path: string): Promise<string> {
  return readFile(resolve(root, path), 'utf8');
}

function git(args: string[], maxBuffer = 100 * 1024 * 1024): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer });
}

async function assertStructure(): Promise<void> {
  const required = [
    'README.md', 'LICENSE', 'SUBMISSION_NOTES.md', 'video-link.md',
    'workshop/curriculum.md', 'workshop/participant-guide.md',
    'workshop/facilitator-guide.md', 'workshop/troubleshooting.md', 'workshop/exit-ticket.md',
    'demo/README.md', 'demo/.env.example', 'demo/bun.lock',
    'demo/scripts/run.ts', 'demo/scripts/check-workshop-environment.ts',
    'demo/shared/live-attempt.ts',
    'demo/shared/local-evidence.ts', 'evidence/README.md', 'evidence/local/payroll-summary.json',
    'evidence/live-testnet/state-change-attempt.json'
  ];
  await Promise.all(required.map((path) => access(resolve(root, path))));
  const [readme, notes, video, troubleshooting, curriculum, participantGuide, facilitatorGuide, demoGuide] = await Promise.all([
    read('README.md'), read('SUBMISSION_NOTES.md'), read('video-link.md'),
    read('workshop/troubleshooting.md'), read('workshop/curriculum.md'), read('workshop/participant-guide.md'),
    read('workshop/facilitator-guide.md'), read('demo/README.md')
  ]);

  for (const phrase of ['Primary Track B', '시니어 백엔드·블록체인 엔지니어', 'Quick start', 'Walkthrough Video', 'Testnet transaction/evidence', 'Source provenance와 license', 'Clairveil provenance', 'Known limitations']) {
    invariant(readme.includes(phrase), `README missing shared-deliverable phrase: ${phrase}`);
  }
  invariant(readme.includes('### 2.1 공통 제출물') && readme.includes('### 2.2 Track B 필수 결과물'), 'README must separate common and Track B deliverables');
  for (const deliverable of ['공개 소스 리포지토리', '`README.md`', '`SUBMISSION_NOTES.md`', 'Video']) {
    invariant(readme.includes(deliverable), `README missing common deliverable mapping: ${deliverable}`);
  }
  for (const deliverable of ['Runnable Demo', 'Live Testnet Evidence', '60~75분 Workshop Package', 'Troubleshooting Guide', 'Validation', 'Walkthrough Video']) {
    invariant(readme.includes(deliverable), `README missing Track B deliverable mapping: ${deliverable}`);
  }
  for (const heading of ['## 1. Assumptions / Discrepancies', '## 2. Validation', '## 3. AI Usage', '## 4. DX Feedback', '## 5. Known Limitations']) {
    invariant(notes.includes(heading), `SUBMISSION_NOTES missing ${heading}`);
  }
  invariant((notes.match(/^\| S\d+ /gm) ?? []).length >= 2, 'AI Usage needs at least two acceleration examples');
  invariant((notes.match(/^\| E\d+ /gm) ?? []).length >= 1, 'AI Usage needs at least one AI error and fix');
  invariant((notes.match(/^\| DX\d+ /gm) ?? []).length >= 3, 'DX Feedback needs at least three items');
  invariant(notes.includes('영향 사용자') && notes.includes('제안 owner'), 'DX Feedback needs impacted users and proposed owner');
  invariant((troubleshooting.match(/^### T\d+\./gm) ?? []).length >= 5, 'Troubleshooting needs at least five errors');
  for (const section of troubleshooting.split(/(?=^### T\d+\.)/gm).slice(1)) {
    const id = section.match(/^### (T\d+)\./)?.[1] ?? 'unknown';
    for (const field of ['**증상:**', '**원인:**', '**확인:**', '**해결:**']) {
      invariant(section.includes(field), `${id} missing ${field}`);
    }
  }
  invariant(troubleshooting.includes('대체') && troubleshooting.includes('진행자'), 'Troubleshooting needs facilitator outage alternative');
  invariant(video.includes('00:00–00:35') && video.includes('06:05–07:00'), 'video run sheet must cover 5–8 minutes');
  for (const requirement of ['학습 목표와 성과', '사전 요구 사항과 준비 상태', '토론 질문', '종료 후 다음 단계']) {
    invariant(curriculum.includes(requirement), `curriculum missing Track B workshop requirement: ${requirement}`);
  }
  invariant(curriculum.includes('Maroo Testnet이 항상 우선'), 'curriculum must prioritize Maroo Testnet');
  invariant(participantGuide.includes('Success criteria') && facilitatorGuide.includes('중단 기준'), 'participant/facilitator success criteria missing');
  invariant(participantGuide.includes('--target clairveil-local --action payroll') && participantGuide.includes('CLAIRVEIL LOCAL PAYROLL AND FAILURE CONTROLS VERIFIED'), 'workshop package must execute the canonical Clairveil x/privacy local payroll and controls');
  for (const document of [curriculum, participantGuide, facilitatorGuide]) {
    invariant(document.includes('anvil --version') && document.includes('cast --version') && document.includes('forge --version'), 'workshop package must include the complete Foundry environment readiness check');
  }
  invariant(!participantGuide.includes('anvil --host'), 'workshop must not allocate participant time to a generic Anvil exercise');
  invariant(readme.includes('Clairveil 구현 참고 실습'), 'Clairveil must be positioned as hands-on implementation reference');
  invariant(demoGuide.includes('## 3. Clean start') && demoGuide.includes('reset-evidence.ts'), 'Validation must document clean start and evidence reset');
  const localEvidence = validateLocalPayrollEvidence(JSON.parse(await read('evidence/local/payroll-summary.json')) as LocalPayrollEvidence);
  invariant(localEvidence.stateChangingTransaction === true, 'Clairveil evidence must contain actual local state changes');
  invariant(localEvidence.proofCount === 1 && localEvidence.transactions.payrollBatch.outputCount === 3, 'Clairveil evidence must prove a one-proof three-output payroll');
  invariant(localEvidence.employeeScans.length === 3, 'Clairveil evidence must contain EMP-A/B/C scans');
}

async function assertNoSecrets(): Promise<void> {
  const paths = git(['ls-files', '-co', '--exclude-standard', '-z']).split('\0').filter(Boolean);
  const findings: string[] = [];
  for (const path of paths) {
    const absolute = resolve(root, path);
    if (!absolute.startsWith(`${root}${sep}`)) continue;
    let buffer: Buffer;
    try {
      buffer = await readFile(absolute);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    if (buffer.length > 5 * 1024 * 1024 || buffer.includes(0)) continue;
    for (const category of secretCategories(buffer.toString('utf8'))) findings.push(`${path}: ${category}`);
  }
  const history = git(['log', '--all', '-p', '--no-ext-diff', '--format=commit:%H']);
  for (const category of secretCategories(history)) findings.push(`git-history: ${category}`);
  invariant(findings.length === 0, `secret candidates detected (values suppressed):\n${findings.join('\n')}`);
}

function tableValue(document: string, label: string): string {
  const row = document.split(/\r?\n/).find((line) => {
    const cells = line.split('|').map((cell) => cell.trim());
    return cells[1] === label;
  });
  invariant(row, `video-link.md missing ${label} row`);
  return row.split('|').map((cell) => cell.trim())[2] ?? '';
}

try {
  invariant(mode === '--draft' || mode === '--final', 'usage: check-submission.ts <--draft|--final>');
  await assertStructure();
  await assertNoSecrets();
  const evidence = JSON.parse(await read(liveEvidencePath)) as LiveAttemptEvidence;
  const issues = validateLiveAttemptEvidence(evidence);
  invariant(issues.length === 0, issues.join('\n'));
  const readme = await read('README.md');
  invariant(readme.includes(liveEvidencePath), 'README does not expose live attempt evidence');
  for (const operation of ['deposit', 'transfer'] as const) {
    const probe = evidence.probes?.[operation];
    invariant(probe?.txHash && probe.explorerUrl, `live ${operation} probe is missing public transaction evidence`);
    invariant(readme.includes(probe.explorerUrl), `README does not expose the live ${operation} explorer URL`);
  }
  if (final) {
    const video = await read('video-link.md');
    const url = tableValue(video, 'URL').match(/https:\/\/[^\s<>|]+/)?.[0];
    const durationSeconds = Number(tableValue(video, '길이').match(/\d+/)?.[0]);
    const visibility = tableValue(video, '공개 설정');
    const recordedCommit = tableValue(video, '녹화 commit');
    invariant(url, 'video-link.md must contain an https video URL');
    invariant(Number.isInteger(durationSeconds) && durationSeconds >= 300 && durationSeconds <= 480, 'video length must be 300 to 480 seconds');
    invariant(visibility === 'public' || visibility === 'unlisted', 'video visibility must be public or unlisted');
    invariant(/^[0-9a-f]{40}$/i.test(recordedCommit), 'recorded commit must be a 40-hex git commit');
    try {
      git(['cat-file', '-e', `${recordedCommit}^{commit}`]);
      execFileSync('git', ['merge-base', '--is-ancestor', recordedCommit, 'HEAD'], { cwd: root, stdio: 'ignore' });
    } catch {
      throw new Error('recorded commit must exist in this repository and be an ancestor of HEAD');
    }
    const notes = await read('SUBMISSION_NOTES.md');
    invariant(readme.includes(url), 'README does not expose the video URL');
    invariant(readme.includes(liveEvidencePath), 'README does not expose live attempt evidence');
    invariant(notes.includes(liveEvidencePath) && notes.includes(String(evidence.outcome)), 'SUBMISSION_NOTES live attempt summary is not finalized');
    process.stdout.write('FINAL SUBMISSION CHECK PASSED: links, evidence, requirements, and secret scan\n');
  } else {
    process.stdout.write('DRAFT SUBMISSION CHECK PASSED: structure and live evidence complete; video metadata pending\n');
  }
} catch (error) {
  process.stderr.write(`ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
