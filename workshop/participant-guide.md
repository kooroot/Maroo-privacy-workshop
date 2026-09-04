# 참가자 가이드 — Maroo Testnet 우선 75분 실습

이 문서가 참가자용 정본이다. 한 사람이 자기 checkout·테스트 계정·evidence 디렉터리에서 처음부터 끝까지 수행한다. Maroo Testnet이 제품 대상이고, Clairveil은 `x/privacy` 내부 동작을 직접 확인하는 구현 참고 실습이다.

## 0. 학습 목표

종료 시 다음을 직접 보여줄 수 있어야 한다.

- Maroo chain `450815`, OKRW, PCL, Privacy precompile을 조회한다.
- 회사 signer가 300 tOKRW 상당 deposit과 후속 transfer를 제출하는 구조를 설명한다.
- Clairveil Local에서 실제 `x/privacy` deposit과 one-proof 3-output batch를 실행한다.
- 서로 다른 EMP-A/B/C profile로 batch transaction에 결합된 note를 각각 scan한다.
- 공개 batch event와 직원별 private scan이 보여주는 정보를 비교한다.
- overspend 거부와 유효 주소 오지급을 실행하고 Privacy·PCL·업무 통제의 책임을 구분한다.
- Maroo에서 deposit→transfer를 실제 시도하고 성공 또는 rejection receipt를 판정한다.
- Clairveil 구현 참고·Maroo Testnet·offline simulation·프로덕션의 경계를 구분한다.

## 1. 사전 요구 사항과 준비 상태 확인

- macOS.
- Bun 1.4+, TypeScript 7, Git, Go 1.25 계열.
- Foundry 도구 모음 `anvil`, `cast`, `forge`. 수업에서 직접 사용하는 명령은 주로 `cast`다.
- 이 repository와 같은 상위 폴더의 `../clairveil` checkout.
- Maroo 테스트넷 전용 회사 계정과 키, 회사와 다른 직원 공개 계정.
- 회사 계정의 300 tOKRW 상당 + 두 transaction gas + 재시도 여유.
- 실제 직원 데이터·운영 지갑·운영 키를 사용하지 않는다.

도구 설치와 두 repository clone은 워크숍 전에 마친다. 버전·의존성·Clairveil SHA 확인과 `.env` 구성은 **07–17분 공통 setup**에서 모두 함께 한다. 설치 자체가 끝나지 않았다면 시작 전에 진행자 setup 지원을 받는다.

`demo/.env`의 역할은 다음과 같다.

```dotenv
COMPANY_ACCOUNT=0x회사_테스트넷_주소
COMPANY_PRIVATE_KEY=회사_테스트넷_주소와_일치하는_키
EMPLOYEE_ACCOUNT=0x회사와_다른_직원_공개_주소
```

직원 private key는 이 워크숍에 넣지 않는다. EMP-A·B·C의 Clairveil shielded profile은 실행 중 임시 작업 디렉터리에 생성되며 EVM 공개 주소와 별도다.

## 2. 75분 실행표

<!-- workshop-agenda:start -->
| 시간 | 구간 | 참가자 산출물 |
|---|---|---|
| **00–07** | Maroo 목표·역할 | 공개/비공개 가설과 signer/profile 역할표 |
| **07–17** | 공통 환경 setup | Foundry·Bun·Go·Clairveil readiness와 개인 plan |
| **17–27** | Maroo readiness | doctor·preflight JSON |
| **27–44** | Clairveil 정상·관찰·실패 실습 | actual payroll, 공개/직원 관찰, overspend·오지급 evidence |
| **44–52** | Maroo 대응 관계·통제 설계 | local/Maroo 차이, PCL·address binding, Path A/B 범위 |
| **52–63** | Maroo deposit→transfer | 성공 receipt 또는 두 live rejection tx |
| **63–69** | receipt·직원 확인·실패 경계 | receipt/delivery와 PCL/Privacy/proof 판정 |
| **69–75** | 종료·다음 단계 | exit ticket, evidence index, PoC owner |
<!-- workshop-agenda:end -->

## 3. 구간별 실습

### 00–07 — Maroo 목표와 역할

Maroo 급여표는 EMP-A 100, EMP-B 120, EMP-C 80, 총 300이다. 다음을 먼저 적는다.

1. deposit에서 explorer에 공개될 것으로 보는 값.
2. payroll output에서 감춰져야 하는 값.
3. 회사 signer, employee scanner, auditor가 각각 보유하는 키.

**Success criteria O1:** 회사가 deposit과 transfer gas를 내며, 직원은 EVM 공개 transfer가 아니라 자기 privacy output을 scan한다는 점을 설명한다.

