# Troubleshooting — 원인·증상·확인·해결

원칙은 “첫 실패 계층”을 찾는 것이다. local validator → RPC transport → PCL policy → Privacy input/proof/state → scanner/auditor → business reconciliation 순서로 본다. 모든 revert를 PCL 거부라고 부르지 않고, receipt 성공 뒤 의도 불일치는 business-intent failure로 분류한다.

오류 evidence에는 label, UTC, 실행 환경, 원명령, 종료 코드, stdout/stderr 또는 JSON-RPC `error.code/message/data`, 사용한 adapter version을 남긴다. private key, mnemonic, witness, plaintext note는 남기지 않는다.

## 빠른 분류

| 실패 위치 | 대표 단서 | 분류 |
|---|---|---|
| bundle validator | selector/plan/output/expiry 오류 | client preparation |
| HTTP/JSON-RPC | timeout, non-2xx, method error | infrastructure |
| revert data custom selector | PCL reason table과 일치 | policy |
| `0x08c379a0` 또는 문자열 | proof/root/nullifier/value 등 | Privacy execution |
| receipt `0x1`, scan 실패 | tx 성공 후 delivery evidence 문제 | scanner/key/cursor |
| scan 성공, audit 실패 | key epoch/digest/decrypt 문제 | audit delivery |

## 오류별 대응

### T1. ABI selector 또는 target 불일치

**증상:** `validate-request.ts`가 selector/target/calldata 오류로 종료하거나 `eth_estimateGas`가 즉시 “function not found” 계열로 실패한다.

**원인:** Clairveil 예제의 Cosmos/옛 EVM 형태를 Maroo ABI로 사용했거나, `deposit`과 `singleProofBatchTransfer` bundle을 뒤바꿨다. target이 `0x100…000b`가 아니다.

**확인:**

```bash
cast sig 'deposit((bytes,bytes,bytes))' # 0xe6eb7771
cast sig 'singleProofBatchTransfer((bytes,bytes,bytes[],(bytes,bytes,bytes,uint32,uint8,bytes,bytes,bytes,bytes,bytes,bytes)[],string,uint64,bytes,uint64))' # 0x3bbb329b
bun run demo/scripts/validate-request.ts --plan demo/fixtures/payroll-plan.json --bundle <bundle> --live
```

JSON 파일의 문자열 앞 10자를 보는 대신 실제 `calldata` 필드 앞 10자를 확인한다. `jq -r .calldata <bundle> | cut -c1-10`을 쓸 수 있다.

**해결:** adapter를 `@maroo-chain/contracts@0.0.8`의 `IPrivacy.sol` ABI로 다시 빌드한다. target/selector를 강제로 바꿔 validator만 통과시키지 말고 proof와 encoded request를 함께 다시 생성한다.

<a id="t2-estimate-revert"></a>

### T2. `eth_estimateGas` reverted — PCL인지 Privacy인지 모름

**증상:** `maroo-testnet` adapter의 `submit` action이 `execution reverted`로 끝난다.

**원인:** local contract는 통과했지만 sender policy, proof, root, nullifier, value 등 체인 상태 검사가 실패했다.

**확인:** raw JSON-RPC의 `error.data`를 보존한다.

```bash
cast estimate --rpc-url "$MAROO_RPC_URL" --from "$COMPANY_ACCOUNT" \
  --value <deposit-value-if-any> "$MAROO_PRIVACY_PRECOMPILE" --data <calldata>
```

- `0x08c379a0`: Solidity `Error(string)` 계열. Privacy 입력/상태 오류일 가능성이 높다.
- `0x1a152487`: `EasAttestationRequired(address)`.
- `0xbca5593e`: `EasNoAttestationReceived(address)`.
- `0x30d7cfd1`: `AnyOfRejected(bytes[])`.
- `0x0201b218`: `InDenylist(address)`.

selector가 표에 없으면 추측하지 말고 raw data를 남긴다.

