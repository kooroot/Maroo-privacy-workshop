# 진행자 가이드 — Maroo Testnet 우선 75분 워크숍

목표는 참가자 20명이 각각 자기 환경에서 Maroo Testnet readiness, Clairveil `x/privacy` 구현 참고 실습, Maroo Testnet 실행을 순서대로 완료하고 성공·거부·미검증을 직접 판정하게 하는 것이다. 진행자는 대신 서명하지 않고 private key나 shielded profile material을 받지 않는다.

## 1. 운영 원칙

1. Maroo Testnet이 정본 실행 경로다.
2. Clairveil은 실제 `x/privacy` transaction·proof·note·scan을 참가자가 직접 검증하는 `[Local]` 구현 참고 실습이다.
3. Clairveil의 `uclair`·Cosmos runtime·proof를 Maroo OKRW·PCL·EVM ABI/VK 성공으로 바꾸어 말하지 않는다.
4. Foundry는 전원이 같은 EVM 운영 도구를 갖췄는지 확인한다. `cast`는 Maroo public state와 receipt를 교차 확인하는 데 쓰고, 범용 Anvil·Solidity 기초 실습은 하지 않는다.
5. 모든 참가자는 1인 1 checkout, 1 company test wallet, 1 employee public account, 1 evidence directory를 쓴다.
6. 호환 Maroo prover/scanner가 없으면 Path B rejection을 실행하고 full privacy payroll 성공을 주장하지 않는다.

## 2. 전날 준비

### 2.1 버전과 package smoke

```bash
bun --version
go version
anvil --version
cast --version
forge --version
git -C ../clairveil rev-parse HEAD
bun install --cwd demo --frozen-lockfile
bun run demo/scripts/check-workshop-environment.ts
bun run --cwd demo check
```

권장 기준은 macOS, Bun 1.4+, TypeScript 7, Go 1.25 계열, Foundry 도구 모음과 Clairveil commit `ca85b02708fdd75259d4d2ee2d671c21198cec69`이다. `WORKSHOP ENVIRONMENT READY`가 출력돼야 한다. Windows/WSL2는 직접 smoke한 경우에만 지원 환경으로 공지한다.

### 2.2 참가자별 자산

- 회사 테스트넷 계정 20개와 회사와 다른 employee 공개 계정 20개.
- 회사별 300 tOKRW 상당 + 두 transaction gas + 1회 재시도 여유.
- 참가자별 repository와 sibling `../clairveil` checkout.
- 실제 직원 정보가 아닌 EMP-A/B/C 합성 식별자.
- Path A를 쓸 경우 Maroo용 shielded profile 3개, auditor profile, adapter version/commit/VK id.

company address만 run card에 기록한다. private key, mnemonic, witness, viewing/audit key는 수집하지 않는다.

Go module cache와 Clairveil build를 전날 예열한다.

```bash
git -C ../clairveil rev-parse HEAD
cd ../clairveil
go mod download
go build ./cmd/clairveild
go build ./cmd/clairveil-setup
cd ../maroo-privacy-workshop
```

### 2.3 Maroo live 준비 게이트

| Gate | 확인 | 통과 증거 |
|---|---|---|
| M1 | RPC·chain | chain `450815` |
| M2 | OKRW | 실제 `getParams` 응답과 company 잔액 |
| M3 | PCL | global/Privacy contract policy raw response |
| M4 | Privacy | target `0x100000000000000000000000000000000000000b` |
| M5 | signer | `COMPANY_PRIVATE_KEY`가 `COMPANY_ACCOUNT`와 일치 |
| M6 | execution path | Path A compatible bundle 또는 Path B rejection 범위가 시작 전에 확정 |

Path A는 Maroo-compatible deposit proof, 성공 deposit와 treasury scan, 1-input/3-output batch proof, 성공 batch, EMP-A/B/C scans와 audit verification이 같은 clean run에서 모두 확인됐을 때만 선언한다. 하나라도 없으면 Path B로 운영한다. Clairveil local success로 Path A를 대신하지 않는다.

### 2.4 Clairveil actual local smoke

```bash
bun run demo/scripts/run.ts --target clairveil-local --action payroll \
  --clairveil ../clairveil \
  --out evidence/local/facilitator-smoke.json
```

