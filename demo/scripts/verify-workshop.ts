#!/usr/bin/env bun
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePayrollPlan } from '../shared/contracts.ts';
import { validateLocalPayrollEvidence } from '../shared/local-evidence.ts';
import { validateLiveAttemptEvidence } from '../shared/submission.ts';
import type { LiveAttemptEvidence, LocalPayrollEvidence, PayrollPlan } from '../shared/types.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const mode = process.argv[2];
const agenda = ['00–07', '07–17', '17–27', '27–44', '44–52', '52–63', '63–69', '69–75'];
const coreDocs = [
  'README.md',
  'SUBMISSION_NOTES.md',
  'demo/README.md',
  'demo/adapter-contract.md',
  'docs/architecture.md',
  'docs/testnet-reference.md',
  'workshop/curriculum.md',
  'workshop/participant-guide.md',
  'workshop/facilitator-guide.md',
  'workshop/troubleshooting.md'
];
const requiredFiles = [
  ...coreDocs,
  'LICENSE',
  'demo/.env.example',
  'demo/package.json',
  'demo/tsconfig.json',
  'demo/fixtures/payroll-plan.json',
  'demo/shared/contracts.ts',
  'demo/shared/io.ts',
  'demo/shared/local-evidence.ts',
  'demo/shared/rehearsal.ts',
  'demo/shared/router.ts',
  'demo/shared/submission.ts',
  'demo/shared/types.ts',
  'demo/adapters/maroo-testnet/index.ts',
  'demo/adapters/clairveil-local/index.ts',
  'demo/adapters/clairveil-local/distinct-payroll.ts',
  'demo/scripts/run.ts',
  'demo/scripts/check-workshop-environment.ts',
  'demo/scripts/plan-digest.ts',
  'demo/scripts/create-participant-plan.ts',
  'demo/scripts/validate-request.ts',
  'demo/scripts/verify-evidence.ts',
  'demo/scripts/rehearse.ts',
  'demo/scripts/reset-evidence.ts',
  'demo/scripts/check-submission.ts',
  'demo/scripts/verify-workshop.ts',
  'demo/test/contracts.test.ts',
  'demo/test/clairveil-local.test.ts',
  'demo/test/live-attempt.test.ts',
  'demo/test/router.test.ts',
  'demo/test/submission.test.ts',
  'video-link.md',
  'workshop/exit-ticket.md',
  'evidence/README.md',
  'evidence/local/payroll-summary.json',
  'evidence/live-testnet/state-change-attempt.json'
];

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function text(path: string): Promise<string> {
  return readFile(resolve(root, path), 'utf8');
}

function canonicalAgenda(document: string, path: string): void {
  const block = document.match(/<!-- workshop-agenda:start -->([\s\S]*?)<!-- workshop-agenda:end -->/)?.[1];
  invariant(block, `${path}: canonical workshop agenda block missing`);
  const found = [...block.matchAll(/(\d{2})[–-](\d{2})/g)].map((match) => `${match[1]}–${match[2]}`);
  invariant(found.join(',') === agenda.join(','), `${path}: agenda must be ${agenda.join(', ')}, got ${found.join(', ')}`);
  let previous = 0;
  for (const item of found) {
    const [start = Number.NaN, end = Number.NaN] = item.split('–').map(Number);
    invariant(start === previous && end > start, `${path}: agenda is not contiguous at ${item}`);
    previous = end;
  }
  invariant(previous === 75, `${path}: agenda does not end at 75 minutes`);
}

