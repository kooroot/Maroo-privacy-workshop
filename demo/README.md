# Runnable Demo — Confidential Payroll

이 데모는 하나의 급여 원장을 다음 다섯 판정으로 연결한다.

```text
300 OKRW deposit
→ treasury note
→ one-proof / three-output payroll batch
→ EMP-A/B/C 별도 scan
→ auditor disclosure verification
```

코드는 proof나 scan 결과를 위조하지 않는다. 정본은 Maroo Testnet submit/reconcile 경로다. Clairveil Local에서는 참가자가 actual `x/privacy` proof·note·scanner 흐름을 구현 참고로 직접 실행한다.

## 1. 무엇이 구현됐나

| 경로 | 실제 동작 | 라벨 | 경계 |
|---|---|---|---|
| Maroo preflight | live RPC에서 chain/balance/OKRW/PCL raw state 조회 | `[Live Testnet]` | 상태 변경 없음 |
| Maroo submit | 호환 adapter bundle의 selector/plan/value/output/expiry 검증 후 estimate 또는 broadcast | `[Live Testnet]` | proof 생성·scan은 외부 adapter 책임 |
| Maroo attempt recorder | 명시적 승인 뒤 호환 Privacy bundle 또는 ABI-valid `IPrivacy.deposit`+`transfer` rejection probes를 실제 RPC에 전송하고 성공·거부 evidence 저장 | `[Live Testnet]` | probe는 유효 proof/Privacy payroll 성공이 아님 |
| Evidence reconciliation | receipt, 세 employee report, audit report의 tx/plan/commitment/amount 대사 | 입력 라벨을 보존 | report 진실성은 adapter 구현과 키 custody에 의존 |
| Clairveil hands-on reference | 실제 로컬 chain에서 정상 payroll, 공개/직원 관찰 비교, overspend 거부, 성공한 오지급 실행 | `[Local]` | 구현 참고용 `uclair`/Cosmos; Maroo OKRW/PCL/EVM ABI/VK 아님 |
| Offline rehearsal | 결정적 fixture로 정상/누락/형태 오류 계약 검증 | `[Simulation]` | chain/proof/decrypt 없음 |