`CLAIRVEIL LOCAL PAYROLL AND FAILURE CONTROLS VERIFIED`, deposit/batch `code=0`, deposit `300uclair`, proof 1개와 공개 digest, input 1/output 3, 서로 다른 EMP-A/B/C의 `100/120/80uclair` scan을 확인한다. 이어 public event에 평문 급여 필드가 없고, `301uclair` overspend는 proof/broadcast 전 거부되며, EMP-B 대신 EMP-C로 보낸 `120uclair`는 chain 성공·업무 실패로 기록되는지 확인한다. 커리큘럼은 실행·판독·토론에 17분을 배정한다. 완료 시간이 10분을 넘으면 참가자별 Go cache와 CPU 여유를 사전 점검한다. evidence label은 `[Local]`이어야 한다.

### 2.5 T-30분

1. Maroo doctor/preflight를 다시 실행한다.
2. faucet, explorer, public RPC에서 receipt 조회를 확인한다.
3. company balance와 address/key self-check 결과만 확인한다.
4. 참가자별 `../clairveil` SHA, Go cache, 디스크 여유를 확인한다.
5. `anvil --version`, `cast --version`, `forge --version`이 모두 성공하는지 표본 확인한다.
6. Path A 또는 Path B를 첫 화면에 명시한다.
7. 저장된 Maroo 실패 tx 2개와 Clairveil local evidence를 대체 자료로 준비한다.
8. Maroo scanner 미준비 시 직원 scan 성과가 미검증으로 남는다고 공지한다.

## 3. 75분 진행표

<!-- workshop-agenda:start -->
| 시간 | 구간 | 진행자 행동 | 중단 기준 |
|---|---|---|---|
| **00–07** | Maroo 목표·역할 | company signer와 employee scanner 역할, 공개/비공개 가설 확인 | 05분에 역할표 미작성 참가자 지원 |
| **07–17** | 공통 환경 setup | Bun·Go·Git·Foundry·Clairveil readiness와 개인 plan 확인 | 14분에 실패자는 setup 지원 또는 observer 경로로 전환 |
| **17–27** | Maroo readiness | doctor/preflight와 public state 교차 확인 | 24분에 chain/key/funding 실패자는 broadcast 중단 |
| **27–44** | Clairveil 정상·관찰·실패 실습 | happy path, 공개/직원 관찰, overspend·오지급 marker 확인 | 41분에 실패자는 저장 local evidence로 판정 실습 |
| **44–52** | Maroo 대응 관계·통제 설계 | PCL 경계, employee-address binding과 각 참가자의 Path A/B 확인 | 49분에 path 미확정이면 Path B로 고정 |
| **52–63** | Maroo deposit→transfer | 회사 signer의 명시적 승인 뒤 두 호출 순서 통제 | 60분에 미포함이면 RPC/tx hash evidence 수집 |
| **63–69** | receipt·직원 확인·실패 경계 | receipt/delivery 분리와 first-failure·evidence label 판정 | 68분에 미검증·과장 문장 수정 |
| **69–75** | 종료·다음 단계 | exit ticket, secret scan, PoC owner 확인 | 74분에 evidence 경로 확인 |
<!-- workshop-agenda:end -->

## 4. 구간별 진행

### 00–07 — Maroo 문제부터 시작

“오늘의 제품 대상과 외부 호출 기준은 Maroo Testnet이다. Clairveil은 그 사이에서 `x/privacy` proof·note·scanner를 실제로 확인하는 구현 참고다”라고 선언한다.

- **Success criteria:** O1 역할·가시성 가설 완성.
- **토론 질문:** 직원 EVM 주소로 native transfer하지 않는 이유는 무엇인가?

### 07–17 — 공통 환경 setup

설치는 사전 과제로 끝내되 수업 중 전원이 다음 readiness를 같은 순서로 실행한다.

```bash
bun --version
go version
anvil --version
cast --version
forge --version
git -C ../clairveil rev-parse HEAD
bun install --cwd demo --frozen-lockfile
bun run demo/scripts/check-workshop-environment.ts
bun run --cwd demo typecheck
```

환경 checker는 secret을 읽거나 node를 시작하지 않는다. 도구 설치와 지정 source만 확인한다. 이어 `.env` 역할과 개인 plan을 확인한다. 누락된 바이너리는 setup 지원으로 보내고, 14분에도 해결되지 않으면 해당 참가자는 제공 evidence를 판독하는 observer로 전환하되 종료표에는 “본인 실행 미완료”로 남긴다.

- **Success criteria:** `WORKSHOP ENVIRONMENT READY`, typecheck, Clairveil SHA, company/employee 역할 분리.
- **토론 질문:** Foundry 설치 확인과 범용 Anvil 실습은 왜 서로 다른가?

### 17–27 — Maroo readiness