**해결:** PCL selector면 attestation/policy principal을 고친다. 문자열이면 decode한 입력 계층을 고친다. dummy proof로 PCL이 반드시 실행된다고 가정하지 않는다. Privacy prepare가 먼저 실패할 수 있다.

<a id="t3-spent-nullifier"></a>

### T3. spent nullifier / replay 거부

**증상:** 처음 batch는 성공했지만 같은 bundle의 estimate나 재전송이 nullifier/spent 계열로 실패한다.

**원인:** 입력 note는 이미 소비됐다. 성공 응답을 놓쳤다고 새 envelope로 다시 서명한 경우도 같다.

**확인:** 먼저 기존 tx hash의 receipt를 조회하고, bundle의 nullifier digest와 scanner/indexer 상태를 비교한다. replay는 broadcast하지 않고 estimate만 한다.

```bash
cast receipt --rpc-url "$MAROO_RPC_URL" <known-tx-hash>
bun run demo/scripts/run.ts --target maroo-testnet --action submit --plan demo/fixtures/payroll-plan.json \
  --bundle evidence/live-testnet/payroll-bundle.json --env demo/.env
```

**해결:** 이미 성공한 tx면 delivery scan만 재시도한다. 실제 미포함이고 input이 unspent일 때만 저장된 동일 signed bytes 재전송 정책을 검토한다. 새 root/proof로 작업을 재작성할 때는 새 operation ID와 승인 절차를 사용한다.

### T4. stale root / unknown root

**증상:** proof는 생성됐지만 estimate가 root를 찾지 못하거나 오래됐다고 거부한다.

**원인:** scan 후 proof 제출까지 지연됐거나, adapter가 다른 네트워크/height의 Merkle root를 사용했다.

**확인:** bundle `chainId`, root, proof 생성 시각, 현재 chain height, adapter가 scan한 마지막 height를 함께 기록한다. root만 최신 값으로 문자열 교체해서는 안 된다.

**해결:** 동일 chain에서 note를 다시 scan하고 최신 root에 맞춰 witness와 proof 전체를 재생성한다. 기존 bundle은 실패 evidence로 보존하고 broadcastable을 false로 내린다.

### T5. receipt 성공 후 employee output scan 실패

**증상:** batch receipt와 `outputCount=3`은 성공했지만 EMP-A/B/C 중 하나가 `owned` report를 만들지 못한다.

**원인:** 잘못된 profile/view key, cursor가 tx 이전 height에 멈춤, view tag false-negative 처리, ciphertext/commitment 바인딩 오류가 가능하다.

**확인:** 실패 직원의 profile ref(비밀키 아님), start/end cursor, tx hash, expected output index/commitment, decrypt/commitment-recompute 결과를 확인한다. 다른 직원의 report를 복사해 채우지 않는다.

**해결:** safe rescan으로 cursor를 tx 이전부터 되돌리고, decrypt한 NoteV1 commitment를 재계산한다. 그래도 실패하면 chain tx를 다시 보내지 말고 `DeliveryPending` 또는 adapter 고유 실패 상태로 운영 이슈를 연다.

### T6. expired payload 또는 60초 미만 여유

**증상:** `validate-request.ts`가 expiry로 거부하거나 chain이 만료 오류를 반환한다.

**원인:** proof queue, 개인 검토, RPC 지연 사이에 `expiresAtUnix`가 지났다.

**확인:** 현재 UTC epoch와 bundle expiry, proof 생성 시간을 비교한다.

```bash
date -u +%s
```

**해결:** expiry 숫자만 바꾸지 말고 새 owner-intent에 맞춰 request/proof/calldata를 다시 만든다. workshop에서는 최소 60초보다 넉넉한 TTL을 사전 측정값으로 정한다.

### T7. audit decrypt 또는 digest 검증 실패

**증상:** 직원 scan은 성공하지만 audit report가 `verified`가 아니거나 key/digest mismatch다.

**원인:** 잘못된 audit key ID/epoch, 회전 전후 키 혼용, disclosure ciphertext 손상, plaintext digest 계산 규칙 불일치다.

