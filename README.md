# Maroo Confidential Payroll Workshop

Maroo Developer Relations 과제의 **Primary Track B** 제출물이다. 한국 금융기관의 시니어 백엔드·블록체인 엔지니어 20명이 각자 독립 환경과 계정으로 실행한다. 75분 정본 경로는 **Maroo Testnet**이다. 참가자는 공통 개발 환경과 Maroo readiness를 먼저 확정하고, Clairveil Local에서 실제 `x/privacy` 정상 급여·공개/직원 관찰·overspend 거부·성공한 오지급을 구현 참고로 수행한 뒤, Maroo에서 회사 signer의 deposit→transfer를 실제 시도하고 성공 또는 거부를 판정한다.

핵심 원칙은 tx 성공과 지급 완료를 구분하는 것이다. `PrivacyDeposit` → `PrivacySingleProofBatchTransfer(outputCount=3)` → 직원별 scan 3건 → audit verify가 같은 plan digest로 이어져야 full live 성공이다.

| 항목 | 제출 값 |
|---|---|
| Public repository | <https://github.com/kooroot/Maroo-privacy-workshop> |
| 5~8분 walkthrough | [YouTube — maroo privacy workshop video](https://youtu.be/iTRQt5_Vc-Y) · `unlisted` |
| Live state-change evidence | [evidence/live-testnet/state-change-attempt.json](evidence/live-testnet/state-change-attempt.json) |
| Live tx / outcome | [deposit included-revert](https://explorer-testnet.maroo.io/tx/0xaa36463028962fccb246897d45bf13e43f6ef3da3cb6522fe4d3bdc82bd2c939)<br>[transfer included-revert](https://explorer-testnet.maroo.io/tx/0x3d3d6bbba494127e776a7014acbdc3e087b680a0190b642baf21bbdc87efb622) |

## 1. 5분 리뷰 경로

1. [커리큘럼](workshop/curriculum.md): 페르소나, 시나리오, O1~O6, 75분, 4~8주 PoC.
2. [Maroo 참가자 가이드](workshop/participant-guide.md): 하나의 Maroo 우선 75분 실행 순서와 실제 Clairveil `x/privacy` 구현 참고 실습.
3. [데모 runbook](demo/README.md): Clairveil local proof/scan, Maroo live submit/reconcile, evidence 검증.
4. [Evidence index](evidence/README.md): 실제 Path B와 Local 결과, 공개 tx, 완료하지 않은 범위를 한 번에 확인.
5. [진행자 가이드](workshop/facilitator-guide.md)와 [Troubleshooting](workshop/troubleshooting.md): 라이브 준비 게이트, Path 선택, 15개 오류 대응.
6. [Validation·DX 기록](SUBMISSION_NOTES.md#2-validation)과 [Walkthrough Video](video-link.md).

## 2. 과제 요구 매핑

### 2.1 공통 제출물

| 공통 제출물 | 위치 | 현재 상태 |
|---|---|---|
| 공개 소스 리포지토리 | 이 GitHub repository | 외부 코드 출처·license와 `.env.example` 포함; 실제 credential 제외 |
| `README.md` | 이 문서 | Primary Track, 대상, 리뷰 경로, 실행법, 영상·tx 링크, Clairveil SHA, 한계 명시 |
| `SUBMISSION_NOTES.md` | [SUBMISSION_NOTES.md](SUBMISSION_NOTES.md) | Assumptions/Discrepancies, Validation, AI Usage, DX Feedback, Known Limitations 포함 |
| Workshop slide deck | [Maroo_Privacy_Workshop_75min.pptx](deliverables/Maroo_Privacy_Workshop_75min.pptx) | Track B 참가자용 30장; 아키텍처·트랜잭션 흐름·신뢰 경계·실패 모드·프로덕션 판단 포함 |
| Video | [YouTube](https://youtu.be/iTRQt5_Vc-Y), [video-link.md](video-link.md) | 일부공개로 업로드 완료 |

### 2.2 Track B 필수 결과물

| Track B 필수 결과물 | 위치 | 현재 상태 |
|---|---|---|
| Runnable Demo | [demo](demo/README.md) | request/receipt/report validator와 submit/rehearsal/local 정상·실패 control 구현·검증 |
| Live Testnet Evidence | [Path B evidence](evidence/live-testnet/state-change-attempt.json) | 실제 `IPrivacy.deposit`·`transfer`가 각각 포함 후 revert; 유효 ZK proof 성공으로 주장하지 않음 |
| 60~75분 Workshop Package | [curriculum](workshop/curriculum.md), [participant](workshop/participant-guide.md), [facilitator](workshop/facilitator-guide.md), [exit ticket](workshop/exit-ticket.md) | Maroo 우선 75분; 공통 환경 setup·actual Clairveil 참고 실습·목표·구간별 criteria·토론·다음 단계 포함 |
| Workshop Slides | [30-slide PPTX](deliverables/Maroo_Privacy_Workshop_75min.pptx) | 참가자 발표용 16:9 덱; 모든 다이어그램과 표를 PowerPoint에서 편집 가능 |
| Troubleshooting Guide | [troubleshooting](workshop/troubleshooting.md) | 15개 오류 + Clairveil/Maroo/recorded 대체 진행 |
| Validation | [demo Validation](demo/README.md#10-validation), [SUBMISSION_NOTES](SUBMISSION_NOTES.md#2-validation), [Clairveil local evidence](evidence/local/payroll-summary.json) | actual Clairveil proof/scan·overspend·오지급 control + actual Maroo Path B receipt 검증 |
| Walkthrough Video | [YouTube](https://youtu.be/iTRQt5_Vc-Y), [video-link.md](video-link.md) | 일부공개로 업로드 완료 |


## 3. 대상과 시나리오

- 대상: 4~8주 안에 PoC 범위와 go/no-go 조건을 제안해야 하는 기관 엔지니어.
- 역할: 각 참가자가 회사 운영자로서 deposit과 batch를 모두 실행하고, 단계별 체크리스트로 자기 evidence를 검증한다.
- 자산: 합성 회사의 300 OKRW 상당.
- 배분: EMP-A 100, EMP-B 120, EMP-C 80.
- 상태 변경: `deposit` 한 건 + `singleProofBatchTransfer` 한 건.
- 완료: deposit receipt + batch receipt + 세 별도 employee scanner report + audit report.

아키텍처와 신뢰 경계는 [docs/architecture.md](docs/architecture.md), address/selector/event/reason code는 [docs/testnet-reference.md](docs/testnet-reference.md)가 정본이다.

## 4. Quick start

### 4.1 요구 환경

| 도구 | 지원/검증 기준 |
|---|---|
| OS | macOS 검증, WSL2 목표·미검증 |
| Bun | 1.4 이상; 이 작성 환경은 1.4.0 |
| TypeScript | strict/no-emit; `demo/package.json`에 고정된 버전 사용 |
| Foundry `anvil`·`cast`·`forge` | 전체 설치를 readiness에서 확인; 수업에서는 `cast`로 Maroo public state와 receipt를 교차 검증; 이 작성 환경은 1.7.1 |
| Git | 소스 checkout·버전 확인 |
| Go·Clairveil | 75분 actual `x/privacy` 구현 참고 실습에 필수; Go 1.25 계열과 지정 Clairveil commit |

### 4.2 설치와 검증

```bash
git clone https://github.com/kooroot/Maroo-privacy-workshop.git maroo-privacy-workshop
git clone https://github.com/DELIGHT-LABS/clairveil.git clairveil
git -C clairveil checkout ca85b02708fdd75259d4d2ee2d671c21198cec69
cd maroo-privacy-workshop
bun --version # 1.4.0 이상인지 확인
anvil --version
cast --version
forge --version
go version
git -C ../clairveil rev-parse HEAD
bun install --cwd demo --frozen-lockfile
bun run demo/scripts/check-workshop-environment.ts
bun run --cwd demo typecheck
bun run --cwd demo check
```

`demo/bun.lock`이 `@maroo-chain/viem`과 `viem` 버전을 고정한다.
`bun --version`이 1.4.0보다 낮으면 설치를 진행하지 말고 Bun을 갱신한다. 여러 Bun이 설치된 환경은 `type -a bun`으로 실제 선택된 바이너리를 확인한다.

`WORKSHOP ENVIRONMENT READY`는 Bun·Go·Git·Foundry 전체와 Clairveil 고정 SHA를 확인했다는 뜻이다. 이 과정은 secret을 읽거나 node·chain을 시작하지 않는다. Foundry 사용법이나 범용 Anvil chain은 학습 목표가 아니며, 75분 수업에서는 `cast`만 Maroo 관찰 도구로 직접 사용한다.

### 4.3 Live read-only preflight

```bash
test -f demo/.env || cp demo/.env.example demo/.env
# 테스트넷 전용 COMPANY_ACCOUNT, COMPANY_PRIVATE_KEY, EMPLOYEE_ACCOUNT를 채운다.
bun run demo/scripts/run.ts --target maroo-testnet --action preflight \
  --env demo/.env \
  --plan demo/fixtures/payroll-plan.json \
  --out evidence/live-testnet/preflight.json
```

상태 변경과 proof/scan 명령은 [참가자 가이드](workshop/participant-guide.md#3-구간별-실습)를 따른다. `--broadcast`를 명시하지 않은 submit은 estimate만 한다.

이번 제출은 Maroo 테스트넷의 Privacy bundle을 확보하지 못해 Path B를 실행했다. 회사 signer가 ABI-valid하지만 ZK 입력이 의도적으로 무효인 `IPrivacy.deposit`과 `IPrivacy.transfer`를 실제 전송했고, 두 transaction 모두 테스트넷에 포함된 뒤 revert됐다. 실행 명령과 receipt는 [Path B evidence](evidence/live-testnet/state-change-attempt.json)에 있으며, 재실행 방법은 [demo runbook](demo/README.md)에서 확인한다. 이 probe는 유효 proof 생성, private deposit 성공 또는 직원 지급 증거가 아니다.

### 4.4 Clairveil 구현 참고 실습

```bash
bun run demo/scripts/run.ts --target clairveil-local --action payroll \
  --clairveil ../clairveil \
  --out evidence/local/payroll-summary.json
```

이 명령은 75분 워크숍 안에서 참가자가 직접 실행한다. Clairveil local chain에서 실제 `300uclair` deposit, EMP-A/B/C `100/120/80uclair` one-proof payroll과 profile별 scan을 수행한다. 같은 세션에서 public event와 employee scan을 비교하고, `300→301` proof 전 거부와 EMP-B 대신 EMP-C로 보낸 `120`의 chain 성공/business failure도 검증한다. Maroo 급여표와 명목 배분을 맞췄지만 자산·runtime이 다르므로 Maroo OKRW/PCL/EVM ABI·VK 성공으로 합쳐 말하지 않는다.

## 5. Proof·scanner provider가 필요한 이유

Maroo Docs는 calldata/ABI를 제공하지만 이 저장소에는 테스트넷 VK와 호환됨이 입증된 prover·wallet scanner가 포함돼 있지 않다. 임의 bytes를 proof로 넣어 “실습 완료”라고 하지 않는다.

[adapter contract](demo/adapter-contract.md)는 외부 adapter의 최소 출력을 고정한다.

- deposit/batch exact ABI calldata와 공개 digest.
- chain/target/value/expiry, employee-output binding.
- EMP-A/B/C 별도 scan report.
- audit key epoch와 disclosure digest report.

`maroo-testnet` adapter는 `[Live Testnet]`, `broadcastable=true`, 정확한 selector/value/3-output/expiry를 확인한 bundle만 estimate/broadcast한다. 실제 proof·scanner 호환성은 진행자의 [Maroo live 준비 게이트](workshop/facilitator-guide.md#23-maroo-live-준비-게이트)로 입증한다.

## 6. 실행 라벨

| 라벨 | 뜻 |
|---|---|
| `[Live Testnet]` | Maroo testnet RPC를 실제 사용한 결과. read/estimate/broadcast 여부는 별도 표기 |
| `[Local]` | 구현 참고용 Clairveil local chain에서 실제 tx/proof/scan을 수행한 결과 |
| `[Simulation]` | chain/proof/decrypt 없이 결정적 fixture로 대사 규칙을 재현한 결과 |
| `[Docs Only]` | Docs, ABI, source에서만 확인한 내용 |

한 파일에서 다른 성격의 증거를 합쳐 더 높은 수준의 완료로 표현하지 않는다.

## 7. Testnet transaction/evidence

### 7.1 이번 제출에서 직접 실행한 Path B

| 호출 | 결과 | 공개 tx | 확인 |
|---|---|---|---|
| `IPrivacy.deposit` invalid-proof probe | `included-revert` | [0xaa3646…2c939](https://explorer-testnet.maroo.io/tx/0xaa36463028962fccb246897d45bf13e43f6ef3da3cb6522fe4d3bdc82bd2c939) | block `17243931`, target `0x100…000b`, selector `0xe6eb7771`, value `1 wei`, receipt `status=0`; revert reason은 non-zero commitment 요구 |
| `IPrivacy.transfer` invalid-proof probe | `included-revert` | [0x3d3d6b…fb622](https://explorer-testnet.maroo.io/tx/0x3d3d6bbba494127e776a7014acbdc3e087b680a0190b642baf21bbdc87efb622) | block `17243934`, target `0x100…000b`, selector `0x43fd6967`, value `0`, receipt `status=0`; gas `1,000,000/1,000,000`, decoded reason 없음 |

두 거래의 signer, chain, calldata 경계, UTC와 재현 명령은 [state-change-attempt.json](evidence/live-testnet/state-change-attempt.json)에 있다. 공개 RPC로 receipt의 `status=0`, block, sender와 Privacy precompile target을 다시 대조했다.

### 7.2 아직 완료하지 않은 full happy path

| 항목 | 상태 | 완료로 인정할 조건 |
|---|---|---|
| 300 OKRW 상당의 유효 Privacy deposit | 미완료 | 호환 proof, `status=1`, `PrivacyDeposit` event, treasury note scan |
| 3-output Maroo payroll batch | 미완료 | 호환 batch proof, `status=1`, `outputCount=3` |
| EMP-A/B/C scan | 미완료 | 서로 다른 직원 scanner report 3개 |
| audit verify | 미완료 | disclosure digest/total/key epoch 검증 |

## 8. Source provenance와 license

| 구성 | 버전/commit | 원본 소스 | license | 이 저장소의 사용 범위 |
|---|---|---|---|---|
| 이 workshop의 신규 문서·wrapper·validator | 현재 repository commit | 이 repository | [MIT](LICENSE) | 전체 제출 패키지 |
| Clairveil | `ca85b02708fdd75259d4d2ee2d671c21198cec69` (`v0.4.0`) | <https://github.com/DELIGHT-LABS/clairveil> | Apache-2.0 | 소스 복사·핵심 변경 없이 checkout의 `clairveild`/`clairveil-setup` CLI 빌드·호출 |
| `@maroo-chain/viem` | `0.3.0` | <https://github.com/Hashed-Open-Finance/maroo-typescript-sdk> | Apache-2.0 | chain/주소/typed OKRW·PCL read actions |
| `@maroo-chain/contracts` | `0.0.8` (transitive) | <https://github.com/Hashed-Open-Finance/maroo> | MIT | package가 노출하는 Privacy ABI·event 확인 |
| `viem` | `2.56.3` | <https://github.com/wevm/viem> | MIT | JSON-RPC client, signer, receipt/event decode |

### Clairveil provenance

- Source: <https://github.com/DELIGHT-LABS/clairveil.git>
- Commit: `ca85b02708fdd75259d4d2ee2d671c21198cec69`
- Tag at inspection: `v0.4.0`
- License: Apache-2.0
- 사용 방식: 코드를 복사하지 않고 checkout의 `clairveild`와 `clairveil-setup`을 빌드한 뒤 정식 `deposit`, `transfer-batch-16x32`, `list-notes` CLI를 Bun adapter가 조합한다.
- 역할: 75분 워크숍의 actual local proof/scan 구현 참고 실습. Maroo 외부 ABI와 테스트넷 판정의 기준은 Maroo Docs·Testnet이다.
- 본인이 변경한 범위: 이 repository의 Bun adapter, evidence contract/validator, 워크숍 문서만 작성했다. 지정 Clairveil core commit은 변경하지 않는다.

## 9. Known limitations

- Maroo 상태 변경 Path B evidence는 확보했지만, 호환 prover/VK/scanner/auditor를 사용한 deposit→batch→직원 scan→audit happy path는 완료하지 못했다.
- WSL2 전체 리허설을 직접 검증하지 않았다.
- Clairveil 구현 참고 실습은 one-proof·세 distinct employee profile·overspend·오지급 control까지 실제 실행하지만 `uclair`/Cosmos localnet이므로 Maroo ABI·OKRW·PCL·VK 호환 증거는 아니다.
- 정책상 허용된 잘못된 shielded recipient는 PCL 통과 후에도 업무 오류일 수 있다. Maroo Path A에는 승인된 employee-address registry, plan/output binding과 scanner 대사가 추가로 필요하다.
- `verify-evidence.ts`는 report 간 일관성을 검증하지만 adapter가 실제 decrypt를 했다는 암호학적 증명은 아니다.
- production custody, HSM/KMS, 실제 KYC, 법률 적합성, 대규모 성능은 범위 밖이다.

상세 assumptions, discrepancies, validation, AI usage, DX feedback은 [SUBMISSION_NOTES.md](SUBMISSION_NOTES.md)에 있다.

## 10. Repository tree

```text
.
├── README.md
├── LICENSE
├── SUBMISSION_NOTES.md
├── video-link.md
├── deliverables/
│   └── Maroo_Privacy_Workshop_75min.pptx
├── demo/
│   ├── adapter-contract.md
│   ├── fixtures/payroll-plan.json
│   ├── shared/
│   ├── adapters/
│   ├── scripts/
│   └── test/
├── docs/
│   ├── architecture.md
│   └── testnet-reference.md
├── workshop/
│   ├── curriculum.md
│   ├── participant-guide.md
│   ├── facilitator-guide.md
│   ├── troubleshooting.md
│   └── exit-ticket.md
└── evidence/
    ├── README.md
    ├── live-testnet/
    ├── local/
    ├── simulation/
    └── run/
```