Maroo 테스트넷에서 deposit→3인 지급→3인 scan을 완료했다고 주장하려면 [Maroo live 준비 게이트](../workshop/facilitator-guide.md#23-maroo-live-준비-게이트)의 실제 evidence가 모두 있어야 한다.

## 2. 파일 지도

```text
demo/
├── .env.example
├── adapter-contract.md
├── package.json
├── tsconfig.json
├── fixtures/payroll-plan.json
├── shared/
│   ├── contracts.ts
│   ├── io.ts
│   ├── live-attempt.ts
│   ├── local-evidence.ts
│   ├── rehearsal.ts
│   ├── router.ts
│   ├── submission.ts
│   └── types.ts
├── adapters/
│   ├── maroo-testnet/index.ts
│   └── clairveil-local/
│       ├── index.ts
│       └── distinct-payroll.ts
├── scripts/
│   ├── run.ts
│   ├── plan-digest.ts
│   ├── create-participant-plan.ts
│   ├── validate-request.ts
│   ├── verify-evidence.ts
│   ├── rehearse.ts
│   ├── reset-evidence.ts
│   ├── check-workshop-environment.ts
│   ├── check-submission.ts
│   └── verify-workshop.ts
└── test/
    ├── contracts.test.ts
    ├── clairveil-local.test.ts
    ├── live-attempt.test.ts
    ├── router.test.ts
    └── submission.test.ts
```

- JSON 필드 정본: [adapter-contract.md](adapter-contract.md).
- 시간순 참가자 실행: [participant-guide.md](../workshop/participant-guide.md).
- 진행·전환 판단: [facilitator-guide.md](../workshop/facilitator-guide.md).
- 오류 분류: [troubleshooting.md](../workshop/troubleshooting.md).

## 3. Clean start

### 3.1 필수 환경

- macOS 검증. WSL2는 진행자가 같은 smoke를 사전 통과시킨 경우에만 사용한다.
- Bun 1.4 이상.
- TypeScript 7은 `bun install`로 고정 설치되며 `bun run --cwd demo typecheck`가 strict/no-emit 검사를 수행한다.
- Foundry `anvil`, `cast`, `forge`가 모두 설치돼 있어야 한다. 수업에서는 `cast`를 Maroo public state와 receipt 교차 확인에 사용한다.
- live 실행에는 테스트넷 전용 회사 계정과 Maroo 호환 adapter.
- 75분 actual `x/privacy` 참고 실습에는 `../clairveil` 지정 commit과 Go 1.25 계열이 필수.

```bash
bun --version
anvil --version
cast --version
forge --version
go version
git -C ../clairveil rev-parse HEAD
bun install --cwd demo --frozen-lockfile
bun run demo/scripts/check-workshop-environment.ts
test -f demo/.env || cp demo/.env.example demo/.env
mkdir -p evidence/run
bun run demo/scripts/create-participant-plan.ts \
  --participant 01 --out evidence/run/participant-01-payroll-plan.json
export PLAN=evidence/run/participant-01-payroll-plan.json
```

`demo/.env`에는 회사 `COMPANY_ACCOUNT`/`COMPANY_PRIVATE_KEY`와 별도 공개 `EMPLOYEE_ACCOUNT`를 채운다. 직원 private key는 필요하지 않으며 실제 회사 키 값은 stdout/evidence에 기록하지 않는다. Privacy transfer의 직원 수신자는 EVM 주소가 아니라 외부 prover가 proof/output에 결속하는 shielded profile이다.

환경 checker는 Bun 1.4+, Go, Git, Foundry 전체, Clairveil 고정 SHA를 확인하며 secret을 읽거나 state-changing transaction을 만들지 않는다. `anvil`·`forge` 사용법은 교육하지 않고 설치 일관성만 확인한다. 실제 수업 도구는 Maroo 조회용 `cast`와 Clairveil local runner다.

### 3.2 smoke

```bash
bun run --cwd demo check
bun run demo/scripts/check-workshop-environment.ts
```

기대 marker:

- `WORKSHOP CONTRACT TESTS PASSED`
- `WORKSHOP ADAPTER TESTS PASSED`
- `OFFLINE REHEARSAL PASSED`
- `CONTENT VERIFIED`, `LINKS AND CLAIMS VERIFIED`, `ADAPTER ARCHITECTURE VERIFIED`
- `SUBMISSION KIT VERIFIED`, `DRAFT SUBMISSION CHECK PASSED`
- `WORKSHOP ENVIRONMENT READY`

## 4. Maroo live run

### 4.1 Read-only preflight

```bash
mkdir -p evidence/live-testnet
bun run demo/scripts/run.ts --target maroo-testnet --action preflight \
  --env demo/.env \
  --plan "$PLAN" \
  --out evidence/live-testnet/preflight.json
```

저장 항목은 chain id, public account, balance, `IOkrw.getParams`, PCL global/contract policy raw response다. 정책을 decode하지 못했다면 raw capture라고만 쓴다.

### 4.2 과제 최소 live state-change attempt recorder

호환 Maroo Privacy deposit bundle이 있으면 실제 deposit attempt를 하나의 JSON으로 기록한다. `--ack-state-change`가 정확하지 않으면 env/private key를 읽기 전에 종료한다.

```bash
bun run demo/scripts/run.ts --target maroo-testnet --action attempt \
  --kind privacy-bundle \
  --plan "$PLAN" \
  --bundle evidence/live-testnet/deposit-bundle.json \
  --env demo/.env --broadcast --ack-state-change MAROO_TESTNET_ONLY \
  --out evidence/live-testnet/state-change-attempt.json
```

호환 bundle이 없을 때는 실제 Privacy precompile을 대상으로 deposit과 transfer rejection probe를 순차 실행한다. 두 호출은 ABI 구조는 정상이지만 ZK 입력이 의도적으로 무효다.

```bash
bun run demo/scripts/run.ts --target maroo-testnet --action attempt \
  --kind privacy-deposit-transfer-probes \
  --env demo/.env --broadcast --ack-state-change MAROO_TESTNET_ONLY \
  --out evidence/live-testnet/state-change-attempt.json
```

두 경로 모두 실제 RPC submission을 호출한 뒤 `stateChangingTransactionAttempted=true`여야 한다. probe 경로는 deposit과 transfer가 모두 submission을 호출해야 aggregate가 true다. 포함이면 각 tx/receipt/explorer URL, RPC 거부면 각 stage/UTC/환경/재현 명령/redacted 오류를 저장한다. probe 경로는 on-chain rejection 관찰이며 유효 proof, private deposit, EMP-A/B/C 지급의 증거가 아니다.

### 4.3 Deposit

먼저 prover adapter로 `deposit-bundle.json`을 만든다. adapter가 내야 하는 필드는 [계약](adapter-contract.md#21-deposit-bundle)에 정의돼 있다.

```bash
bun run demo/scripts/validate-request.ts \
  --plan "$PLAN" \
  --bundle evidence/live-testnet/deposit-bundle.json --live

# estimate only
bun run demo/scripts/run.ts --target maroo-testnet --action submit \
  --plan "$PLAN" \
  --bundle evidence/live-testnet/deposit-bundle.json \
  --env demo/.env

# explicit state change
bun run demo/scripts/run.ts --target maroo-testnet --action submit \
  --plan "$PLAN" \
  --bundle evidence/live-testnet/deposit-bundle.json \
  --env demo/.env --broadcast \
  --out evidence/live-testnet/deposit-submit.json
```

그 뒤 tx hash로 on-chain calldata/value/event를 reviewed bundle과 비교한다.

```bash
bun run demo/scripts/run.ts --target maroo-testnet --action receipt \
  --plan "$PLAN" \
  --bundle evidence/live-testnet/deposit-bundle.json \
  --tx 0x<deposit-tx-hash> \
  --out evidence/live-testnet/deposit-receipt.json \
  --env demo/.env
```

### 4.4 Three-output payroll

prover adapter는 deposit note를 scan한 뒤 EMP-A/B/C용 서로 다른 output과 audit disclosure를 만들어야 한다.

```bash
bun run demo/scripts/validate-request.ts \
  --plan "$PLAN" \
  --bundle evidence/live-testnet/payroll-bundle.json --live

bun run demo/scripts/run.ts --target maroo-testnet --action submit \
  --plan "$PLAN" \
  --bundle evidence/live-testnet/payroll-bundle.json \
  --env demo/.env

bun run demo/scripts/run.ts --target maroo-testnet --action submit \
  --plan "$PLAN" \
  --bundle evidence/live-testnet/payroll-bundle.json \
  --env demo/.env --broadcast \
  --out evidence/live-testnet/payroll-submit.json

bun run demo/scripts/run.ts --target maroo-testnet --action receipt \
  --plan "$PLAN" \
  --bundle evidence/live-testnet/payroll-bundle.json \
  --tx 0x<payroll-tx-hash> \
  --out evidence/live-testnet/payroll-receipt.json \
  --env demo/.env
```

`maroo-testnet` adapter의 `submit` action은 다음을 제출 전에 fail closed한다.

- `[Live Testnet]`과 `broadcastable=true`가 아님.
- chain/target/selector/plan digest가 다름.
- deposit value가 300e18이 아니거나 batch value가 0이 아님.
- EMP-A/B/C가 중복/누락되거나 `outputCount != 3`.
- expiry가 지났거나 60초 이하만 남음.

## 5. Receipt 수집

`maroo-testnet` adapter의 `receipt` action은 JSON-RPC에서 receipt와 transaction을 함께 읽는다.

- target과 exact calldata/value가 reviewed bundle과 같아야 한다.
- receipt status가 `0x1`이어야 한다.
- deposit은 `PrivacyDeposit` amount/commitment를 검사한다.
- batch는 `PrivacySingleProofBatchTransfer` root/inputCount/outputCount를 검사한다.

이 도구가 만든 receipt JSON은 원 RPC 전체가 아니라 워크숍 판정에 필요한 공개 필드만 담는다.

<a id="evidence"></a>

## 6. 증거 대사

scanner/auditor adapter가 [계약](adapter-contract.md#3-employee-scan-report)에 맞는 report를 만든 뒤 실행한다.

```bash
bun run demo/scripts/verify-evidence.ts \
  --plan "$PLAN" \
  --deposit-bundle evidence/live-testnet/deposit-bundle.json \
  --batch-bundle evidence/live-testnet/payroll-bundle.json \
  --deposit-receipt evidence/live-testnet/deposit-receipt.json \
  --batch-receipt evidence/live-testnet/payroll-receipt.json \
  --scans evidence/live-testnet/scan-emp-a.json,evidence/live-testnet/scan-emp-b.json,evidence/live-testnet/scan-emp-c.json \
  --audit evidence/live-testnet/audit-report.json \
  --live --out evidence/live-testnet/evidence-index.json
```

통과는 다음을 모두 뜻한다.

1. plan의 100/120/80 합이 deposit 300과 같다.
2. batch receipt가 세 output을 기록한다.
3. 각 employee report가 자기 index/commitment/amount를 복구한다.
4. audit report가 같은 tx/plan/총액/key epoch/digest를 검증한다.

validator는 scanner가 실제 decrypt를 수행했는지 독립 증명할 수 없다. adapter version과 scanner 구현 검토가 라이브 준비 게이트에 포함되는 이유다.

## 7. Clairveil 구현 참고 실습

```bash
mkdir -p evidence/local
bun run demo/scripts/run.ts --target clairveil-local --action payroll \
  --clairveil ../clairveil \
  --out evidence/local/payroll-summary.json
```

wrapper는 다음을 직접 검사한다.

- Clairveil commit이 지정 SHA와 일치.
- 정식 `clairveild`/`clairveil-setup` CLI를 소스에서 빌드.
- actual deposit tx 1개와 one-proof batch tx 1개가 모두 `code=0`.
- deposit 총액이 `300uclair`이고 EMP-A/B/C allocation이 `100/120/80uclair`.
- batch가 input 1개, output 3개, proof 1개, transaction envelope 1개.
- 생성된 proof artifact가 비어 있지 않고 공개 SHA-256 digest가 evidence에 있음.
- EMP-A/B/C의 shielded address digest가 모두 다름.
- 각 employee scan이 같은 batch tx의 `100/120/80uclair` note를 정확히 하나씩 복구.
- 공개 `batch_transfer` event가 input/output 수와 commitment/nullifier root를 노출하지만 직원 ID·평문 급여액을 노출하지 않음.
- `300uclair` treasury note로 `301uclair`를 준비하면 input selection에서 proof·broadcast 전에 거부되고 note state가 불변.
- EMP-B 대신 유효한 EMP-C shielded address로 보낸 별도 `120uclair`는 tx `code=0`, EMP-B 신규 note 0, EMP-C 신규 note 1로 판정.
- final payroll status가 `Confirmed`.

작업 디렉터리는 OS temporary directory에 만들고 성공 후 지운다. evidence에는 mnemonic/key file을 복사하지 않고 public summary만 쓴다.

중요한 경계: 이 경로는 75분 안에 참가자가 직접 실행하는 actual Clairveil `x/privacy` deposit/one-proof batch/distinct scan과 두 통제 사례다. overspend는 Privacy client/resource rejection이고, 유효 주소 오지급은 chain success/business-intent failure다. Clairveil에는 Maroo PCL이 없으며 `uclair`/Cosmos localnet이므로 Maroo OKRW/PCL/EVM calldata·VK·scanner 성공으로 표현하지 않는다.

Maroo에서는 활성 PCL 정책이 회사 signer의 denylist/EAS 등 표현된 규칙을 검사하고, Privacy가 proof·root·nullifier·가치 보존을 검사한다. 그러나 private transfer ABI에는 직원 EVM `recipient`가 없고 숨겨진 transfer 금액은 PCL operation에서 `value=0`으로 모델링된다. 승인된 EMP-B↔shielded-address 관계와 payroll plan/output 결속은 Path A prover adapter가 제출 전 fail closed하고, 성공 receipt 뒤 scanner 대사로 다시 확인해야 한다.

## 8. Offline rehearsal과 추가 negative controls

```bash
bun run demo/scripts/rehearse.ts --offline
```

기본값은 temporary directory에서 합성 deposit/batch/receipt/scan/audit JSON을 만들고 대사한 뒤 삭제한다. `--out-dir evidence/simulation/current-run`을 붙이면 참가자가 판정한 합성 JSON을 남긴다. 이어 `outputCount=2`, employee scan 누락과 EMP-B→EMP-C `profileRef` 오결속을 각각 주입해 반드시 거부되는지 확인한다. 마지막 사례는 `MAROO ADAPTER RECIPIENT CONTROL PASSED`를 출력하지만 `[Simulation]` metadata guard이며, 7절의 actual Clairveil overspend·오지급 control 또는 Maroo-compatible proof binding과 혼동하지 않는다.

## 9. 초기화·정리

```bash
# 먼저 이동 대상을 보여 주기만 한다.
bun run demo/scripts/reset-evidence.ts

# 확인 후 active evidence를 timestamp archive로 이동한다.
bun run demo/scripts/reset-evidence.ts --apply
```

이 명령은 `evidence/live-testnet`, `evidence/local`, `evidence/simulation`, `evidence/run`만 대상으로 하며 없는 디렉터리는 필요할 때 다시 만든다. 테스트넷/로컬 tx를 되돌리거나 `demo/.env`, 외부 wallet/profile을 지우지 않는다.

## 10. Validation

| 명령 | 직접 측정하는 것 | 성공 marker |
|---|---|---|
| `bun run demo/scripts/check-workshop-environment.ts` | 실제 워크숍용 Bun·Go·Git·Foundry 전체와 Clairveil SHA | `WORKSHOP ENVIRONMENT READY` |
| `bun run --cwd demo typecheck` | strict TypeScript와 no-emit 경계 | exit 0 |
| `bun run --cwd demo check` | 외부 Clairveil checkout 없이 가능한 package-root 독립 typecheck·테스트·doctor·rehearsal·정적 검증 | `DEMO PACKAGE VERIFIED` |
| `bun run demo/scripts/rehearse.ts --offline` | 전체 evidence 연결과 negative controls | `OFFLINE REHEARSAL PASSED` |
| `bun run demo/scripts/verify-workshop.ts content` | 필수 자료, 75분, O1~O6, 오류 수, fixture | `CONTENT VERIFIED` |
| `bun run demo/scripts/verify-workshop.ts links` | 로컬 링크/anchor, label, obsolete 문구, live 과장 주장 | `LINKS AND CLAIMS VERIFIED` |
| `bun run demo/scripts/verify-workshop.ts adapters` | 명시적 target과 자동 fallback 부재 | `ADAPTER ARCHITECTURE VERIFIED` |
| `bun run demo/scripts/verify-workshop.ts submission-kit` | Track B 공통 제출물, actual Path B evidence, 영상 run sheet | `SUBMISSION KIT VERIFIED` |
| `bun run demo/scripts/verify-workshop.ts typescript` | strict 설정과 이전 module 파일·참조 부재 | `TYPESCRIPT MIGRATION VERIFIED` |
| `bun run demo/scripts/verify-workshop.ts maroo-first-workshop` | Maroo 우선 75분 목표·readiness·단계별 criteria·토론·다음 단계 | `MAROO-FIRST WORKSHOP VERIFIED` |
| `bun run demo/scripts/verify-workshop.ts failure-controls` | Privacy rejection·PCL policy·business-intent failure의 코드/evidence/문서 일치 | `FAILURE CONTROLS VERIFIED` |
| `bun run demo/scripts/check-submission.ts --draft` | 문서 구조, actual live evidence, 현재 트리/git history secret scan | `DRAFT SUBMISSION CHECK PASSED` |
| `bun run demo/scripts/check-submission.ts --final` | README·SUBMISSION_NOTES·영상 5~8분·live evidence·비밀정보 최종 검사 | `FINAL SUBMISSION CHECK PASSED` |
| `bun run demo/scripts/run.ts --target clairveil-local --action payroll ...` | actual Clairveil 정상 payroll, 공개/직원 관찰, overspend 거부와 유효 주소 오지급 | `CLAIRVEIL LOCAL PAYROLL AND FAILURE CONTROLS VERIFIED` |

실행 결과와 환경은 [SUBMISSION_NOTES.md](../SUBMISSION_NOTES.md#2-validation)에 적고, 실제 tx/evidence가 없는 행은 비워 두지 말고 `미실행`으로 표시한다.