**확인:** bundle과 report의 `auditKeyId`, `auditKeyEpoch`, `auditPayloadDigest`, tx hash, plan digest를 비교한다. private audit key를 evidence에 복사하지 않는다.

**해결:** tx가 참조한 epoch의 키로 다시 검증하고 plaintext에서 digest와 총액을 재계산한다. decrypt 실패를 chain failure로 바꾸지 말고 `AuditDeliveryFailed`/manual review로 분리한다.

### T8. PCL/EAS sender 조건 미충족

**증상:** estimate 또는 tx가 EAS/PCL custom reason으로 거부된다.

**원인:** company sender가 필요한 schema attestation을 받지 않았거나 revoked/expired 되었고, 다른 주소가 서명했을 수 있다.

**확인:** 실행 직전 `contractPolicies(IPrivacy)`, global policies, `COMPANY_ACCOUNT`, attestation UID/status를 확인한다. PCL이 실제 보는 principal과 wallet 화면 주소가 같은지 대조한다.

**해결:** 테스트넷 KYC/attestation 절차를 다시 수행하거나 해당 참가자에게 진행자가 사전 검증한 회사 계정을 다시 배정한다. policy admin을 흉내 내거나 정책을 우회하지 않는다.

### T9. faucet·잔액·gas 부족

**증상:** balance 0, insufficient funds, intrinsic gas/base fee 오류, deposit 300 + gas를 감당하지 못한다.

**원인:** faucet 한도/주기, 잘못된 account, gas price 변화, 금액 단위 혼동이다.

**확인:**

```bash
cast balance --rpc-url "$MAROO_RPC_URL" "$COMPANY_ACCOUNT"
cast base-fee --rpc-url "$MAROO_RPC_URL"
cast gas-price --rpc-url "$MAROO_RPC_URL"
```

**해결:** 전날 잔액을 준비하고 estimate × gas price + 300e18보다 여유 있게 확보한다. faucet 정책 안에서 재요청하거나 참가자별 사전 검증 계정으로 교체한다. 금액을 즉석 축소하면 plan/bundle/proof를 모두 다시 만들어야 한다.

### T10. RPC·explorer·indexer 지연

**증상:** timeout/non-2xx, receipt `null`, explorer 404, scanner cursor 정체가 난다.

**원인:** RPC 장애/rate limit, tx 미포함, explorer indexing 지연은 서로 다른 문제다.

**확인:**

```bash
curl -sS -m 10 -X POST "$MAROO_RPC_URL" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
cast receipt --rpc-url "$MAROO_RPC_URL" <tx-hash>
curl -sS -m 10 "$MAROO_INDEXER_URL/stats"
```