참가자별 `doctor.json`, `preflight.json`을 확인한다. 공통 RPC 오류가 30% 이상이면 live broadcast를 중단하고 저장 receipt 판독으로 전환한다. 개인 key/funding 오류는 해당 참가자만 read-only로 전환한다.

- **Success criteria:** O4 chain 450815, funding pass, public account 분리.
- **토론 질문:** policy raw response와 “sender가 허용됨”은 같은 주장인가?

### 27–44 — Clairveil actual `x/privacy` 정상·실패 통제

한 명령이 정상 payroll과 두 통제 사례를 같은 임시 체인에서 수행한다. 구간을 다음처럼 timebox한다.

- **27–35:** 정상 deposit→one-proof batch→EMP-A/B/C scan과 public event 비교.
- **35–39:** `300→301`을 prepare해 proof/broadcast 전 거부와 treasury note 불변 확인.
- **39–44:** EMP-B 대신 유효한 EMP-C 주소로 `120`을 전송해 tx 성공, EMP-B 신규 note 0, EMP-C 신규 note 1 확인.

참가자가 터미널 로그보다 `observationComparison`과 `failureControls`를 읽도록 유도한다. 오지급 사례는 프로토콜 실패가 아니라 승인된 plan과 output 수취인 binding이 빠진 업무 통제 실패다. Clairveil Local에는 Maroo PCL이 없다고 다시 확인한다.

- **Success criteria:** O2·O3 정상 scan 3개, 공개/비공개 관찰 분리, overspend 무상태 거부, 오지급 chain success/payroll failure.
- **토론 질문:** 왜 두 사례 중 하나만 transaction rejection이며, `code=0`만으로 지급 완료라고 할 수 없는가?

### 44–52 — Clairveil/Maroo 매핑, PCL 경계와 Path A/B 확정

- 공통 개념: deposit, treasury note, nullifier, batch output, recipient scan, disclosure.
- 다른 계약: asset, runtime, 외부 ABI, PCL, VK·artifact compatibility, scanner format.
- Path A: adapter provenance, bundle label, target, value, expiry, output 3 확인.
- Path B: dummy ZK input이고 성공용이 아니라 rejection probe임을 확인.

칠판에 다음 세 줄을 분리해 쓴다.

1. `PCL`: 활성 정책에 따라 effective sender의 denylist/EAS 등 정책을 typed reason으로 거부한다.
2. `Privacy`: root·nullifier·proof와 가치 보존을 검증한다.
3. `Application/prover`: 승인된 EMP-B↔shielded-address registry와 payroll plan digest를 실제 output에 결속하고, receipt 뒤 scanner로 대사한다.

Maroo private transfer 금액은 PCL operation에서 `value=0`으로 모델링되고 공개 `IPrivacy.transfer` struct에 직원 EVM recipient가 없다는 문서·ABI를 보여준다. 그러므로 별도 recipient identity 정책과 proof binding의 실제 evidence가 없는 상태에서 PCL이 주소 착오를 자동 차단한다고 설명하지 않는다. 반대로 company signer가 denylist이거나 필수 EAS가 없고 해당 정책이 활성화된 경우는 PCL rejection 사례다.

참가자가 `bun run demo/scripts/rehearse.ts --offline`을 실행해 EMP-B output metadata에 EMP-C `profileRef`를 넣은 bundle이 broadcast 전에 거부되고 `MAROO ADAPTER RECIPIENT CONTROL PASSED`가 출력되는지 확인한다. 이 결과는 `[Simulation]` metadata guard이며 Maroo-compatible proof의 recipient binding 증거가 아니다.

모든 참가자가 `COMPANY_ACCOUNT`와 Maroo Privacy target을 비교한 뒤에만 이동한다.

- **Success criteria:** 실행 카드에 차이 5개와 path·signer·target·예상 결과, PCL/Privacy/application 세 통제 owner가 있고 adapter recipient control marker가 확인됨.
- **토론 질문:** 정책상 허용된 EMP-C 주소로 EMP-B 급여를 보냈다면 PCL 통과 후에도 어느 검증이 실패해야 하는가?

### 52–63 — Maroo deposit→transfer

Path B 정본 명령은 다음과 같다.

```bash
bun run demo/scripts/run.ts --target maroo-testnet --action attempt \
  --kind privacy-deposit-transfer-probes \
  --env demo/.env --broadcast --ack-state-change MAROO_TESTNET_ONLY \
  --out evidence/live-testnet/state-change-attempt.json
```

runner가 deposit raw transaction의 terminal evidence를 얻은 뒤 transfer를 제출하는지 확인한다. Path A 참가자는 deposit receipt와 treasury note scan이 성공한 뒤에만 batch로 이동한다.