**토론 질문:** deposit 총액 공개와 직원별 금액 비공개는 동시에 성립할 수 있는가?

### 07–17 — 공통 환경 setup

repository root에서 다음을 그대로 실행한다.

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
test -f demo/.env || cp demo/.env.example demo/.env
```

Clairveil SHA는 `ca85b02708fdd75259d4d2ee2d671c21198cec69`여야 한다. `WORKSHOP ENVIRONMENT READY`가 출력되면 Bun 1.4+, Go, Git, Foundry 전체와 Clairveil source가 준비된 것이다. 이 단계에서 `anvil` chain을 띄우거나 Foundry 사용법을 배우지는 않는다. 이후 `cast`는 Maroo 공개 상태와 receipt를 독립 확인하는 데 사용한다.

`demo/.env`에 위 역할표의 테스트넷 계정을 채운 뒤 개인 실행 plan을 만든다.

```bash
mkdir -p evidence/run
bun run demo/scripts/create-participant-plan.ts \
  --participant 01 --out evidence/run/participant-01-payroll-plan.json
export PLAN=evidence/run/participant-01-payroll-plan.json
```

**Success criteria O6:** environment marker와 typecheck가 통과하고, Clairveil SHA가 일치하며, company signer·employee public account·shielded profile의 역할을 서로 바꾸지 않는다.

**중단 기준:** 도구 누락, Bun 1.4 미만, Clairveil SHA 불일치 또는 TypeScript 오류가 있으면 chain 실행으로 가지 않고 setup 지원을 받는다.

**토론 질문:** 도구 버전이 모두 맞아도 `COMPANY_PRIVATE_KEY`가 `EMPLOYEE_ACCOUNT`의 키라면 왜 준비 완료가 아닌가?

### 17–27 — Maroo readiness

```bash
mkdir -p evidence/live-testnet
bun run demo/scripts/run.ts --target maroo-testnet --action doctor \
  --env demo/.env --out evidence/live-testnet/doctor.json
bun run demo/scripts/run.ts --target maroo-testnet --action preflight \
  --env demo/.env --plan "$PLAN" \
  --out evidence/live-testnet/preflight.json
```

`cast`는 새로운 학습 주제가 아니라 Maroo 공개 상태를 교차 확인하는 관찰 도구로만 쓴다.

```bash
set -a; source demo/.env; set +a
cast chain-id --rpc-url "$MAROO_RPC_URL"
cast balance --rpc-url "$MAROO_RPC_URL" "$COMPANY_ACCOUNT"
cast call --rpc-url "$MAROO_RPC_URL" "$MAROO_OKRW_PRECOMPILE" --data 0x5e615a6b
cast call --rpc-url "$MAROO_RPC_URL" "$MAROO_PCL_PRECOMPILE" 'policyAdmin()(address)'
cast call --rpc-url "$MAROO_RPC_URL" "$MAROO_PCL_PRECOMPILE" \
  'contractPolicies(address)' "$MAROO_PRIVACY_PRECOMPILE"
```

**Success criteria O4:** chain id `450815`, Privacy 주소 `0x100000000000000000000000000000000000000b`, `checks.funding="deposit-minimum-pass"`, UTC와 public company/employee address가 evidence에 있다.

**중단 기준:** chain 불일치, 회사 key/address 불일치, funding 실패면 broadcast 구간으로 가지 않는다.

**토론 질문:** 조회된 contract policy가 비어 있을 때 이를 “PCL 통과”라고 말할 수 있는가?

### 27–44 — Clairveil Local 정상·관찰·실패 검증

다음 한 명령이 임시 localnet을 구성하고 실제 상태 변경을 수행한다.

```bash
mkdir -p evidence/local
bun run demo/scripts/run.ts --target clairveil-local --action payroll \
  --clairveil ../clairveil \
  --out evidence/local/payroll-summary.json
