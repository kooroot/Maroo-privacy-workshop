# SUBMISSION_NOTES — Track B Enable

라벨은 `[Live Testnet]`, `[Local]`, `[Simulation]`, `[Docs Only]`만 사용한다. 실행하지 않은 결과는 `미실행`으로 적고 예시 tx hash를 만들지 않는다.

## 1. Assumptions / Discrepancies

### 1.1 Audience assumptions

| ID | 가정 |
|---|---|
| A1 | 한국 은행·핀테크·결제·커스터디·기업 자금관리 조직의 시니어 백엔드/블록체인 엔지니어 20명 |
| A2 | EVM, Solidity integration, REST/JSON-RPC는 익숙하지만 Maroo와 ZK note/prover는 처음 |
| A3 | 참가자마다 testnet-only company account 1개, 역할 분리용 employee public account 1개, distinct synthetic shielded employee profile 3개를 독립적으로 사용 |
| A4 | 4~8주 안에 보안·컴플라이언스·운영·제품 팀과 PoC go/no-go를 결정 |
| A5 | macOS가 검증 환경이며 WSL2는 목표 환경이지만 직접 검증 전까지 미검증 |

### 1.2 Actual vs proposed

| 항목 | 상태 | 라벨 |
|---|---|---|
| JSON plan/request/receipt/scan/audit contract와 negative tests | 구현·실행 가능 | `[Simulation]` |
| Maroo read-only preflight | 실제 RPC에서 chain 450815, account/balance, OKRW, PCL, Privacy 상태 확인 | `[Live Testnet]` |
| Maroo `IPrivacy.deposit`·`transfer` invalid-proof probes | 회사 signer가 두 ABI-valid transaction을 실제 제출; 두 건 모두 포함 후 revert되어 hash·receipt 보존 | `[Live Testnet]` |
| reviewed calldata estimate/broadcast와 receipt event 검증 | 구현; compatible bundle 필요 | 실행 결과에 따라 `[Live Testnet]` |
| Maroo compatible deposit/batch proof 생성 | adapter contract만 정의, provider 미연결 | `[Docs Only]` |
| EMP-A/B/C scanner와 auditor integration | report contract만 정의, provider 미연결 | `[Docs Only]` |
| Clairveil payroll/control wrapper | 75분 참가자 구현 참고 실습으로 actual `x/privacy` 정상 급여·공개/직원 관찰·overspend 거부·성공한 오지급 검증 | `[Local]` |
| offline full reconciliation rehearsal | actual contract validation, no chain/proof/decrypt | `[Simulation]` |

### 1.3 Intentionally excluded

- ZK circuit, VK, Maroo/Clairveil core protocol 변경.
- production custody/HSM/KMS, 실제 KYC·직원 정보·급여 자금.
- UI와 enterprise deployment automation.
- 법률 자문/규제 적합성 보증.
- 75분 내 대규모 throughput/DR test.
- 단건 `transfer` 3회의 순차 root/change-note 처리.

<a id="discrepancies"></a>

### 1.4 Discrepancies