- **Success criteria:** 성공이면 receipt/event/scan, 실패면 두 tx hash 또는 RPC failure의 UTC·stage·환경·재현 명령.
- **토론 질문:** 왜 employee key가 아니라 company key가 두 호출을 서명하는가?

### 63–69 — receipt·delivery와 오류 경계

Maroo deposit receipt, transfer receipt, EMP-A/B/C delivery, audit disclosure를 각각 성공·거부·누락·미검증으로 판정한다. Path B 참가자는 Maroo 직원 수신을 “발생하지 않음/미검증”으로 적는다. Clairveil scan은 판정 방법의 참고 결과로 옆 열에 둔다.

local validator → RPC stage → PCL → Privacy/proof → scanner/auditor → business reconciliation 순서로 첫 실패 계층을 찾는다. PCL typed selector가 없는 오류를 PCL rejection으로 단정하지 않고, receipt 성공·의도 불일치는 `business-intent failure`로 적는다.

- **Success criteria:** receipt/delivery/business intent가 별도 열에 있고, 첫 실패 계층과 `[Local]`/`[Live Testnet]`/`[Simulation]` label이 섞이지 않음.
- **토론 질문:** chain 성공·scan 실패와 raw reason 없는 revert를 각각 어떻게 처리해야 하는가?

### 69–75 — 종료

O1~O6, label, 미검증 항목, 다음 owner, evidence 위치를 확인한다. private key/mnemonic이 발견되면 업로드를 중단하고 테스트 키를 교체한다.

- **Success criteria:** 6개 성과 판정, secret-free evidence, 4~8주 owner.
- **토론 질문:** 다음 PoC의 첫 blocker는 prover/VK, PCL/EAS, custody, scanner 중 무엇인가?

## 5. 장애 시 대체 진행

| 장애 | 진행자 조치 | 얻는 것 | 얻지 못하는 것 |
|---|---|---|---|
| Clairveil SHA 불일치 | 지정 commit으로 맞춘 뒤 ready 재실행 | source provenance | 당일 local proof |
| Go build·artifact 생성 지연 | 전날 만든 local evidence로 판정 실습 | proof/note/scan 구조 이해 | 본인 local tx·proof |
| Clairveil node·proof 실패 | `--keep-on-failure` 경로와 로그 수집 후 저장 evidence 사용 | 정확한 local 실패 증거 | local happy path |
| Maroo RPC 장애 | 저장 live receipts를 `cast`로 판독 | receipt/오류 분류 | 당일 RPC submission |
| funding/key 실패 | read-only doctor와 저장 receipt 사용 | address/policy 이해 | 본인 state change |
| 호환 Maroo prover 없음 | Path B actual rejection 실행 | Maroo target·signer·broadcast·revert | valid deposit, outputs, scans |
| Maroo scanner 없음 | chain receipt까지 판정하고 미검증 표시 | delivery 경계 이해 | Maroo 직원 ownership 확인 |
| 모든 실행 불가 | offline rehearsal JSON 대사 | validation 규칙 | 실제 chain/proof |

대체 진행은 evidence label을 승격하지 않는다.

## 6. 종료 체크리스트

- [ ] 참가자마다 path와 evidence 위치가 있다.
- [ ] Clairveil deposit·one-proof batch·EMP-A/B/C scan을 직접 판정했다.
- [ ] public/employee 관찰 차이와 overspend·오지급 통제 결과를 직접 판정했다.
- [ ] Maroo doctor/preflight를 완료했다.
- [ ] Maroo deposit→transfer를 성공 또는 정확한 failure로 닫았다.
- [ ] Maroo EMP-A/B/C scan과 audit를 성공/누락/미검증으로 구분했다.
- [ ] PCL·Privacy/proof·RPC 오류 계층을 구분했다.
- [ ] 정책상 허용된 잘못된 수취인은 PCL 단독으로 방지되지 않으며 address registry·plan binding·scan 대사가 필요함을 설명했다.
- [ ] Clairveil 결과를 Maroo 성공으로 표시하지 않았다.
- [ ] evidence에 비밀정보가 없다.
- [ ] 각자 4~8주 PoC owner를 정했다.

## 7. 워크숍 종료 후

24시간 안에 공통 오류를 계층별로 집계한다. 1주 안에 Clairveil 참고 구현과 Maroo prover/VK/scanner의 compatibility owner, PCL/EAS owner, employee↔shielded-address registry owner를 정하고, 4주 안에 승인된 plan/output binding을 포함한 합성 직원 3~10명의 Maroo Testnet success run 또는 명확한 blocker report를 만든다.