```

runner가 순서대로 수행하는 일은 다음과 같다.

1. 고정 commit의 `clairveild`와 `clairveil-setup`을 빌드한다.
2. 새 임시 chain과 회사 `alice`, EMP-A/B/C, auditor profile을 만든다.
3. ZK artifact checksum을 생성·검증하고 local node를 시작한다.
4. 회사가 총 `300uclair`를 `x/privacy`에 deposit한다.
5. 같은 note로 합계 `301uclair` 지급을 prepare해 입력 선택 단계에서 거부되는지 확인한다. proof와 broadcast는 실행되지 않아야 하며 treasury note는 그대로여야 한다.
6. treasury note 1개를 입력으로 실제 `transfer-batch-16x32` proof 하나를 만든다.
7. 한 batch transaction으로 EMP-A/B/C에 각각 `100/120/80uclair` output을 만든다.
8. 공개 `batch_transfer` event에서는 input/output 수와 commitment/nullifier root를, 서로 다른 직원 profile에서는 자기 `100/120/80uclair` note를 확인한다.
9. 주소 착오 전용 `120uclair`를 별도 deposit하고, EMP-B 지급이라는 업무 의도와 다르게 유효한 EMP-C shielded address로 실제 전송한다.
10. 오지급 transaction은 `code=0`이지만 EMP-B 신규 note는 0, EMP-C의 해당 transaction 신규 note는 1인지 확인한다.
11. proof artifact의 공개 digest를 계산하고 local node·임시 키 material을 정리한 뒤 공개 가능한 digest·tx evidence만 남긴다.

결과를 확인한다.

```bash
bun -e "const e=await Bun.file('evidence/local/payroll-summary.json').json(); console.log({label:e.label,deposit:e.transactions.deposit,batch:e.transactions.payrollBatch,observations:e.observationComparison,controls:e.failureControls})"
```

다음 판정표를 채운다.

| 관찰 | 기대 결과 | 판정 |
|---|---|---|
| 정상 payroll | deposit/batch `code=0`, proof 1, EMP-A/B/C scan 각 1 | Privacy happy path |
| 공개 event | input 1/output 3, commitment/nullifier root; 직원 ID·평문 금액 없음 | public observer |
| 직원 scan | 자기 transaction-bound note와 금액 복구 | private employee observer |
| `300→301` | `wallet-input-selection-before-proof`, `broadcastAttempted=false`, treasury note count 불변 | Privacy resource rejection |
| EMP-B 대신 EMP-C | transfer `code=0`, EMP-B 신규 note 0, EMP-C `120uclair` 신규 note 1 | chain success / business-intent failure |

**Success criteria O2·O3:** `CLAIRVEIL LOCAL PAYROLL AND FAILURE CONTROLS VERIFIED`, 정상 3인 지급과 공개/비공개 관찰 차이가 확인되고 두 통제 사례가 위 표와 정확히 일치한다.

**중요:** 이것은 actual Clairveil `x/privacy`의 `[Local]` 증거다. 실제 proof와 scan을 수행하지만 자산은 `uclair`, runtime은 Cosmos localnet이고 Maroo OKRW·PCL·EVM ABI·VK 호환을 증명하지 않는다.

**토론 질문:** 왜 `300→301`은 거부되지만 유효한 EMP-C 주소로 보낸 `120`은 chain에서 성공하며, 후자는 누구의 통제 실패인가?

<a id="maroo-path"></a>

### 44–52 — Clairveil 결과를 Maroo에 매핑하고 통제 설계

Clairveil evidence에서 proof count, input/output 수, tx hash, 직원별 note 결합을 확인한다. 그다음 Maroo target과 selectors를 고정한다.

```bash
cast sig 'deposit((bytes,bytes,bytes))'
cast sig 'transfer((bytes,bytes,bytes[],bytes[],bytes[],bytes[],uint32,bytes,uint8,bytes,bytes,bytes,bytes,bytes,bytes,bytes,uint64))'
echo "$MAROO_PRIVACY_PRECOMPILE"
```

둘 중 하나만 선택한다.

- **Path A — 호환 bundle 보유:** adapter가 `[Live Testnet]`, `broadcastable=true`, chain `450815`, target Privacy precompile, 미래 expiry, deposit 300e18, payroll output 3을 보장해야 한다.
- **Path B — 호환 prover 미보유:** ABI-valid하지만 ZK 값이 무효인 deposit→transfer rejection probe 두 건을 실제 제출한다. 이것은 성공 deposit이나 직원 지급이 아니다.

현재 저장된 제출 evidence는 Path B다. Clairveil proof를 Path A 입력으로 복사하지 않는다.

#### 실패 원인과 Maroo 해결 경계

| 사례 | Maroo에서 자동으로 기대할 수 있는 것 | 추가로 구현해야 하는 것 |
|---|---|---|
| 보유 note보다 많은 private transfer | 유효하지 않은 가치 보존 proof를 Privacy가 거부 | prover 전 spendable-note 합계 확인과 재시도 UX |
| 회사 signer가 denylist이거나 필수 EAS 없음 | 해당 정책이 Privacy에 활성화돼 있으면 PCL typed reason으로 거부 | preflight에서 실제 policy config·principal·attestation 확인 |
| EMP-B 대신 정책상 허용되는 EMP-C shielded address | PCL 통과와 proof 성공 가능 | 승인된 employee↔shielded-address registry, plan digest 승인, prover output binding, 제출 전 fail-closed 비교, 제출 후 scan 대사 |

Maroo Privacy 프리컴파일은 모든 변경 호출을 PCL로 평가한다. 그러나 공개 ABI의 private `transfer`에는 직원 EVM `recipient` 필드가 없고, [공식 Privacy 문서](https://docs.maroo.io/concepts/privacy/privacy-precompile-overview)는 숨겨진 transfer 금액을 PCL operation에서 `value=0`으로 모델링한다고 명시한다. 따라서 일반 PCL 한도나 “PCL을 거쳤다”는 사실만으로 숨겨진 급여 금액과 EMP-B 주소 매핑이 맞다고 주장하지 않는다.

Path A adapter는 제출 전에 다음 순서로 fail closed해야 한다.

1. 회사 signer의 PCL/EAS 조건을 현재 chain state로 확인한다.
2. 승인된 직원 registry에서 EMP-A/B/C의 shielded profile identifier와 address digest를 읽는다.
3. 승인된 payroll plan digest와 prover가 만든 세 output의 employee/profile/amount binding을 비교한다.
4. 세 binding 중 하나라도 다르면 서명·broadcast 전에 종료한다.
5. 성공 receipt 뒤에도 EMP-A/B/C scanner report를 대사해 업무 완료를 별도로 판정한다.

현재 저장소가 담당하는 plan/profile metadata 경계는 offline control로 직접 확인한다.

```bash
bun run demo/scripts/rehearse.ts --offline
```

이 command는 EMP-B output의 `profileRef`를 EMP-C의 값으로 바꾼 bundle을 validator에 넣고 `MAROO ADAPTER RECIPIENT CONTROL PASSED: wrong EMP-B profile rejected before broadcast`를 확인한다. 이는 `[Simulation]`이며 encrypted output 내부 수취인과 Maroo proof의 호환성을 증명하지는 않는다. 실제 Path A adapter가 registry에서 resolve한 shielded key를 output/proof에 결속하는 책임은 그대로 남는다.

PCL이 employee recipient attestation까지 검사하도록 별도 정책·proof를 설계했다면 그 설정과 typed rejection을 실제 evidence로 확인한 뒤에만 “PCL이 주소 착오를 차단한다”고 말한다.

**Success criteria O6:** Clairveil과 Maroo의 asset/runtime/ABI/PCL/VK 차이, 선택한 path, target, signer와 함께 PCL이 막는 signer-policy 실패와 application/prover가 막아야 하는 수취인 매핑 실패가 구분되고 adapter recipient control marker가 확인된다.

**토론 질문:** PCL 통과, proof 성공, EMP-B 지급 완료 중 서로 대신할 수 없는 판정은 무엇인가?

### 52–63 — Maroo deposit→transfer 제출

#### Path B — 현재 완전 실행 가능한 경로

회사 signer로 deposit을 먼저, transfer를 다음에 제출한다.

```bash
bun run demo/scripts/run.ts --target maroo-testnet --action attempt \
  --kind privacy-deposit-transfer-probes \
  --env demo/.env --broadcast --ack-state-change MAROO_TESTNET_ONLY \
  --out evidence/live-testnet/state-change-attempt.json