| ID | 관찰 | 근거 | 영향/처리 | 라벨 |
|---|---|---|---|---|
| D1 | deployed contracts 표는 네 precompile을 열거하지만 Privacy overview/IPrivacy는 `0x…0b`를 정의 | Maroo [deployed contracts](https://docs.maroo.io/resources/contracts/deployed-contracts), [Privacy overview](https://docs.maroo.io/concepts/privacy/privacy-precompile-overview), `@maroo-chain/contracts@0.0.8` | `.env.example`에는 Privacy overview와 ABI 근거로 `0x…0b` 사용; testnet 호출 결과는 별도 evidence | `[Docs Only]` |
| D2 | Clairveil EVM 예시/로컬 호출과 Maroo `deposit((bytes,bytes,bytes))` ABI를 같은 것으로 볼 수 없음 | 과제의 source priority, Maroo [deposit docs](https://docs.maroo.io/apis/contract/contract-privacy-deposit), Clairveil commit | 정본 워크숍은 Maroo Docs/Testnet 기준; Clairveil은 구현 참고 검증으로만 격리 | `[Docs Only]` |
| D3 | Clairveil의 reference payroll script는 모든 item을 Bob 한 profile에 보내지만 같은 commit의 `transfer-batch-16x32` CLI는 반복 `--payment`로 서로 다른 수신자와 one-proof 1..16/1..32 흐름을 지원 | `clairveil@ca85b02 scripts/reference-payroll-live-localnet.sh`, `x/privacy/client/cli/tx_batch_transfer_16x32.go` | 약한 reference script 대신 정식 CLI를 Bun adapter가 직접 조합해 EMP-A/B/C를 검증; 그래도 Maroo ABI/VK 호환으로 주장하지 않음 | `[Local]` |
| D4 | Maroo Docs는 Privacy request ABI를 설명하지만 testnet-compatible prover/scanner 배포물·SDK 연결 경로를 제공하지 않음 | deposit/transfer/batch API pages | adapter contract와 six-part live readiness gate 작성; 실제 provider 연결 전 live E2E claim 보류 | `[Docs Only]` |

## 2. Validation

### 2.1 Evidence rules

허용:

- public address, tx hash, explorer URL, receipt/event, policy raw response.
- adapter version/commit, public digests, redacted scan/audit report.
- 오류 code/message/data, UTC, OS/tool version, exact reproduction command.

금지:

- private key, mnemonic/seed phrase, bearer token.
- witness, note plaintext/blinding, viewing/spending/audit private key.
- 실제 직원 개인정보, KYC 입력/화면, 운영 credential.

파일 규칙:

- active live: `evidence/live-testnet/`.
- active local: `evidence/local/`.
- active simulation: `evidence/simulation/`.
- active run metadata/plan: `evidence/run/`.
- 새 run 전 `bun run demo/scripts/reset-evidence.ts --apply`로 기존 active evidence를 timestamp archive한다.
- JSON은 `label`, `utc`, schema/version, command 또는 producer version, 판정 필드를 포함한다.
- tx failure도 hash를 만들지 말고 raw error·시각·환경·재현 절차로 제출할 수 있다.

secret scan:

```bash
grep -RInE 'COMPANY_PRIVATE_KEY=|PRIVATE_KEY=|mnemonic|seed phrase|Authorization: Bearer' evidence/ || true
```

패턴이 검출되면 공유/커밋 전에 격리하고 해당 테스트 credential을 교체한다.

### 2.2 Environment

| 항목 | 값 | 확인 명령 |
|---|---|---|
| OS | macOS 26.6.2 arm64 | `sw_vers`; `uname -m` |
| Bun | 1.4.0 | `bun --version` |
| TypeScript | 7.0.2, strict/no-emit | `bun run --cwd demo typecheck` |
| Go | go1.25.1 darwin/arm64 | `go version` |
| Foundry `anvil`·`cast`·`forge` | 1.7.1 | `anvil --version`; `cast --version`; `forge --version` |
| Clairveil | `ca85b02708fdd75259d4d2ee2d671c21198cec69` | `git -C ../clairveil rev-parse HEAD` |
| Maroo testnet | chain 450815; RPC·receipt 직접 확인 | `cast chain-id --rpc-url https://rpc-testnet.maroo.io` |

### 2.3 실행 기록

자동·로컬·테스트넷 검증은 아래처럼 완료했다. Path B는 실제 상태 변경 시도이고, 유효 proof를 사용한 full happy path는 별도 미완료로 남긴다.

| UTC | 명령 | 결과 | 라벨 | evidence |
|---|---|---|---|---|
| 2026-09-04T03:19:12Z | `bun run demo/scripts/check-workshop-environment.ts` | Bun 1.4.0, Git, Go 1.25.1, Foundry `anvil`·`cast`·`forge` 1.7.1, Clairveil 고정 SHA 확인; secret read와 state change 없음 | `[Local]` | `demo/scripts/check-workshop-environment.ts`, command output |
| 2026-09-04T04:43Z | `bun run --cwd demo check` | strict TypeScript/no-emit, Bun 39개 테스트/0 fail/46 expect, offline doctor/rehearsal, actual Clairveil 정상·실패 evidence contract, Maroo 우선 75분·환경 setup·진행자·경계·링크·adapter·공통+Track B 제출물 검사 통과 | `[Simulation]` | `demo/package.json`, command output |
| 2026-09-04T00:48Z | `bun audit --cwd demo` | TypeScript 개발 의존성을 포함한 40 packages, 알려진 vulnerability 0건 | `[Docs Only]` | `demo/bun.lock` |
| 2026-09-04T00:27Z | `--participant 07` plan 생성→offline 산출물→`verify-evidence.ts` | `COMPANY-P07-WORKSHOP-PAYROLL`, 고유 profile 3개, 합계 300e18, scan 3, audit verified | `[Simulation]` | command output |
| evidence 파일의 `utc` | `bun run demo/scripts/run.ts --target clairveil-local --action payroll --clairveil ../clairveil --out evidence/local/payroll-summary.json` | 실제 `x/privacy` 정상 300→100/120/80 one-proof payroll과 scan 3개, 공개 event/직원 관찰 차이, `300→301` proof 전 거부·note 불변, EMP-B 대신 EMP-C로 보낸 `120`의 tx 성공·업무 실패 확인 | `[Local]` | [payroll-summary.json](evidence/local/payroll-summary.json) |
| 2026-09-04T03:52:54.785Z | `bun run demo/scripts/run.ts --target maroo-testnet --action doctor --env demo/.env.example --out evidence/live-testnet/doctor.json` | chain 450815, OKRW typed params, PCL global/Privacy policies read 성공; 상태 변경 없음 | `[Live Testnet]` | [doctor.json](evidence/live-testnet/doctor.json) |
| 2026-09-04T01:07:04.993Z | `bun run demo/scripts/run.ts --target maroo-testnet --action preflight --env demo/.env --plan demo/fixtures/payroll-plan.json --out evidence/live-testnet/preflight.json` | 서로 다른 company/employee public account, 회사 balance 10,000 OKRW 상당, 필요액 300 OKRW 상당, OKRW/PCL/Privacy check 통과; 상태 변경 없음 | `[Live Testnet]` | [preflight.json](evidence/live-testnet/preflight.json) |
| 2026-09-04T01:08:49.727Z | `bun run demo/scripts/run.ts --target maroo-testnet --action attempt --kind privacy-deposit-transfer-probes --env demo/.env --broadcast --ack-state-change MAROO_TESTNET_ONLY --out evidence/live-testnet/state-change-attempt.json` | 두 transaction 모두 Privacy precompile에 실제 제출되어 포함 후 revert. Deposit: block 17243931, gas 536,813, non-zero commitment 요구. Transfer: block 17243934, gas 1,000,000/1,000,000, decoded reason 없음. 유효 proof·직원 지급 성공 아님 | `[Live Testnet]` | [aggregate evidence](evidence/live-testnet/state-change-attempt.json), [deposit tx](https://explorer-testnet.maroo.io/tx/0xaa36463028962fccb246897d45bf13e43f6ef3da3cb6522fe4d3bdc82bd2c939), [transfer tx](https://explorer-testnet.maroo.io/tx/0x3d3d6bbba494127e776a7014acbdc3e087b680a0190b642baf21bbdc87efb622) |
| 2026-09-04T01:21:22Z | 공개 RPC receipt 재검증 | 두 hash의 chain `450815`, sender, target `0x100…000b`, selector, value, block, `status=0`가 저장 evidence와 일치 | `[Live Testnet]` | 위 explorer 링크와 `cast receipt`/`cast tx` 결과 |
| 미실행 | 유효 Maroo deposit→3-output payroll→EMP-A/B/C scan→audit | 호환 prover/VK/scanner/auditor 미확보로 full happy path 미완료 | `[Live Testnet]` | 없음 |

### 2.3.1 과제 최소 live state-change attempt

[Live Testnet] Path B `probe-sequence-complete`: deposit [`included-revert`](https://explorer-testnet.maroo.io/tx/0xaa36463028962fccb246897d45bf13e43f6ef3da3cb6522fe4d3bdc82bd2c939), transfer [`included-revert`](https://explorer-testnet.maroo.io/tx/0x3d3d6bbba494127e776a7014acbdc3e087b680a0190b642baf21bbdc87efb622); evidence: [state-change-attempt.json](evidence/live-testnet/state-change-attempt.json), UTC 2026-09-04T01:08:49.727Z. 두 건 모두 실제 상태 변경 transaction 제출·포함·revert 증거이며 유효 ZK proof 또는 직원 지급 성공 증거가 아니다.

### 2.4 Directly verified vs source-only

- 직접 검증: Bun package check, participant 07 고유 plan full offline reconciliation, Clairveil actual `x/privacy` 정상 `300→100/120/80` one-proof payroll, public/employee observation, `300→301` proof 전 거부·note 불변, EMP-B 대신 EMP-C로 보낸 `120`의 chain 성공/business failure, Maroo public RPC OKRW/PCL read-only preflight, Maroo `IPrivacy.deposit`·`transfer` Path B transaction 두 건의 포함 후 revert receipt.
- source-only: Maroo ABI/address/policy lifecycle, compatible prover/scanner availability absence, production behavior.
- live testnet: public read-only doctor는 직접 검증했다. 상태 변경 시도의 최신 판정은 위 generated summary와 연결된 evidence를 따른다. 무효 ZK 입력의 `IPrivacy.deposit`·`transfer` probe는 실제 on-chain rejection 관찰이지만 유효 proof나 Privacy payroll 완료가 아니다.

## 3. AI Usage

사용 도구: OpenAI Codex.

| ID | 사용 | 검증·수정 |
|---|---|---|
| S1 | 과제 원문과 기존 자료에서 persona/75분/outcome/next-step 구조를 재편 | Track B 필수 결과물 목록과 모든 내부 링크를 자동 검사 |
| S2 | plan/request/receipt/scan/audit 대사 코드와 negative controls 생성 | Bun test, offline full rehearsal, actual Clairveil local gate로 분리 검증 |
| S3 | 기존 Local wrapper의 한 Bob 경계를 소스 전체에서 재탐색하고 distinct one-proof 실행기를 작성 | `transfer-batch-16x32` 구현·타입을 직접 대조하고 새 localnet에서 deposit/batch/직원별 scan을 실제 실행 |
| E1 | 초기 최소 live 경로가 직원 지급과 무관한 일반 native self-transfer였고 signer 역할도 불명확했음 | 해당 경로를 제거하고 회사 signer가 Privacy precompile의 `deposit`·`transfer`를 실제 제출하도록 수정했다. 실패 거래는 유효 ZK 지급으로 주장하지 않는다. |
| E2 | upstream reference script만 보고 Clairveil 로컬도 한 수취인만 지원한다고 판단했음 | 같은 commit의 `transfer-batch-16x32` 구현을 확인하고 EMP-A/B/C에 대한 one-proof 전송과 개별 scan을 실제 localnet에서 검증했다. |
| E3 | PCL을 통과하면 직원 주소 착오도 자동으로 차단된다고 해석할 여지가 있었음 | PCL signer policy, Privacy proof 검증, 애플리케이션의 직원-address binding을 분리했다. EMP-C 오지급의 chain 성공·업무 실패와 사전 bundle 거부를 각각 실행해 경계를 확인했다. |

사람이 직접 판단한 부분:

- full live를 보류하고 adapter readiness gate를 둔 결정.
- Clairveil distinct one-proof 결과를 Maroo OKRW/PCL/EVM/VK 성공과 동급으로 보지 않은 결정.
- 75분 핵심을 deposit→batch→3 scans→audit로 제한한 결정.

## 4. DX Feedback

| ID | 문제 | 재현/근거 | 영향 사용자 | 심각도·이유 | 제안 | 제안 owner |
|---|---|---|---|---|---|---|
| DX1 | Privacy request ABI는 있으나 testnet-compatible prover/wallet/scanner quickstart가 연결되지 않음 | deposit와 batch API에서 request field를 확인한 뒤 executable producer link 탐색 | 첫 Maroo privacy 연동 개발자·워크숍 진행자 | High — state-changing happy path 차단 | versioned SDK/CLI, VK fingerprint, end-to-end testnet fixture를 한 페이지에 제공 | Privacy SDK/Docs 팀 |
| DX2 | deployed contracts 표에 Privacy `0x…0b`가 함께 보이지 않음 | deployed contracts와 Privacy overview 비교 | contract address를 구성하는 앱 개발자 | Medium — wrong-target integration 위험 | 표에 Privacy 행과 package version/source link 추가 | Protocol Docs 팀 |
| DX3 | receipt 성공과 employee/audit delivery를 함께 판정하는 예제가 없음 | event API와 scanner/disclosure 개념을 별도 추적 | 급여 운영자·wallet/scanner 개발자·감사 담당자 | High — 중복 지급/감사 누락 위험 | tx→output→scanner→audit correlation schema와 reference reconciler 제공 | Wallet/Indexer 팀 |
| DX4 | `@maroo-chain/viem`은 Privacy 주소만 노출하고 deposit/batch typed action은 제공하지 않음 | package README·types에서 OKRW/PCL action과 `Addresses.privacy`는 확인되지만 Privacy write namespace는 없음 | Privacy 앱 개발자·워크숍 도구 작성자 | Medium — ABI encode와 event/error 처리를 각 앱이 반복 | typed Privacy write/simulate/receipt actions와 redacted error projection 제공 | TypeScript SDK 팀 |
| DX5 | 실패 진단 품질이 호출별로 다름 | 같은 Path B 실행에서 deposit receipt는 `note commitment must be non-zero`를 반환했지만 transfer는 gas limit 1,000,000을 모두 사용하고 decoded revert reason을 주지 않음 | Privacy 연동 개발자·워크숍 진행자 | Medium — invalid proof와 gas exhaustion/실행기 실패를 즉시 구분하기 어려움 | Privacy method별 권장 gas, structured error code, trace 기반 troubleshooting 예시 제공 | Privacy Runtime/Docs 팀 |
| DX6 | private transfer의 shielded recipient를 EAS/PCL identity에 결속하는 end-to-end 예제가 없음 | `IPrivacy.transfer`/batch output ABI에는 공개 EVM recipient가 없고 docs는 hidden value를 PolicyOperation `value=0`으로 설명 | 기관 payroll·compliance adapter 개발자 | High — PCL 통과를 수취인 업무 검증으로 오인할 수 있음 | approved shielded-address registry, attestation binding, prover public inputs와 typed rejection까지 포함한 reference flow 제공 | Privacy/PCL/Docs 팀 |

## 5. Known Limitations

### Incomplete

- Maroo Privacy full flow의 유효 deposit→batch→scan/audit evidence. Path B의 실패 receipt와 explorer 검증은 완료했다.
- WSL2 clean-run verification.
- 5~8분 walkthrough video URL.

### Simulation or local-only

- offline rehearsal은 JSON 계약/negative control만 실행한다.
- Clairveil 구현 참고 실습은 actual `x/privacy` chain의 one-proof/distinct-profile·overspend·오지급 control 경로지만 `uclair`, Cosmos SDK, no PCL이며 Maroo ABI/VK 호환 증거가 아니다.

### Before production

- prover/VK provenance, witness trust boundary, artifact rotation.
- sender/recipient policy와 attestation lifecycle, employee↔shielded-address registry와 plan/output binding.
- employee viewing key와 auditor key custody/recovery/rotation.
- idempotent submit, scanner cursor, reconciliation, partial delivery procedures.
- performance/gas/block limit, monitoring, incident response, data retention.