async function verifyContent() {
  for (const path of requiredFiles) await access(resolve(root, path));
  const docs: Record<string, string> = Object.fromEntries(await Promise.all(coreDocs.map(async (path) => [path, await text(path)])));
  const environmentChecker = await text('demo/scripts/check-workshop-environment.ts');
  for (const path of ['workshop/curriculum.md', 'workshop/participant-guide.md', 'workshop/facilitator-guide.md']) {
    canonicalAgenda(docs[path], path);
  }
  const curriculum = docs['workshop/curriculum.md'];
  for (const heading of ['## 1. 페르소나', '## 2. 시나리오와 역할', '## 3. 학습 목표와 성과', '## 8. 종료 후 다음 단계']) {
    invariant(curriculum.includes(heading), `curriculum missing ${heading}`);
  }
  for (const outcome of ['O1', 'O2', 'O3', 'O4', 'O5', 'O6']) {
    invariant(curriculum.includes(`**${outcome}`), `curriculum missing ${outcome}`);
    invariant(docs['workshop/participant-guide.md'].includes(outcome), `participant guide missing ${outcome}`);
  }
  const plan = JSON.parse(await text('demo/fixtures/payroll-plan.json')) as PayrollPlan;
  validatePayrollPlan(plan);
  validateLocalPayrollEvidence(JSON.parse(await text('evidence/local/payroll-summary.json')) as LocalPayrollEvidence);
  invariant(docs['workshop/participant-guide.md'].includes('singleProofBatchTransfer'), 'participant guide must execute singleProofBatchTransfer');
  invariant(docs['workshop/participant-guide.md'].includes('EMP-A·B·C scanner report 3개'), 'participant guide must require three employee scan reports');
  invariant(docs['workshop/facilitator-guide.md'].includes('Maroo live 준비 게이트'), 'facilitator guide must contain the live readiness gate');
  invariant(docs['demo/README.md'].includes('--target clairveil-local --action payroll'), 'demo runbook must expose the explicit Clairveil local payroll command');
  invariant(docs['workshop/participant-guide.md'].includes('--target clairveil-local --action payroll'), 'participant guide must execute the Clairveil local payroll command');
  invariant(docs['workshop/participant-guide.md'].includes('CLAIRVEIL LOCAL PAYROLL AND FAILURE CONTROLS VERIFIED'), 'participant guide must expose the Clairveil payroll/control success marker');
  invariant(docs['workshop/participant-guide.md'].includes('300uclair') && docs['workshop/participant-guide.md'].includes('100/120/80uclair'), 'participant guide must use the canonical local payroll allocation');
  for (const command of ['anvil --version', 'cast --version', 'forge --version', 'check-workshop-environment.ts']) {
    for (const path of ['workshop/curriculum.md', 'workshop/participant-guide.md', 'workshop/facilitator-guide.md']) {
      invariant(docs[path].includes(command), `${path} must check ${command}`);
    }
  }
  invariant(!docs['workshop/participant-guide.md'].includes('anvil --host'), 'participant guide must not spend workshop time on an Anvil chain exercise');
  invariant(!docs['workshop/participant-guide.md'].includes('--item-count') && !docs['workshop/participant-guide.md'].includes('--amount 2'), 'obsolete uniform local payroll arguments remain');
  invariant(environmentChecker.includes('secretsRead: false') && environmentChecker.includes('stateChangingTransaction: false'), 'environment checker must disclose its non-secret, non-state-changing boundary');
  invariant(docs['demo/adapter-contract.md'].includes('broadcastable'), 'adapter contract must document the broadcast boundary');
  const troubleshootingCount = (docs['workshop/troubleshooting.md'].match(/^### T\d+\./gm) ?? []).length;
  invariant(troubleshootingCount >= 8, `troubleshooting guide needs at least 8 errors, got ${troubleshootingCount}`);
  const troubleshootingSections = docs['workshop/troubleshooting.md'].split(/(?=^### T\d+\.)/gm).slice(1);
  for (const section of troubleshootingSections) {
    const id = section.match(/^### (T\d+)\./)?.[1] ?? 'unknown';
    for (const field of ['**증상:**', '**원인:**', '**확인:**', '**해결:**']) {
      invariant(section.includes(field), `${id} missing ${field}`);
    }
  }
  const env = await text('demo/.env.example');
  invariant(env.includes('COMPANY_ACCOUNT=0xREPLACE_WITH_COMPANY_TESTNET_ADDRESS'), '.env.example must request a public company account');
  invariant(env.includes('COMPANY_PRIVATE_KEY=REPLACE_WITH_COMPANY_TESTNET_PRIVATE_KEY'), '.env.example must request a testnet-only company signer');
  invariant(env.includes('EMPLOYEE_ACCOUNT=0xREPLACE_WITH_EMPLOYEE_TESTNET_ADDRESS'), '.env.example must request a distinct public employee account');
  invariant(!/(?:COMPANY_)?PRIVATE_KEY=0x[0-9a-fA-F]{64}/.test(env), '.env.example contains a private key-shaped value');
  const soloWorkshopText = [
    docs['README.md'],
    docs['SUBMISSION_NOTES.md'],
    docs['demo/README.md'],
    docs['workshop/curriculum.md'],
    docs['workshop/participant-guide.md'],
    docs['workshop/facilitator-guide.md']
  ].join('\n');
  const soloForbidden: ReadonlyArray<readonly [RegExp, string]> = [
    [/2인\s*1조/, 'pair-based workshop wording'],
    [/\bDriver\s*[/·]\s*Verifier\b/i, 'paired Driver/Verifier role wording'],
    [/(?:Driver|Verifier)\s*역할/i, 'paired role assignment wording'],
    [/create-team-plan/, 'obsolete team-plan command']
  ];
  for (const [pattern, label] of soloForbidden) invariant(!pattern.test(soloWorkshopText), `${label} remains`);
  invariant(curriculum.includes('1인 1환경'), 'curriculum must require individual completion');
  invariant(docs['workshop/participant-guide.md'].includes('한 사람이 자기 checkout'), 'participant guide must assign the full flow to each participant');
  invariant(docs['workshop/facilitator-guide.md'].includes('참가자 20명이 각각'), 'facilitator guide must operate 20 individual runs');
  process.stdout.write('CONTENT VERIFIED: 75-minute workshop package is internally consistent\n');
}

async function verifyMarooFirstWorkshop() {
  const [curriculum, participant] = await Promise.all([
    text('workshop/curriculum.md'), text('workshop/participant-guide.md')
  ]);
  canonicalAgenda(curriculum, 'workshop/curriculum.md');
  canonicalAgenda(participant, 'workshop/participant-guide.md');
  invariant(curriculum.includes('Maroo Testnet이 항상 우선'), 'curriculum must explicitly prioritize Maroo Testnet');
  invariant(participant.includes('Clairveil은 `x/privacy` 내부 동작을 직접 확인하는 구현 참고 실습'), 'participant guide must position Clairveil as hands-on implementation reference');
  invariant(participant.includes('--target clairveil-local --action payroll'), 'participant guide must execute the actual Clairveil local flow');
  invariant(participant.includes('--kind privacy-deposit-transfer-probes'), 'participant guide must execute the current Maroo Path B');
  invariant(participant.includes('Path A — 호환 bundle') && participant.includes('deposit-bundle.json'), 'participant guide must explain the compatible-bundle Path A');
  for (const phrase of ['## 0. 학습 목표', '## 1. 사전 요구 사항과 준비 상태 확인', '## 2. 75분 실행표', 'Success criteria', '토론 질문', '## 5. 워크숍 종료 후 다음 단계']) {
    invariant(participant.includes(phrase), `participant guide missing ${phrase}`);
  }
  invariant((participant.match(/\*\*Success criteria/g) ?? []).length >= 8, 'participant guide needs success criteria for all eight segments');
  invariant((participant.match(/\*\*토론 질문/g) ?? []).length >= 8, 'participant guide needs a discussion question for all eight segments');
  invariant(!curriculum.includes('Case M') && !curriculum.includes('Case L'), 'obsolete equal Case M/Case L structure remains');
  process.stdout.write('MAROO-FIRST WORKSHOP VERIFIED: Clairveil hands-on leads to testnet execution in one 75-minute agenda\n');
}

async function verifyFacilitatorMarooFirst() {
  const facilitator = await text('workshop/facilitator-guide.md');
  canonicalAgenda(facilitator, 'workshop/facilitator-guide.md');
  for (const phrase of ['## 2. 전날 준비', '### 2.3 Maroo live 준비 게이트', '### 2.5 T-30분', '## 3. 75분 진행표', '## 5. 장애 시 대체 진행', '## 6. 종료 체크리스트', '## 7. 워크숍 종료 후']) {
    invariant(facilitator.includes(phrase), `facilitator guide missing ${phrase}`);
  }
  invariant(facilitator.includes('--target clairveil-local --action payroll'), 'facilitator guide must run the actual Clairveil local smoke');
  invariant(facilitator.includes('--kind privacy-deposit-transfer-probes'), 'facilitator guide must expose the runnable Maroo Path B');
  invariant((facilitator.match(/\*\*Success criteria/g) ?? []).length >= 8, 'facilitator guide needs success criteria for all eight segments');
  invariant((facilitator.match(/\*\*토론 질문/g) ?? []).length >= 8, 'facilitator guide needs discussion prompts for all eight segments');
  process.stdout.write('MAROO-FIRST FACILITATOR GUIDE VERIFIED: setup, live gates, timing, fallback, and evidence\n');
}

async function verifyLocalBoundaries() {
  const [evidence, curriculum, participant, readme] = await Promise.all([
    text('evidence/local/payroll-summary.json').then((value) => validateLocalPayrollEvidence(JSON.parse(value) as LocalPayrollEvidence)),
    text('workshop/curriculum.md'), text('workshop/participant-guide.md'), text('README.md')
  ]);
  invariant(evidence.label === '[Local]', 'Clairveil evidence must be labeled [Local]');
  invariant(evidence.stateChangingTransaction === true, 'Clairveil evidence must contain actual local state-changing transactions');
  invariant(evidence.transactions.deposit.code === 0, 'Clairveil deposit must succeed');
  invariant(evidence.proofCount === 1 && evidence.transactions.payrollBatch.inputCount === 1, 'Clairveil payroll must use one proof and one input');
  invariant(evidence.transactions.payrollBatch.code === 0 && evidence.transactions.payrollBatch.outputCount === 3, 'Clairveil payroll must succeed with three outputs');
  invariant(evidence.employeeScans.length === 3 && evidence.employeeScans.every((scan) => scan.newNoteCount === 1 && scan.matchingBatchNoteCount === 1), 'Clairveil evidence must contain three transaction-bound employee scans');
  for (const document of [curriculum, participant, readme]) {
    invariant(document.includes('Maroo Testnet') && document.includes('[Local]') && document.includes('Clairveil'), 'boundary document must distinguish Maroo and Clairveil reference execution');
  }
  process.stdout.write('EVIDENCE BOUNDARIES VERIFIED: Maroo is primary; Clairveil hands-on remains implementation reference\n');
}

function slugify(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[.`*_~\[\](){}:;,!?"'\\/|<>+=]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function anchorsFor(document: string): Set<string> {
  const anchors = new Set<string>(['']);
  for (const match of document.matchAll(/<a\s+(?:id|name)=["']([^"']+)["'][^>]*>/gi)) anchors.add(match[1]);
  const counts = new Map<string, number>();
  for (const line of document.split(/\r?\n/)) {
    const match = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
    if (!match) continue;
    const base = slugify(match[1]);
    const seen = counts.get(base) ?? 0;
    anchors.add(seen === 0 ? base : `${base}-${seen}`);
    counts.set(base, seen + 1);
  }
  return anchors;
}

async function markdownFiles(directory = root): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'tmp') continue;
    const target = resolve(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await markdownFiles(target));
    else if (extname(entry.name) === '.md') paths.push(target);
  }
  return paths;
}

async function repositoryFiles(directory = root): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'tmp') continue;
    const target = resolve(directory, entry.name);
    if (target === resolve(root, 'demo/.env')) continue;
    if (entry.isDirectory()) paths.push(...await repositoryFiles(target));
    else paths.push(target);
  }
  return paths;
}

async function verifyTypeScriptMigration() {
  const legacyExtension = ['.', 'mjs'].join('');
  const files = await repositoryFiles();
  const legacyFiles = files.filter((path) => path.endsWith(legacyExtension));
  invariant(legacyFiles.length === 0, `legacy module files remain:\n${legacyFiles.map((path) => path.slice(root.length + 1)).join('\n')}`);

  const textExtensions = new Set(['.md', '.json', '.ts', '.txt', '.yaml', '.yml', '.toml']);
  const textNames = new Set(['.gitignore', '.env.example', 'LICENSE']);
  const legacyReferences: string[] = [];
  const referencedTypeScriptPaths = new Set<string>();
  for (const path of files) {
    const name = path.slice(path.lastIndexOf('/') + 1);
    if (!textExtensions.has(extname(path)) && !textNames.has(name)) continue;
    const contents = await readFile(path, 'utf8');
    if (contents.includes(legacyExtension)) legacyReferences.push(path.slice(root.length + 1));
    if (extname(path) === '.md') {
      for (const match of contents.matchAll(/\bdemo\/(?:scripts|shared|adapters|test)\/[A-Za-z0-9_./-]+\.ts\b/g)) {
        referencedTypeScriptPaths.add(match[0]);
      }
    }
  }
  invariant(legacyReferences.length === 0, `legacy module references remain:\n${legacyReferences.join('\n')}`);
  for (const path of referencedTypeScriptPaths) await access(resolve(root, path));

  const tsconfig = JSON.parse(await text('demo/tsconfig.json')) as { compilerOptions?: { strict?: boolean; noEmit?: boolean } };
  invariant(tsconfig.compilerOptions?.strict === true, 'demo/tsconfig.json must enable strict type checking');
  invariant(tsconfig.compilerOptions?.noEmit === true, 'demo/tsconfig.json must validate without generated JavaScript');
  const packageJson = JSON.parse(await text('demo/package.json')) as { scripts?: Record<string, string> };
  invariant(packageJson.scripts?.typecheck === 'tsc --noEmit', 'demo package must expose the strict typecheck command');
  invariant(packageJson.scripts?.check?.startsWith('bun run typecheck &&') === true, 'demo check must run typecheck first');
  invariant(!files.some((path) => /\.(?:js|cjs)$/.test(path) && path.includes('/demo/')), 'demo executable sources must be TypeScript');
  const allDocs = (await Promise.all((await markdownFiles()).map((path) => readFile(path, 'utf8')))).join('\n');
  invariant(!/\b(?:npm|npx)\s+(?:install|run|test|exec)\b/.test(allDocs), 'workshop commands must use Bun consistently');
  process.stdout.write('TYPESCRIPT MIGRATION VERIFIED: strict configuration and zero legacy module paths\n');
}

async function verifyLinksAndClaims() {
  const files = await markdownFiles();
  const cache = new Map<string, string>();
  for (const file of files) cache.set(file, await readFile(file, 'utf8'));
  const anchorCache = new Map<string, Set<string>>([...cache].map(([file, document]) => [file, anchorsFor(document)]));
  const failures: string[] = [];
  for (const [file, document] of cache) {
    for (const match of document.matchAll(/(?<!!)\[[^\]]*\]\(([^)]+)\)/g)) {
      const capturedTarget = match[1];
      invariant(capturedTarget, `empty markdown target in ${file}`);
      const target = capturedTarget.trim().replace(/^<|>$/g, '').split(/\s+["']/)[0] ?? '';
      if (/^(https?:|mailto:)/.test(target)) continue;
      const [rawPath, rawAnchor = ''] = target.split('#', 2);
      const targetFile = rawPath ? resolve(dirname(file), decodeURIComponent(rawPath)) : file;
      try {
        await access(targetFile);
      } catch {
        failures.push(`${file.slice(root.length + 1)} -> missing ${target}`);
        continue;
      }
      if (rawAnchor && extname(targetFile) === '.md') {
        if (!anchorCache.has(targetFile)) {
          const targetText = await readFile(targetFile, 'utf8');
          anchorCache.set(targetFile, anchorsFor(targetText));
        }
        if (!anchorCache.get(targetFile)?.has(decodeURIComponent(rawAnchor))) failures.push(`${file.slice(root.length + 1)} -> missing anchor ${target}`);
      }
    }
  }
  invariant(failures.length === 0, `broken local references:\n${failures.join('\n')}`);

  const ownedDocs = await Promise.all(coreDocs.map(text));
  const joined = ownedDocs.join('\n');
  const forbidden: ReadonlyArray<readonly [RegExp, string]> = [
    [/Step\s*[0-4]/i, 'obsolete Step 0~4 wording'],
    [/step:[0-4]/i, 'obsolete step:N command'],
    [/\(예정\)/, 'unresolved planned marker'],
    [/결과물\s*#2/, 'incorrect assignment result-number citation'],
    [/Maroo 테스트넷[^\n]{0,80}end-to-end[^\n]{0,40}(완료|성공)/i, 'unsupported Maroo live end-to-end success claim']
  ];
  for (const [pattern, label] of forbidden) invariant(!pattern.test(joined), `${label}: ${pattern}`);
  for (const match of joined.matchAll(/\[(Live Testnet|Local|Simulation|Docs Only|Live|Testnet|Mock|Planned)\]/g)) {
    invariant(['[Live Testnet]', '[Local]', '[Simulation]', '[Docs Only]'].includes(match[0]), `unsupported evidence label ${match[0]}`);
  }
  process.stdout.write('LINKS AND CLAIMS VERIFIED: no broken local references or unsupported live claims\n');
}

async function verifyAdapters() {
  for (const path of [
    'demo/shared/contracts.ts',
    'demo/shared/router.ts',
    'demo/adapters/maroo-testnet/index.ts',
    'demo/adapters/clairveil-local/index.ts',
    'demo/adapters/clairveil-local/distinct-payroll.ts',
    'demo/scripts/run.ts'
  ]) await access(resolve(root, path));
  for (const obsolete of [
    'demo/lib',
    'demo/scripts/preflight.ts',
    'demo/scripts/live-submit.ts',
    'demo/scripts/collect-receipt.ts',
    'demo/scripts/local-payroll.ts'
  ]) {
    let exists = true;
    try {
      await access(resolve(root, obsolete));
    } catch {
      exists = false;
    }
    invariant(!exists, `obsolete adapter path still exists: ${obsolete}`);
  }
  const router = await text('demo/shared/router.ts');
  const runner = await text('demo/scripts/run.ts');
  invariant(router.includes("['maroo-testnet', 'clairveil-local']"), 'router must expose exactly the two explicit targets');
  invariant(!/catch[\s\S]{0,200}clairveilLocalAdapter/.test(runner), 'runner must not fall back to Clairveil after a Maroo failure');
  invariant(runner.includes("'maroo-testnet': marooTestnetAdapter"), 'runner is missing the Maroo adapter');
  invariant(runner.includes("'clairveil-local': clairveilLocalAdapter"), 'runner is missing the Clairveil adapter');
  const localRunner = await text('demo/adapters/clairveil-local/distinct-payroll.ts');
  invariant(localRunner.includes("'transfer-batch-16x32'"), 'Clairveil adapter must invoke the one-proof batch command');
  invariant(localRunner.includes('matchingBatchNoteCount'), 'Clairveil adapter must verify each employee scan');
  invariant(localRunner.includes('sensitive: true'), 'Clairveil key generation output must be suppressed');
  const marooRunner = await text('demo/adapters/maroo-testnet/index.ts');
  const attemptSource = marooRunner.slice(marooRunner.indexOf('export async function attempt'), marooRunner.indexOf('function matchingEvent'));
  const assertBroadcastOrder = (source: string, prepareToken: string, label: string): void => {
    const order = [
      "control.enter('transaction-preparation')",
      prepareToken,
      'wallet.signTransaction(preparedTransaction)',
      'control.markRpcSubmission()',
      'client.sendRawTransaction({ serializedTransaction })'
    ].map((token) => source.indexOf(token));
    invariant(order.every((index) => index >= 0), `${label} must prepare, sign, mark, and send a raw transaction explicitly`);
    invariant(order.every((index, position) => position === 0 || index > (order[position - 1] ?? -1)), `${label} marker must occur after local signing and immediately before raw RPC submission`);
  };
  const probeSource = attemptSource.slice(attemptSource.indexOf("if (kind === 'privacy-deposit-transfer-probes')"), attemptSource.indexOf("const result = await captureLiveAttempt({", attemptSource.indexOf("return {\n      marker: bothAttempted")));
  assertBroadcastOrder(probeSource, 'wallet.prepareTransactionRequest({ account, ...transaction })', 'Maroo rejection probe');
  const bundleSource = attemptSource.slice(attemptSource.lastIndexOf('const result = await captureLiveAttempt({'));
  assertBroadcastOrder(bundleSource, 'wallet.prepareTransactionRequest(transaction)', 'Maroo compatible bundle');
  invariant(!attemptSource.includes('native-tokrw-self-transfer'), 'obsolete native self-transfer fallback must be removed');
  process.stdout.write('ADAPTER ARCHITECTURE VERIFIED: explicit targets with no automatic fallback\n');
}

async function verifySubmissionKit() {
  for (const path of requiredFiles) await access(resolve(root, path));
  const [readme, notes, video, curriculum, participant, facilitator, troubleshooting] = await Promise.all([
    text('README.md'), text('SUBMISSION_NOTES.md'), text('video-link.md'),
    text('workshop/curriculum.md'), text('workshop/participant-guide.md'),
    text('workshop/facilitator-guide.md'), text('workshop/troubleshooting.md')
  ]);
  for (const phrase of ['Primary Track B', 'Public repository', 'Walkthrough Video', 'Testnet transaction/evidence', 'Clairveil provenance', 'Known limitations']) {
    invariant(readme.includes(phrase), `README shared deliverable missing: ${phrase}`);
  }
  invariant(readme.includes('### 2.1 공통 제출물') && readme.includes('### 2.2 Track B 필수 결과물'), 'README must separate common and Track B deliverables');
  for (const deliverable of ['Runnable Demo', 'Live Testnet Evidence', '60~75분 Workshop Package', 'Troubleshooting Guide', 'Validation', 'Walkthrough Video']) {
    invariant(readme.includes(deliverable), `README Track B mapping missing: ${deliverable}`);
  }
  for (const heading of ['Assumptions / Discrepancies', 'Validation', 'AI Usage', 'DX Feedback', 'Known Limitations']) {
    invariant(notes.includes(heading), `SUBMISSION_NOTES shared section missing: ${heading}`);
  }
  invariant((notes.match(/^\| DX\d+ /gm) ?? []).length >= 3, 'DX Feedback requires at least three items');
  invariant(notes.includes('영향 사용자') && notes.includes('제안 owner'), 'DX Feedback requires impacted users and an owner');
  const evidencePath = 'evidence/live-testnet/state-change-attempt.json';
  const evidence = JSON.parse(await text(evidencePath)) as LiveAttemptEvidence;
  invariant(validateLiveAttemptEvidence(evidence).length === 0, 'actual live evidence does not satisfy the submission contract');
  invariant(evidence.kind === 'privacy-deposit-transfer-probes', 'the current submission must identify the completed Path B probe sequence');
  for (const operation of ['deposit', 'transfer'] as const) {
    const probe = evidence.probes?.[operation];
    invariant(probe?.outcome === 'included-revert' && probe.receiptStatus === 'reverted', `${operation} probe must preserve its included revert receipt`);
    invariant(Boolean(probe.explorerUrl) && readme.includes(String(probe.explorerUrl)), `README missing ${operation} explorer evidence`);
  }
  invariant(video.includes('00:00–00:35') && video.includes('06:05–07:00'), 'video must have a complete 7-minute run sheet');
  invariant(curriculum.includes('학습 목표와 성과') && curriculum.includes('종료 후 다음 단계'), 'curriculum lacks outcomes or next steps');
  invariant(participant.includes('Success criteria') && facilitator.includes('중단 기준'), 'participant/facilitator success criteria missing');
  invariant(participant.includes('--target clairveil-local --action payroll') && participant.includes('EMP-A/B/C'), 'participant guide must execute the Clairveil proof and scan flow');
  invariant(readme.includes('Clairveil 구현 참고 실습') && readme.includes('--target clairveil-local --action payroll'), 'README must present Clairveil as hands-on implementation reference');
  invariant((troubleshooting.match(/^### T\d+\./gm) ?? []).length >= 5, 'troubleshooting requires at least five errors');
  invariant(troubleshooting.includes('## 실행 장애 시 대체 진행') && troubleshooting.includes('### Emergency recorded mode'), 'troubleshooting lacks the facilitator outage path');
  process.stdout.write('SUBMISSION KIT VERIFIED: Track B and shared deliverables are mapped\n');
}

async function verifyFailureControls() {
  const [curriculum, participant, facilitator, troubleshooting, demoReadme, localRunner, rehearsal] = await Promise.all([
    text('workshop/curriculum.md'),
    text('workshop/participant-guide.md'),
    text('workshop/facilitator-guide.md'),
    text('workshop/troubleshooting.md'),
    text('demo/README.md'),
    text('demo/adapters/clairveil-local/distinct-payroll.ts'),
    text('demo/scripts/rehearse.ts')
  ]);
  const evidence = validateLocalPayrollEvidence(JSON.parse(await text('evidence/local/payroll-summary.json')) as LocalPayrollEvidence);
  const joined = [curriculum, participant, facilitator, troubleshooting, demoReadme].join('\n');

  for (const phrase of [
    'Privacy resource rejection',
    'business-intent failure',
    'employee↔shielded-address registry',
    'plan/output binding',
    'value=0',
    'PCL'
  ]) invariant(joined.includes(phrase), `failure-control documentation is missing ${phrase}`);
  invariant(curriculum.includes('정상 scan 3; `301` 무상태 거부; 오지급 tx 성공·EMP-B 0/EMP-C 1'), 'curriculum agenda lacks executable failure-control criteria');
  invariant(participant.includes('wallet-input-selection-before-proof') && participant.includes('broadcastAttempted=false'), 'participant guide lacks overspend evidence checks');
  invariant(participant.includes('EMP-B 신규 note 0') && participant.includes('EMP-C `120uclair` 신규 note 1'), 'participant guide lacks wrong-recipient scan checks');
  invariant(facilitator.includes('27–35') && facilitator.includes('35–39') && facilitator.includes('39–44'), 'facilitator guide does not timebox all local controls');
  invariant(participant.includes('bun run demo/scripts/rehearse.ts --offline') && participant.includes('MAROO ADAPTER RECIPIENT CONTROL PASSED'), 'participant guide does not execute the Maroo adapter recipient control');
  invariant(troubleshooting.includes('### T14.') && troubleshooting.includes('### T15.'), 'troubleshooting lacks both actual failure controls');
  invariant(localRunner.includes("'prepare-batch-transfer'") && localRunner.includes('/selected inputs do not fund batch payment total 301uclair/'), 'local runner does not execute and classify the overspend control');
  invariant(localRunner.includes("actualRecipientEmployeeId: 'EMP-C'") && localRunner.includes("payrollOutcome: 'failed'"), 'local runner does not execute and classify the wrong-recipient control');
  invariant(rehearsal.includes("employeeBOutput.profileRef = employeeC.profileRef") && rehearsal.includes('wrong EMP-B profile rejected before broadcast'), 'offline rehearsal does not reject the wrong employee recipient binding');
  invariant(evidence.failureControls.overspend.treasuryStateUnchanged, 'stored overspend evidence does not prove unchanged treasury state');
  invariant(evidence.failureControls.wrongRecipient.chainOutcome === 'success' && evidence.failureControls.wrongRecipient.payrollOutcome === 'failed', 'stored wrong-recipient evidence does not separate chain and payroll outcomes');
  invariant(evidence.observationComparison.publicObserver.plaintextAmountsObserved === false, 'stored public observation exposes payroll plaintext');
  process.stdout.write('FAILURE CONTROLS VERIFIED: Privacy rejection, PCL policy, and business-intent failure are executable and distinct\n');
}

try {
  if (mode === 'content') await verifyContent();
  else if (mode === 'maroo-first-workshop') await verifyMarooFirstWorkshop();
  else if (mode === 'facilitator-maroo-first') await verifyFacilitatorMarooFirst();
  else if (mode === 'local-boundaries') await verifyLocalBoundaries();
  else if (mode === 'links') await verifyLinksAndClaims();
  else if (mode === 'adapters') await verifyAdapters();
  else if (mode === 'submission-kit') await verifySubmissionKit();
  else if (mode === 'typescript') await verifyTypeScriptMigration();
  else if (mode === 'failure-controls') await verifyFailureControls();
  else throw new Error('usage: verify-workshop.ts <content|maroo-first-workshop|facilitator-maroo-first|local-boundaries|links|adapters|submission-kit|typescript|failure-controls>');
} catch (error) {
  process.stderr.write(`ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