```

`stateChangingTransactionAttempted=true`이고 두 operation 모두 `rpc-broadcast` 뒤 tx hash 또는 RPC rejection을 가져야 한다. 현재 재현된 receipt는 다음과 같다.

- deposit: `0xaa36463028962fccb246897d45bf13e43f6ef3da3cb6522fe4d3bdc82bd2c939`, `status=0x0`.
- transfer: `0x3d3d6bbba494127e776a7014acbdc3e087b680a0190b642baf21bbdc87efb622`, `status=0x0`.

#### Path A — 호환 bundle이 있을 때

```bash
bun run demo/scripts/validate-request.ts --plan "$PLAN" \
  --bundle evidence/live-testnet/deposit-bundle.json --live
bun run demo/scripts/run.ts --target maroo-testnet --action submit \
  --plan "$PLAN" --bundle evidence/live-testnet/deposit-bundle.json \
  --env demo/.env
bun run demo/scripts/run.ts --target maroo-testnet --action submit \
  --plan "$PLAN" --bundle evidence/live-testnet/deposit-bundle.json \
  --env demo/.env --broadcast --out evidence/live-testnet/deposit-submit.json
```

deposit 성공 receipt와 treasury note scan을 확인한 뒤에만 `payroll-bundle.json`을 같은 순서로 estimate/broadcast한다. `singleProofBatchTransfer` bundle은 EMP-A·B·C output이 정확히 3개여야 한다. 자세한 schema는 [adapter contract](../demo/adapter-contract.md)를 따른다.

**Success criteria O5:** 성공이면 `status=0x1`과 event를, 실패면 tx hash·`status=0x0` 또는 RPC error·UTC·환경·재현 명령을 남긴다. Path B를 Path A 성공으로 표시하지 않는다.

**토론 질문:** 왜 `COMPANY_PRIVATE_KEY`가 두 transaction을 서명하고 직원 계정의 private key는 필요하지 않은가?

### 63–69 — receipt·직원 확인과 실패 경계

Path B evidence를 공개 RPC로 교차 확인한다.

```bash
cast receipt --rpc-url "$MAROO_RPC_URL" 0xaa36463028962fccb246897d45bf13e43f6ef3da3cb6522fe4d3bdc82bd2c939
cast receipt --rpc-url "$MAROO_RPC_URL" 0x3d3d6bbba494127e776a7014acbdc3e087b680a0190b642baf21bbdc87efb622
```

Path A 성공 시 adapter의 receipt action과 EMP-A·B·C scanner report 3개를 대사한다. receipt `status=0x1`만으로 직원 수신을 완료 처리하지 않는다. Clairveil employee scans는 이 판정 방법을 실제로 보여주지만 Maroo scanner report를 대신하지 않는다.

첫 실패 계층은 다음 순서로 판정한다.

1. local bundle/schema/expiry 검증.
2. RPC preparation·estimate·broadcast·receipt 단계.
3. PCL typed selector.
4. Privacy input/proof 문자열 또는 unknown revert.
5. receipt 성공 뒤 scanner/auditor 실패.

Clairveil proof/scan은 `[Local]`, Maroo probe는 `[Live Testnet]`, offline fixture는 `[Simulation]`으로 적는다.

**Success criteria O3·O5·O6:** Clairveil의 scan 3개와 두 통제 사례가 확인됐고, Maroo chain receipt와 Maroo employee delivery는 별도 열로 성공·거부·미검증 판정돼 있으며 PCL rejection·Privacy rejection·business-intent failure와 evidence label이 구분돼 있다.

**토론 질문:** 현재 Maroo deposit rejection과 직원 scan 미완료는 각각 어느 계층이며, 어떤 evidence가 그 판정을 지지하는가?

### 69–75 — 종료와 다음 단계

```bash
cp workshop/exit-ticket.md evidence/exit-ticket.md
bun run demo/scripts/check-submission.ts --draft
```

[exit ticket](exit-ticket.md)에 다음을 자기 결과로 적는다.

1. 공개된 값과 감춰져야 할 값.
2. company signer와 employee scanner의 책임.
3. Clairveil/Maroo/offline 결과의 라벨.
4. prover/VK·PCL/EAS·employee address registry·key custody·scanner 중 다음 PoC owner.

**Success criteria O1~O6:** evidence index가 있고 private key/mnemonic이 없으며, 성공·거부·미검증을 구분하고 4~8주 다음 owner를 지정했다.

**토론 질문:** 조직이 다음 주에 가장 먼저 닫아야 할 Maroo 호환성 질문은 무엇인가?

## 4. 초기화와 정리

Clairveil runner는 성공 시 임시 localnet·키·artifact를 자동 삭제한다. 실패 분석이 필요할 때만 `--keep-on-failure`를 붙이고 출력된 임시 경로를 로컬에서 점검한다. 해당 경로를 제출하거나 공유하지 않는다.

새 run 전 evidence는 먼저 목록을 확인한 뒤 archive한다.

```bash
bun run demo/scripts/reset-evidence.ts
bun run demo/scripts/reset-evidence.ts --apply
```

Clairveil local tx는 임시 node 종료 후 조회할 수 없으므로 공개 가능한 [payroll-summary.json](../evidence/local/payroll-summary.json)을 보존한다. Maroo tx는 explorer와 public RPC로 다시 확인한다.

## 5. 워크숍 종료 후 다음 단계

- 1주차: Clairveil 참고 flow와 Maroo-compatible prover/VK/scanner의 차이 및 owner 확정.
- 2주차: company/employee PCL·EAS principal, policy matrix와 employee↔shielded-address registry 계약 작성.
- 3주차: viewing/audit key custody·회전·복구 설계.
- 4주차: 3~10명 합성 payroll을 Maroo Testnet에서 end-to-end 재현.
- 5~8주차: idempotency, stale root/nullifier, reconciliation, 성능·가스·SLA를 검증하고 파일럿 go/no-go 결정.