**해결:** RPC receipt가 있으면 explorer 지연만으로 tx를 재전송하지 않는다. RPC가 1분 간격 3회 실패하면 [대체 진행](#fallback)을 판정한다. rate limit이면 참가자 20명의 요청을 stagger한다.

### T11. Clairveil `x/privacy` 로컬 실습 실패

**증상:** Go build, ZK artifact 생성, local node 시작, deposit, batch proof, EMP-A/B/C scan 또는 control 단계에서 종료되고 `CLAIRVEIL LOCAL PAYROLL AND FAILURE CONTROLS VERIFIED`가 출력되지 않는다.

**원인:** Clairveil commit 불일치, Go module/cache 문제, 임시 port 충돌, ZK artifact checksum 실패, 메모리·디스크 부족, local node 준비 지연 또는 scan 결과 불일치다.

**확인:**

```bash
go version
git -C ../clairveil rev-parse HEAD
bun run demo/scripts/run.ts --target clairveil-local --action ready \
  --clairveil ../clairveil
bun run demo/scripts/run.ts --target clairveil-local --action payroll \
  --clairveil ../clairveil \
  --keep-on-failure --out evidence/local/payroll-summary.json
```

**해결:** 지정 commit으로 맞추고 `go mod download`와 두 command build를 전날 예열한다. `--keep-on-failure`가 출력한 임시 경로의 `clairveild.log`를 검사한 뒤 새 임시 run을 시작한다. 복구가 41분을 넘기면 진행자의 검증된 `[Local]` evidence로 proof·scan 판정을 계속하되 본인 local 실행 미완료를 기록한다. 보존된 임시 키 디렉터리는 공유하지 않는다.

### T12. live attempt evidence가 생성되지 않음

**증상:** `attempt` action이 종료됐는데 `state-change-attempt.json`이 없거나 `stateChangingTransactionAttempted=false`다.

**원인:** 승인 문자열·회사 테스트넷 키·account가 잘못됐거나, Privacy bundle이 로컬 검증/estimate에서 거부됐거나, rejection probe가 transaction 준비 단계에서 실패해 RPC broadcast까지 도달하지 못했다.

**확인:** stderr와 recorder의 `stage`를 본다. `prepared`, `bundle-validation`, `rpc-estimate`, `transaction-preparation`은 실제 전송 시도가 아니다. 로컬 서명을 끝내고 `eth_sendRawTransaction`을 호출한 `rpc-broadcast` 이후의 `rejected`만 RPC submission을 호출한 증거다. private key를 명령행이나 오류 파일에 복사하지 않는다.

```bash
bun run demo/scripts/run.ts --target maroo-testnet --action attempt \
  --kind privacy-deposit-transfer-probes --env demo/.env \
  --broadcast --ack-state-change MAROO_TESTNET_ONLY \
  --out evidence/live-testnet/state-change-attempt.json
```

**해결:** 회사 계정/잔액/RPC를 고친 뒤 다시 실행한다. 호환 Privacy bundle이 없을 때는 두 IPrivacy rejection probe를 실제 제출하고 `probes.deposit`과 `probes.transfer`를 각각 판정한다. 무효 ZK 입력의 거부는 유효 Privacy deposit이나 private payroll 성공이 아니다.

### T13. 공통 환경 readiness 실패

**증상:** `anvil`, `cast`, `forge`, `go`, `git` 중 하나를 찾지 못하거나 `check-workshop-environment.ts`가 Bun 버전·Clairveil SHA 오류로 종료한다.

**원인:** Foundry 일부만 PATH에 있거나, 여러 Bun 설치 중 1.4 미만이 선택됐거나, sibling Clairveil checkout이 없거나 지정 commit과 다르다. 이는 privacy transaction 실패가 아니라 실행 전 workstation 문제다.

**확인:** repository root에서 다음을 실행하고 첫 실패 명령을 찾는다.

```bash
type -a bun anvil cast forge go git
bun --version
anvil --version
cast --version
forge --version
go version
git -C ../clairveil rev-parse HEAD
bun run demo/scripts/check-workshop-environment.ts
```

**해결:** 누락된 도구를 공식 배포 방식으로 설치하고 shell PATH를 다시 불러온다. Bun은 1.4 이상, Clairveil은 `ca85b02708fdd75259d4d2ee2d671c21198cec69`로 맞춘 뒤 checker를 다시 실행한다. 14분까지 해결되지 않으면 제공 evidence를 읽는 observer 경로로 전환하고 “본인 환경·실행 미완료”를 exit ticket에 기록한다. 범용 Anvil chain을 띄워 Maroo 또는 Clairveil 실행을 대신하지 않는다.

### T14. `300→301` overspend가 proof 전에 거부됨

**증상:** Clairveil control의 `prepare-batch-transfer`가 `selected inputs do not fund batch payment total 301uclair`로 종료하고 tx hash가 없다.

**원인:** 사용 가능한 treasury note는 `300uclair`인데 payment 합계가 `301uclair`다. wallet input selection이 가치 보존 불가능을 proof·broadcast 전에 발견한 정상 거부다. Clairveil Local에는 Maroo PCL이 없으며, 이를 PCL 한도 거부라고 부르면 안 된다.

**확인:** `failureControls.overspend`의 `rejectedAt="wallet-input-selection-before-proof"`, `broadcastAttempted=false`, before/after treasury note count와 `treasuryStateUnchanged=true`를 함께 확인한다. 에러 문자열 하나만으로 상태 불변을 추정하지 않는다.

**해결:** 실제 운영에서는 prover를 호출하기 전에 spendable note 합계와 payroll plan 합계를 대사하고 부족하면 deposit·note confirmation 뒤 새 root로 다시 준비한다. 위조된 overspend proof가 제출되면 Privacy 검증이 거부해야 한다. Maroo private transfer의 숨겨진 금액은 PCL operation에서 `value=0`이므로 일반 PCL volume policy가 이 사례를 자동 판별한다고 주장하지 않는다.

### T15. 잘못된 직원 주소인데 transaction이 성공함

**증상:** wrong-recipient control의 transfer가 `code=0`인데 EMP-B의 신규 note는 0이고 EMP-C가 해당 tx의 `120uclair` note를 1개 찾는다.

**원인:** EMP-C shielded address는 형식과 암호학적 조건이 모두 유효하다. Privacy는 proof와 가치 보존을 검증했지만 “이 120은 EMP-B 급여”라는 인사 원장 의도는 알지 못한다. 정책상 허용된 EMP-C라면 PCL 통과도 이 업무 오류를 증명하지 않는다.

**확인:** `failureControls.wrongRecipient`의 `chainOutcome="success"`, `payrollOutcome="failed"`, intended/actual employee ID와 두 scan delta를 같은 tx hash 기준으로 대조한다. PCL 거부라면 receipt 성공이 아니라 IPcl ABI로 디코드되는 typed reason이 있어야 한다.

**해결:** Maroo Path A adapter에서 승인된 employee↔shielded-address registry, payroll plan digest와 prover output binding을 서명 전에 비교해 하나라도 다르면 broadcast하지 않는다. 활성 PCL/EAS 정책은 회사 signer와 정책에 표현된 자격을 별도로 검사한다. 성공 receipt 뒤에도 직원 scanner 대사를 수행하고, 불일치는 자동 완료 처리하지 말고 incident·correction 절차로 넘긴다.

## 실행 장애 시 대체 진행

<a id="fallback"></a>

### 전환 조건

- Maroo RPC가 1분 간격 3회 연속 실패.
- 공통 환경 checker가 14분까지 통과하지 않음.
- Clairveil actual local flow가 41분까지 완료되지 않음.
- prover/VK 호환을 49분까지 확인하지 못함.
- 직원/감사 adapter가 68분까지 필수 report를 만들지 못함.

### Clairveil recorded evidence

`evidence/local/payroll-summary.json`은 실제 Clairveil deposit, one-proof `BatchJoinSplit16x32`, EMP-A/B/C scan, 공개/직원 관찰 비교, overspend 거부와 오지급 성공의 판정 연습에 사용한다. 참가자 실행이 실패했다면 진행자 evidence를 본인 실행으로 표시하지 않는다. 이것은 Maroo 장애의 자동 fallback이나 Maroo success evidence도 아니다.

```bash
bun run demo/scripts/run.ts --target clairveil-local --action payroll \
  --clairveil ../clairveil \
  --out evidence/local/payroll-summary.json
```

### Emergency recorded mode

```bash
bun run demo/scripts/rehearse.ts --offline --out-dir evidence/simulation/current-run
```

JSON 계약과 대사 실패 제어만 보여 준다. proof/chain/decrypt를 실행하지 않으므로 `[Simulation]`이다.

진행자는 마지막에 각 참가자가 달성하지 못한 O2~O5를 명시하고 테스트넷 복구 후 실행할 명령과 owner를 exit ticket에 남긴다.

### 진행자 대체 진행 방식

라이브 서비스가 중단되면 진행자는 실패 화면에서 UTC·환경·재현 명령을 먼저 캡처한다. 이후 Clairveil local proof·scan 판정과 recorded mode로 남은 학습을 진행하되 Maroo 구간을 미완료로 닫는다. Clairveil local evidence는 실제 `[Local]` 결과이지만 당일 `[Live Testnet]` evidence로 제출하지 않는다.
