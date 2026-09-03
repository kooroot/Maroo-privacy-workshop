# demo/ — Runnable Demo + Validation

> 증거 라벨은 네 가지만 쓴다: `[Live Testnet]` `[Local]` `[Simulation]` `[Docs Only]` (과제 L158).
> 출처 표기: (과제 L###) = `Maroo_developer_relations.md` · (가이드 §…) = `maroo-exploration-guide.md` · (검토 §…) = `review-skeleton-and-track2.md` · (실측 2026-09-02) = 이 문서를 쓰면서 실행한 **읽기 전용** 호출(`eth_call`/`eth_estimateGas`/`eth_getCode`/`eth_getTransactionReceipt`/Blockscout GET, `cast <sub> --help`) · (Clairveil `path:line`) = `clairveil@ca85b02708fdd75259d4d2ee2d671c21198cec69`.
> 값의 출처가 없으면 `TODO(실측: …)` 로 남겼다. 잘린 해시를 기억으로 늘려 쓰지 않았다.

## 0. 역할

이 디렉터리는 Track B 결과물 **#1 Runnable Demo**(과제 L356-361)와 **#5 Validation**(과제 L380-383)의 집이다. 데모는 "OKRW 네이티브 전송 → PCL 정책 읽기·거부 재현 → Privacy `deposit`" 하나의 end-to-end 흐름(과제 L339-340, L359)에 집중하며, 각 단계에서 성공 또는 거부를 참가자가 스스로 판정할 수 있어야 한다(과제 L340, L394). 실행 정본은 **Maroo 테스트넷**(EVM JSON-RPC, chainId 450815 = `0x6e0ff`, RPC `https://rpc-testnet.maroo.io`, explorer `https://explorer-testnet.maroo.io`; 가이드 §2.1-1, 실측 2026-09-02 `eth_chainId` → `0x6e0ff`)이다. Clairveil 로컬넷(`clairveild`, `uclair`, EVM·OKRW·PCL 없음; 검토 §2.1 (1))은 기반 프라이버시 모듈의 **구현 참고 자료**이자 Step 4 의 `[Local]`/`[Simulation]` 대체 경로일 뿐이다.

**데모 코드(`demo/src` bun TS 실행기 + `demo/script` forge script)는 아직 없다.** 따라서 이 문서의 「계획 명령」열(`bun run step:N`)은 전부 `TODO(구현)` 이고, 같은 행의 「오늘 실행 가능한 동등 명령」열이 지금 당장 돌릴 수 있는 정본이다. 동등 명령은 `cast 1.7.1`(foundry) 과 `curl` JSON-RPC 로만 썼고, cast 하위 명령·플래그는 전부 `cast <sub> --help` 로 존재를 확인했다(실측 2026-09-02: `call`, `estimate`, `send`, `receipt`, `code`, `chain-id`, `balance`, `rpc`, `sig`, `calldata`, `decode-error`, `wallet address`, `tx`, `to-ascii`).

계획 레이아웃(전부 `TODO(구현)`; 도구는 Foundry(cast/forge 1.7.1) + bun 1.4.0, 체인 SDK 의존성 없음):

```
demo/
  .env.example         # 14개 키 (§0.1)
  foundry.toml         # [profile.default] libs = ["node_modules"]; [rpc_endpoints] maroo_testnet = "${MAROO_RPC_URL}"
  remappings.txt       # @maroo-chain/contracts/=node_modules/@maroo-chain/contracts/
  package.json         # bun 전용: scripts doctor, step:0 … step:4, smoke, reset ; dependencies @maroo-chain/contracts 0.0.8
  bun.lock             # 커밋
  src/                 # step-N.ts — Bun.$ 로 cast/forge 를 호출하고 결과를 evidence/live-testnet/ 에 JSON 으로 저장
  script/              # Step3Deposit.s.sol — IPrivacy(PRIV).deposit{value: 1 ether}(commitment, encryptedNote, proof)
  out/ cache/          # forge 산출물 (.gitignore)
  broadcast/           # forge script --broadcast 의 tx 기록 → 커밋, evidence 로 링크
```

### 0.1 공통 준비 (모든 명령의 전제)

`demo/.env.example` 의 키는 14개(`MAROO_*` 12개 + 비밀 2개)다: `MAROO_RPC_URL` `MAROO_WS_URL` `MAROO_CHAIN_ID` `MAROO_NETWORK` `MAROO_EXPLORER_URL` `MAROO_FAUCET_URL` `MAROO_INDEXER_URL` `MAROO_KYC_URL` `MAROO_OKRW_PRECOMPILE` `MAROO_PCL_PRECOMPILE` `MAROO_EAS_PRECOMPILE` `MAROO_PRIVACY_PRECOMPILE` + `PRIVATE_KEY` `PROVER_BEARER_TOKEN`. `PRIVATE_KEY` 는 테스트넷 전용 계정만(과제 L170), 문서·로그·영상 어디에도 값을 적지 않는다(과제 L169).

```bash
cd demo
cp .env.example .env           # PRIVATE_KEY 만 테스트넷 전용 새 키로 채운다. 값을 echo/커밋하지 않는다
set -a; source .env; set +a
export RPC="$MAROO_RPC_URL"                    # https://rpc-testnet.maroo.io
export EXPL="$MAROO_INDEXER_URL"               # https://explorer-testnet.maroo.io/blockscout/api/v2 (/api/v2 는 404)
export OKRW="$MAROO_OKRW_PRECOMPILE"           # 0x1000000000000000000000000000000000000001
export PCL="$MAROO_PCL_PRECOMPILE"             # 0x1000000000000000000000000000000000000005
export EAS="$MAROO_EAS_PRECOMPILE"             # 0x1000000000000000000000000000000000000009
export PRIV="$MAROO_PRIVACY_PRECOMPILE"        # 0x100000000000000000000000000000000000000b
export ME="$(cast wallet address --private-key "$PRIVATE_KEY")"
```

`.env` 는 `.gitignore` 대상이다. `cast send` 는 항상 `--chain "$MAROO_CHAIN_ID"`(= 450815)로 서명한다. 아래 명령은 `$RPC $EXPL $OKRW $PCL $EAS $PRIV $ME` 를 쓰며, 주소를 그대로 적은 곳은 위 값과 같다.

파우셋(tOKRW)은 이미 받았다는 전제(가이드 §0). 한도는 요청당 5,000 tOKRW · 10분당 5회 · 잔액 10,000 이상이면 거부 · reCAPTCHA v3 (가이드 §5.5, D-7).

## 1. 단계표 — 75분 정본 (Step 0~4)

step 번호·시간은 `workshop/participant-guide.md`·`facilitator-guide.md` 와 동일하다. 전체 명령·기대 출력은 §1.0~§1.4 에 있다.

| Step | 계획 명령 | 오늘 실행 가능한 동등 명령 (cast/curl) | 기대 결과 | 라벨 |
|---|---|---|---|---|
| **0** (00–10) 준비 확인 | `bun run step:0` — `TODO(구현)` | `cast chain-id --rpc-url $RPC` / `curl … rpc_modules` / `cast balance --rpc-url $RPC --ether $ME` / `cast call --rpc-url $RPC 0x1000000000000000000000000000000000000001 "getParams()((address,string))"` (§1.0) | `450815` (`0x6e0ff`) · `debug/eth/net/rpc/txpool/web3` · 잔액 > 0 · mintDenom `"atokrw"` (Docs 는 `aokrw` → D-1) | `[Live Testnet]` |
| **1** (10–25) OKRW 네이티브 전송 = 결과물 #2 (과제 L363) | `bun run step:1` — `TODO(구현)` | `cast send --rpc-url $RPC --chain "$MAROO_CHAIN_ID" --private-key "$PRIVATE_KEY" --value 1ether --gas-price 9000000000000 --priority-gas-price 1000000000000 $AUX` → `curl … eth_getTransactionReceipt` (§1.1) | receipt `"status":"0x1"`, `effectiveGasPrice` ≈ `0x82f79cd9000`(9e12) · `$MAROO_EXPLORER_URL/tx/<hash>` 열림 · `evidence/live-testnet/<UTC>_step1_<hash8>.json` 저장 | `[Live Testnet]` |
| **2** (25–40) PCL 읽기 | `bun run step:2` — `TODO(구현)` | `cast call --rpc-url $RPC 0x1000000000000000000000000000000000000005 "contractPolicies(address)" 0x100000000000000000000000000000000000000b` / `… "globalPolicies()"` (§1.2) | `0x…0b` 에 `EAS_POLICY`(schema `0x3e448d93…527d`) + `DENYLIST_POLICY`(빈 목록), admin `0x58eC1E71…804F` · 전역 정책 2개 | `[Live Testnet]` |
| **2-R** (25–40) 거부 재현 (과제 L340) | `bun run step:2 -- --expect-reject` — `TODO(구현)` (검토 §1.3 S7) | `cast estimate --rpc-url $RPC --from $ME --value 1ether 0x100000000000000000000000000000000000000b "deposit((bytes,bytes,bytes))" "(0x$(printf '11%.0s' {1..32}),0x,0x$(printf '22%.0s' {1..164}))"` (§1.2R) | `code 3` `execution reverted: <입력 검증 문자열>: invalid request` + revert data `0x08c379a0…`(= `Error(string)`; 실측 2026-09-02. docs 의 `-32000` 은 D-10, §1.2R) → 앞 4바이트를 §1.2R selector 표로 해독. 더미 입력은 `encrypted note is not a canonical deposit-note envelope …` 에서 멈춰 PCL 단계까지 못 간다(가이드 C5; 실측 2026-09-02). value 검사·PCL 검사 순서는 `TODO(실측: 정식 commitment+proof 로 §1.2R (b) 실행 후 data 앞 4바이트 기록)` | `[Live Testnet]` |
| **3** (40–60) Privacy deposit | `bun run step:3` — `TODO(구현)`; 계획 경로는 `forge script script/Step3Deposit.s.sol --rpc-url $RPC --broadcast --private-key "$PRIVATE_KEY"` (`deposit{value: 1 ether}(…)`, tx 기록은 `demo/broadcast/`) | `cast send --rpc-url $RPC --chain "$MAROO_CHAIN_ID" --private-key "$PRIVATE_KEY" --value 1ether 0x100000000000000000000000000000000000000b "deposit((bytes,bytes,bytes))" "(<noteCommitment>,<encryptedNote>,<proof>)"` (§1.3) | 분기 A(KYC attestation + 유효 proof): `status 0x1` + `PrivacyDeposit` 이벤트(topic0 `0xe94fdc79…87c2`). 분기 B(미인증): 결정적 거부 → 오류 원문·UTC·환경·재현 절차 기록(과제 L365). 어느 분기가 실행됐는지 `TODO(실측: 가이드 §6 게이트 ⑥ 결과)` | `[Live Testnet]` |
| **4** (60–75) 정리·토론·다음 단계 + 장애 시 대체 | `bun run step:4` — `TODO(구현)` | Clairveil: `make privacy-e2e-smoke` / 포트 충돌 시 `RPC_PORT=27657 P2P_PORT=27656 GRPC_PORT=9190 API_PORT=1417 make privacy-e2e-smoke` / `KEEP_WORK_DIR=1 make privacy-e2e-smoke` (§1.4) | `privacy e2e smoke passed` (Clairveil `scripts/privacy-e2e-smoke.sh:413`) · `make reference-payroll-demo` 는 증명·tx 없음 | `[Local]` / `[Simulation]` |

### 1.0 Step 0 — 준비 확인 `[Live Testnet]`

```bash
# (a) chainId — 기대 0x6e0ff = 450815 (가이드 A1; 실측 2026-09-02 동일)
curl -s -X POST $RPC -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
# {"jsonrpc":"2.0","id":1,"result":"0x6e0ff"}
cast chain-id --rpc-url $RPC
# 450815

# (b) RPC 네임스페이스 — Maroo 전용 네임스페이스 없음 (가이드 A4; 실측 2026-09-02 동일)
curl -s -X POST $RPC -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"rpc_modules","params":[]}'
# {"jsonrpc":"2.0","id":1,"result":{"debug":"1.0","eth":"1.0","net":"1.0","rpc":"1.0","txpool":"1.0","web3":"1.0"}}

# (c) 잔액 — 0 이면 파우셋 재수령 (가이드 A2, §6 ①)
cast balance --rpc-url $RPC --ether $ME
# > 0

# (d) IOkrw.getParams() selector 0x5e615a6b — mintDenom "atokrw" (가이드 A5, §5.1-①; 실측 2026-09-02)
cast call --rpc-url $RPC 0x1000000000000000000000000000000000000001 "getParams()((address,string))"
# (0x83cBceF68d5989a30795Ce63C9617Aa93016f63F, "atokrw")
```

주의: 가이드 A5 의 표기 `"getParams()(address,string)"` 는 cast 1.7.1 에서 `could not decode output` 으로 실패한다(실측 2026-09-02). 반환값이 tuple 오프셋으로 감싸여 오므로 `((address,string))` 로 써야 한다. 원시 hex 가 필요하면 `cast call … "getParams()"` 또는 `curl … eth_call {"to":"0x1000000000000000000000000000000000000001","data":"0x5e615a6b"}`.

success criteria: (a)(b)(d) 가 위 값과 정확히 일치하고 (c) 가 0 보다 크다(검토 §2.4 00–10).

### 1.1 Step 1 — OKRW 네이티브 전송 `[Live Testnet]` — 결과물 #2

docs `sending-okrw` 는 ethers v6 예제로 쓰여 있고(가이드 §2.1-3, Phase B-1 이 인용) 이 패키지는 그 코드를 쓰지 않는다 — 정본 경로는 `cast send` → `cast receipt` 이며, `demo/src` 실행기(`bun run step:1`, `TODO(구현)`)도 같은 cast 명령을 감싼다. 플래그는 전부 `cast send --help` 에서 확인했고, 수수료 값은 가이드 실측(baseFee 8e12, priority 1e12, `eth_gasPrice` 9e12; 가이드 §2.1-8, A3)이다. 익스플로러 가스 위젯(7,000 gwei 상당)으로 수수료를 잡으면 baseFee 미달이므로 쓰지 않는다(가이드 §5.1-⑦).

```bash
export AUX=0x<본인 보조 주소>          # 자기 자신에게 보내지 않는다. 보조 주소도 테스트넷 전용
# 1 OKRW = 1e18 atokrw (cast 의 1ether = 1e18 최소단위 = `cast to-wei 1 ether`). docs 예시 금액 1,500,000 OKRW 는 파우셋 잔액으로 불가 (가이드 §2.1-3, §5.2-⑫)
cast send --rpc-url $RPC --chain "$MAROO_CHAIN_ID" --private-key "$PRIVATE_KEY" \
  --value 1ether --gas-price 9000000000000 --priority-gas-price 1000000000000 \
  $AUX
# --chain "$MAROO_CHAIN_ID"(450815) 를 빼고 다른 chain id 로 서명하면: -32000 "incorrect chain-id; expected 450815, got 1" (가이드 §2.1-6, §5.1-⑥)

# receipt — status 0x1 / 0x0, null 이면 pending (가이드 §2.1-11)
export TX=0x<위 명령이 출력한 transactionHash>
cast receipt --rpc-url $RPC $TX                     # 사람이 읽는 용도
curl -s -X POST $RPC -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionReceipt","params":["'$TX'"]}'
# 기대: "status":"0x1", "effectiveGasPrice":"0x82f79cd9000" (= 9e12; 가이드 Phase B-2)

# 익스플로러 (가이드 Phase B-2)
open "$MAROO_EXPLORER_URL/tx/$TX"     # 200 이어야 함
```

success criteria: `status 0x1` + `/tx/<hash>` 열림 + §5 규칙대로 `evidence/live-testnet/<UTC>_step1_<hash8>.json` 저장(가이드 §6 ②). 실패해도 그대로 기록한다 — 알려진 문자열: `insufficient funds for gas * price + value: …`, `incorrect chain-id; expected 450815, got …`, `intrinsic gas too low` (가이드 Phase B-4). 실패 기록도 REQ-TESTNET 을 충족한다(과제 L365, 가이드 §6 ②).

### 1.2 Step 2 — PCL 읽기 `[Live Testnet]`

```bash
# (a) 0x…0b(IPrivacy) 에 걸린 컨트랙트 정책 — selector 0xd24d98d8 (가이드 A9; 실측 2026-09-02)
cast call --rpc-url $RPC 0x1000000000000000000000000000000000000005 \
  "contractPolicies(address)" 0x100000000000000000000000000000000000000b
# 원시 hex. 정식 디코드는 `@maroo-chain/contracts@0.0.8` 패키지의 `precompiles/pcl/IPcl.sol`(`bun add` 로 설치) ABI (가이드 A9, §2.2-8)
#   조회: `bun info @maroo-chain/contracts@0.0.8` (cwd 에 package.json 필요) → tarball https://registry.npmjs.org/@maroo-chain/contracts/-/contracts-0.0.8.tgz (shasum 86e4b79d68ca0c231dbf15878ddeda544bc8d5be)
#   → TODO(실측: `bun add @maroo-chain/contracts@0.0.8` 후 node_modules/@maroo-chain/contracts/precompiles/pcl/IPcl.sol 의 contractPolicies 반환 struct 를 cast 반환 타입 문자열로 옮기기)
# 오늘 바로 읽는 법(템플릿 이름만): 
cast call --rpc-url $RPC 0x1000000000000000000000000000000000000005 \
  "contractPolicies(address)" 0x100000000000000000000000000000000000000b | xxd -r -p | strings
# EAS_POLICY
# DENYLIST_POLICY

# (b) 전역 정책 — selector 0x9af4d161 (실측 2026-09-02: eth_call 응답 있음. 함수명은 검토 §2.4 25–40 행)
cast call --rpc-url $RPC 0x1000000000000000000000000000000000000005 "globalPolicies()" | xxd -r -p | strings
# FOR_EACH_POLICY / LOGICAL_POLICY / PERIODIC_VOLUME_POLICY / atokrw / EAS_POLICY / … / VOLUME_POLICY / atokrw / EAS_POLICY … (정책 2개)
```

실측 2026-09-02 `eth_call contractPolicies(0x…0b)` 해독(가이드 A9, §2.3-7 과 일치):

| 항목 | 값 | 출처 |
|---|---|---|
| admin | `0x58eC1E718ff15e5f34591747D47ADf5BccDA804F` (= policyAdmin) | 가이드 §2.3-2, A9; 실측 2026-09-02 |
| 정책 1 | `EAS_POLICY` — eas `0x1000000000000000000000000000000000000007`, indexer `0x1000000000000000000000000000000000000008`, schemaUid `0x3e448d939524a8f3e6a403502e57ce60ee10146292114a58f4bfd1b1d35f527d` ("bytes32 kakaoIdHash, uint8 version") | 가이드 §2.3-7, §2.4-1; 실측 2026-09-02(전체 uid) |
| 정책 2 | `DENYLIST_POLICY` — 목록 비어 있음(가이드 표기 `DENYLIST`) | 가이드 A9; 실측 2026-09-02(온체인 템플릿명) |
| 전역 정책 트리(참고) | 미인증 발신자 OR(VOLUME 2,000,000 tOKRW/건 \| EAS \| ForEach(Any, AgentOwners, EAS)), AgentOwners 에 PERIODIC 10,000,000/24h | 가이드 §2.3-12 `[Live Testnet]` 해석 |

success criteria: 참가자가 "0x…0b 에는 이미 EAS_POLICY 가 걸려 있어 KYC attestation 이 없는 지갑의 deposit 은 PCL 에서 거부된다(관측 calldata 재생으로 `no EAS attestation received …` 재현, D-12; 본인 입력 재현은 TODO(실측))"를 자기 말로 설명한다(가이드 §2.3-7).

### 1.2R Step 2 거부 케이스 — `eth_estimateGas` 사전 점검 `[Live Testnet]` (과제 L340)

docs `[Docs Only]`: PCL 거부는 `eth_estimateGas` 단계에서 `-32000 execution reverted` + revert data 로 **먼저** 드러난다(가이드 §2.1-5). 라이브에서는 `eth_estimateGas` 의 revert 도 `eth_call` 과 같이 **`code 3`** 으로 온다(실측 2026-09-02 08:10 UTC, 아래 (c); 가이드 §5.1-⑥ 은 `eth_call` 만 `code 3` 으로 기록) → **D-10**: estimateGas revert 코드 docs `-32000` vs live `3`(`../SUBMISSION_NOTES.md` D-10, `../docs/testnet-reference.md` §4.2). 전역 정책은 AnteHandler(EVM 실행 전), 컨트랙트 정책은 `deployPclProxy → preCall/postCall` 에서 평가된다(가이드 §2.1-4, §2.3-3; D-6).

```bash
# (a) msg.value 없이 — 문자열 revert. 가이드 C1 [Live Testnet] (2026-09-02 05:18–05:42 UTC) 기록과
#     docs contract-privacy-deposit 의 revert 문자열은 `privacy deposit value is required` 이지만,
#     실측 2026-09-02 08:10 UTC 같은 명령은 value 검사보다 입력 검사가 먼저 걸렸다(둘 다 code 3, data 0x08c379a0… = Error(string)):
cast call --rpc-url $RPC --from $ME --value 0 0x100000000000000000000000000000000000000b \
  "deposit((bytes,bytes,bytes))" "(0x$(printf '00%.0s' {1..32}),0x,0x)"
# execution reverted: note commitment must be non-zero: invalid request
cast call --rpc-url $RPC --from $ME --value 0 0x100000000000000000000000000000000000000b \
  "deposit((bytes,bytes,bytes))" "(0x$(printf '11%.0s' {1..32}),0x,0x)"
# execution reverted: deposit proof is required: invalid request   (--value 1ether 로 바꿔도 같은 문자열 → value 검사는 proof 검사보다 뒤)
# `privacy deposit value is required` 가 나오는 입력 조합: TODO(실측: value 검사가 어느 입력 조합에서 먼저 나오는지 — 정식 형태의 commitment·note·proof 에 --value 0)

# (b) msg.value 1 OKRW + 더미 입력 — estimateGas 거부 (가이드 C5). 더미 = commitment 0x11×32, encryptedNote 빈 값, proof 0x22×164
cast estimate --rpc-url $RPC --from $ME --value 1ether 0x100000000000000000000000000000000000000b \
  "deposit((bytes,bytes,bytes))" "(0x$(printf '11%.0s' {1..32}),0x,0x$(printf '22%.0s' {1..164}))"
# error code 3: execution reverted: encrypted note is not a canonical deposit-note envelope: encrypted envelope is shorter than the 20-byte header: invalid request
#   (실측 2026-09-02 08:10 UTC; --value 0 으로 바꿔도 같은 문자열)
# 가이드 C5 [Live Testnet]: 더미 입력은 입력 검증 문자열이 먼저 나오고 PCL 단계까지 못 간다.
# PCL 거부를 보려면 정식 입력이 필요 → §1.3. 지름길: 관측 tx 0x3839c31d…899b 의 calldata 를 --from $ME 로 재생하면
#   EAS 거부 문자열 `no EAS attestation received for sender …` 이 재현된다(D-12; ../docs/testnet-reference.md §6.4 재확인 블록)

# (c) 같은 것을 curl 로 — data 는 cast calldata 로 만든다 (cast calldata --help 확인)
DATA=$(cast calldata "deposit((bytes,bytes,bytes))" "(0x$(printf '11%.0s' {1..32}),0x,0x$(printf '22%.0s' {1..164}))")
curl -s -X POST $RPC -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_estimateGas","params":[{"from":"'$ME'","to":"0x100000000000000000000000000000000000000b","value":"0xde0b6b3a7640000","data":"'$DATA'"}]}'
# 실측 2026-09-02 08:10 UTC: {"error":{"code":3,"message":"execution reverted: encrypted note is not a canonical deposit-note envelope: …: invalid request","data":"0x08c379a0…"}}
# [Docs Only] docs estimate-gas(가이드 §2.1-5, §5.1-⑥) 는 {"error":{"code":-32000,"message":"execution reverted …"}} 로 적혀 있다
#   → D-10: estimateGas revert 코드 docs -32000 vs live 3 (재현: 이 curl)
# 참고: eth_call 의 revert 도 code 3 (가이드 §5.1-⑥; 실측 2026-09-02 동일). from 이 잔액 0 인 주소면 revert 전에
#   -32000 "rpc error: code = Unknown desc = insufficient balance for transfer" 가 먼저 온다(실측 2026-09-02) — $ME 잔액을 먼저 확인
```

**해독법** — `data` 의 앞 4바이트(`0x` 포함 10글자)를 아래 표와 비교한다. 시그니처를 아는 오류는 `cast decode-error --sig "<sig>" <data>` 로 인자까지 푼다(`cast decode-error --help` 확인; 실측 2026-09-02 `--sig "Error(string)"` 로 `"no method with id: 0x68a36263"` 디코드 성공).

| selector | 오류 | 어디서 | 출처 |
|---|---|---|---|
| `0x08c379a0` | `Error(string)` — 문자열 revert(예: `note commitment must be non-zero`, `deposit proof is required`, `encrypted note is not a canonical deposit-note envelope …`(실측 2026-09-02), `privacy deposit value is required`(docs contract-privacy-deposit; 가이드 C1), `no method with id: …`). PCL ReasonCode 가 **아님** | Privacy 입력 검사 | `cast sig` 실측; 가이드 §2.2-2 "비-PCL 문자열 revert 구분" |
| `0x1a152487` | `EasAttestationRequired` — 전체 시그니처 `TODO(실측: docs pcl-reason-codes 페이지)` | PCL EAS_POLICY | 검토 §2.4 25–40 행, 가이드 §2.2-2 |
| `0xbca5593e` | `EasNoAttestationReceived` — 전체 시그니처 `TODO(실측: docs pcl-reason-codes 페이지)` | PCL EAS_POLICY | 가이드 C5, §6 ⑥ |
| `0x30d7cfd1` | `AnyOfRejected` — 전체 시그니처 `TODO(실측: docs pcl-reason-codes 페이지)` | PCL 복합 정책 | 가이드 §6 ⑥ (KYC 없는 deposit 이 이걸로 감싸진다는 건 추정, 가이드 §7) |
| `0x0201b218` | `InDenylist(address)` | PCL DENYLIST | 가이드 C7 `[Docs Only]`; `cast sig` 실측 |
| `0x82b42900` | `Unauthorized()` — `preCall` 직접 호출 시 | PCL 프록시 훅 | 가이드 C6 `[Live Testnet]`; `cast sig` 실측 |
| `0x6a2b23be` | `PolicyTemplateNotFound(string)` — `policyTemplate("NOPE_POLICY")` | PCL 조회 | 가이드 A8, §5.1-⑪; 실측 2026-09-02 재현(code 3) |
| `0xec8860d9` | `UnauthorizedMinter(address,address)` — 비발행자 `mint` | IOkrw | 가이드 A6 `[Live Testnet]`; `cast sig` 실측 |

검사 순서 — 실측 2026-09-02 08:10 UTC 로 확인된 앞부분: ① `note commitment must be non-zero`(commitment 0) → ② `deposit proof is required`(proof 빈 값; `--value` 0/1ether 무관) → ③ `encrypted note is not a canonical deposit-note envelope …`(더미 note·proof). 셋 다 `Error(string)` `0x08c379a0` 이고 더미 입력은 여기서 멈춘다. 그 뒤 순서는 관측 calldata 재생으로 PCL(EAS, `Error(string)` 문자열) → commitment 중복 → proof 검증까지 확인됐고(`../docs/testnet-reference.md` §4.3, D-12), `privacy deposit value is required` 는 미관측이며 value 0 deposit 이 성공한 표본이 있다(D-13). typed PCL 오류(`EasAttestationRequired` vs `EasNoAttestationReceived` vs `AnyOfRejected`)는 미관측. 본인 정식 입력으로의 재현은 `TODO(실측: 정식 형태의 commitment·note·proof 에 --value 0 을 준 뒤 data 앞 4바이트와 원문을 evidence 에 기록)`.

success criteria: 참가자가 revert data 앞 4바이트를 표에서 찾아 "이 거부는 Privacy 입력 검사 / PCL 정책 중 어느 쪽인지"를 말한다(검토 §2.4 25–40).

### 1.3 Step 3 — Privacy deposit `[Live Testnet]`

`IPrivacy` `0x100000000000000000000000000000000000000b` · `deposit((bytes noteCommitment, bytes encryptedNote, bytes proof))` · selector `0xe6eb7771` · payable, 금액은 `msg.value`(가이드 §2.2-3; `cast sig` 실측). docs 는 `msg.value` 0 이면 `privacy deposit value is required` 로 revert 한다고 쓰지만 라이브에서는 value 0 deposit 이 성공한 표본이 있다(D-13, `../docs/testnet-reference.md` §4.2) — 워크숍은 OKRW 를 실제로 잠그기 위해 `--value` 를 준다. 구 시그니처 `deposit((string,bytes,bytes))` `0x68a36263`(Clairveil dApp 번들)은 `no method with id: 0x68a36263` (가이드 §5.1-③, C2; 실측 2026-09-02 재현 → D-3). view 메서드가 없으므로 상태 확인은 receipt·이벤트로만 한다(가이드 §2.2-1).

```bash
# 분기 A — KYC attestation 보유 지갑 + 유효 proof (가이드 Phase E)
cast send --rpc-url $RPC --chain "$MAROO_CHAIN_ID" --private-key "$PRIVATE_KEY" --value 1ether \
  0x100000000000000000000000000000000000000b \
  "deposit((bytes,bytes,bytes))" "(<noteCommitment>,<encryptedNote>,<proof>)"
# 계획 경로(TODO(구현)): forge script script/Step3Deposit.s.sol --rpc-url $RPC --broadcast --private-key "$PRIVATE_KEY"
#   (Step3Deposit.s.sol: IPrivacy(PRIV).deposit{value: 1 ether}(commitment, encryptedNote, proof); tx 기록은 demo/broadcast/ 에 남아 evidence 로 링크)
# <noteCommitment>/<encryptedNote>/<proof>: TODO(실측: proof 생성 수단 확정 — docs 에 prover/SDK 링크 없음(가이드 §2.2-3 buildDepositWitness 미정의);
#   Clairveil proverd POST /v1/prover/deposit 은 dev-only artifact 라 Maroo VK 호환 미검증(가이드 §3.4-1, Phase E-1). 가이드 §6 게이트 ⑥ 결정 전까지 보류)
# --value 1ether = 1 OKRW. 성공 표본(아래 표)은 10 OKRW(1e19 atokrw)를 넣었다 — 금액은 표본과 다르다
# 가스: 성공 표본 gasUsed 2,239,761 ≈ 9e12 × 2.24M ≈ 20 OKRW (가이드 Phase E-3; 실측 2026-09-02 receipt). 잔액 여유 확인

# 분기 B — 미인증 지갑: 결정적 거부. 먼저 §1.2R (b) 로 estimateGas 거부를 확인하고,
#   실제 tx 로도 남기려면 --gas-limit 을 표본보다 크게 지정한다(채굴 후 status 0x0 로 보이는 거부; 가이드 §2.3-6)
cast send --rpc-url $RPC --chain "$MAROO_CHAIN_ID" --private-key "$PRIVATE_KEY" --value 1ether --gas-limit 2500000 \
  0x100000000000000000000000000000000000000b \
  "deposit((bytes,bytes,bytes))" "(<noteCommitment>,<encryptedNote>,<proof>)"
# 기록: 오류 원문(code/message/data)·UTC·환경·재현 절차 (과제 L365) → evidence/live-testnet/<UTC>_step3_<hash8|reject>.json
```

**성공 표본** (다른 계정이 보낸 실제 tx; 실측 2026-09-02 `eth_getTransactionReceipt`, 가이드 A11):

| 필드 | 값 |
|---|---|
| tx | `0xe492ae2ceebda2a9a48691e42aa9ac0a1df5d00d517fb31783216fc7d0770a70` |
| explorer | `https://explorer-testnet.maroo.io/tx/0xe492ae2ceebda2a9a48691e42aa9ac0a1df5d00d517fb31783216fc7d0770a70` |
| from → to | `0x5164fcc0bae866a669ef01f831493848112f44f8` → `0x100000000000000000000000000000000000000b` |
| status / block / gasUsed / effectiveGasPrice | `0x1` / `0x1049f68` (17,080,168) / `0x222d11` (2,239,761) / `0x82f79cd9000` (9e12) |
| log topic0 | `0xe94fdc798d990ba081f57f5497bc5502379cc0db08b512c87d808678e51787c2` = keccak(`PrivacyDeposit(address,address,string,bytes)`) (가이드 §2.2-8) |
| log data 의 `amount` | `"10000000000000000000atokrw"` = 1e19 atokrw = **10 OKRW** (실측 2026-09-02 receipt log data 문자열 len `0x1a` → `cast to-ascii`) — 단위가 `atokrw` (D-1 의 세 번째 근거; 가이드 A11 은 단위만 기록). 표본 금액 10 OKRW 는 위 명령의 `--value 1ether`(1 OKRW) 와 다르다 |

이 표본의 input 을 `deposit((bytes,bytes,bytes))` 로 디코드하면 실제 인자 형태를 볼 수 있다: `cast tx --rpc-url $RPC 0xe492ae2ceebda2a9a48691e42aa9ac0a1df5d00d517fb31783216fc7d0770a70 input` (`cast tx --help` 확인) → `TODO(실측: 디코드 결과 — 가이드 §7 미확인 항목)`.

success criteria: 분기 A 는 `status 0x1` + `PrivacyDeposit` 이벤트(topic0 위 값). 분기 B 는 오류 원문이 §1.2R 표의 어느 행인지 지목 + 과제 L365 의 4항목이 evidence 에 있음. 어느 분기가 실행됐는지 `TODO(실측: 가이드 §6 게이트 ⑥)`.

### 1.4 Step 4 — 정리·토론·다음 단계 + 장애 시 대체 `[Local]` / `[Simulation]`

토론 주제(정본은 `../workshop/facilitator-guide.md`): ZK 익명성 vs 감사 disclosure(Clairveil `x/privacy/types/msg.go:22-31` disclosure 정책 상수; 가이드 §3.3-6) · 전역 정책(AnteHandler) vs 컨트랙트 정책(`deployPclProxy → preCall/postCall`; 가이드 §2.3-3, D-6) · Docs vs Live 불일치의 의미(D-1~D-13, `../SUBMISSION_NOTES.md` › Discrepancies).

라이브 장애 시 대체(정본은 `../workshop/troubleshooting.md` 마지막 절). Clairveil 로컬넷은 Privacy 코어만 검증한다 — OKRW·PCL 은 없다(검토 §2.1 (1)).

```bash
cd <clairveil> && git rev-parse HEAD             # ca85b02708fdd75259d4d2ee2d671c21198cec69
make init                                        # ~/.clairveil 생성 (Clairveil docs/clairveil-getting-started.md:L46-65). 이 머신은 아직 미실행 → 소요 시간·RSS TODO(실측: 가이드 Phase D)
make privacy-e2e-smoke                           # 기대 마지막 줄: privacy e2e smoke passed  (scripts/privacy-e2e-smoke.sh:413)
RPC_PORT=27657 P2P_PORT=27656 GRPC_PORT=9190 API_PORT=1417 make privacy-e2e-smoke   # 노드가 떠 있을 때 (가이드 §3.2-3; 변수명 scripts/privacy-e2e-smoke.sh:10-14)
KEEP_WORK_DIR=1 make privacy-e2e-smoke           # out/ 산출물 보존 (scripts/privacy-e2e-smoke.sh:7; 가이드 §3.2-3)
make reference-payroll-demo                      # [Simulation]: 증명·브로드캐스트 없음 (examples/reference-payroll/README.md:36 "does not generate live proofs or broadcast chain transactions"; 가이드 §3.5-2). 이 머신에서 [Local] 실행 OK 51s (가이드 §3.5-2)
```

라벨 규칙: `privacy-e2e-smoke` 결과는 `[Local]`(실제 로컬 체인·증명), `reference-payroll-demo` 는 `[Simulation]`. 둘 다 Maroo 테스트넷 흐름(OKRW→PCL→Privacy 한 tx)의 재현이 아니다(가이드 §1 REQ-LOCAL, §5.3-①②).

## 2. Testnet reference (요약)

전체 표(주소·selector·오류 selector·문자열·정책 상태·RPC/faucet, 행마다 라벨 + 재현 명령)는 [`../docs/testnet-reference.md`](../docs/testnet-reference.md). 이 데모가 직접 쓰는 6개만 요약한다. 모두 `[Live Testnet]` 실측 2026-09-02.

| # | 항목 | 값 | 재현 |
|---|---|---|---|
| 1 | chainId | `450815` = `0x6e0ff` | `cast chain-id --rpc-url $RPC` |
| 2 | IOkrw `getParams()` | `0x1000000000000000000000000000000000000001` · selector `0x5e615a6b` → minter `0x83cBceF68d5989a30795Ce63C9617Aa93016f63F`, mintDenom `atokrw` (D-1) | §1.0 (d) |
| 3 | IPcl `contractPolicies(address)` | `0x1000000000000000000000000000000000000005` · selector `0xd24d98d8` → `0x…0b` 에 `EAS_POLICY` + `DENYLIST_POLICY` | §1.2 (a) |
| 4 | IPrivacy `deposit((bytes,bytes,bytes))` | `0x100000000000000000000000000000000000000b` · selector `0xe6eb7771` payable · 구 `0x68a36263` 은 `no method with id` (D-3) | §1.3, `curl … eth_call {"to":"0x…0b","data":"0x68a36263"}` |
| 5 | PCL policyAdmin | `0x58eC1E718ff15e5f34591747D47ADf5BccDA804F` — 전역 정책은 이 계정만 설정(가이드 §2.3-2) | §1.2 (a) 응답의 admin |
| 6 | OKRW ERC20 표현 `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` | 코드 없음 `eth_getCode` = `0x` (D-2) → 데모는 **네이티브 전송**만 쓴다 | `cast code --rpc-url $RPC 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` |

## 3. Validation (과제 L380-383)

### 3.1 깨끗한 환경에서 시작하는 절차 (clean-room)

필요 도구: `git`, `curl`, Foundry `cast`/`forge` 1.7.1, `xxd`·`strings`(§1.2 이름 읽기용), `bun` 1.4.0(계획 코드용; 오늘은 불필요). 확인된 실행 환경: macOS 26.5.2 (Darwin arm64), Node v22.13.0, Go 1.25.12, bun 1.4.0, forge 1.7.1, cast 1.7.1 (실측 2026-09-02).

1. `git clone TODO(실측: 이 패키지의 공개 리포 URL) && cd maroo-privacy-workshop`
2. (Clairveil 참고용, Step 4 대체 경로에만 필요) `git clone https://github.com/DELIGHT-LABS/clairveil.git ../clairveil && git -C ../clairveil checkout ca85b02708fdd75259d4d2ee2d671c21198cec69` — 원격 URL은 `git remote -v` 실측 2026-09-02; SHA 기록 규칙은 과제 L137. 확인: `git -C ../clairveil rev-parse HEAD` → `ca85b02708fdd75259d4d2ee2d671c21198cec69`.
3. 도구 확인: `bun --version` → `1.4.0`, `forge --version` → `1.7.1`, `cast --version` → `1.7.1` (실측 2026-09-02). 없으면 설치 후 다시 확인한다.
4. `cd demo && cp .env.example .env` 후 값 채우기(키 14개 = `MAROO_*` 12개 + 비밀 2개, §0.1): `PRIVATE_KEY`(테스트넷 전용 새 키)는 채우고, `PROVER_BEARER_TOKEN` 은 proof 생성 수단이 확정될 때까지(§1.3, 가이드 §6 게이트 ⑥) 비워 둔다. 나머지 12개(`MAROO_*`)는 예시 값 그대로인지 확인. `.env` 는 커밋되지 않는다(`.gitignore`). 이어서 §0.1 공통 블록의 `set -a; source .env; set +a` 와 `RPC`…`ME` export.
5. 준비 확인 명령 3개 (§1.0):
   - `cast chain-id --rpc-url $RPC` → `450815`
   - `cast balance --rpc-url $RPC --ether $ME` → `> 0`
   - `cast call --rpc-url $RPC 0x1000000000000000000000000000000000000001 "getParams()((address,string))"` → `(…, "atokrw")`
6. Step 1 실행 (§1.1 `cast send …`). `bun install --frozen-lockfile` / `bun run step:1` 은 `demo/package.json`·`bun.lock` 이 없어 `TODO(구현)`.
7. 확인: `curl … eth_getTransactionReceipt` 의 `"status":"0x1"` · `$MAROO_EXPLORER_URL/tx/<hash>` 열림 · `evidence/live-testnet/<UTC>_step1_<hash8>.json` 이 §5 필드를 모두 담고 있음 · `grep -rIiE "PRIVATE_KEY=|mnemonic|bearer" evidence/` 출력 없음.

### 3.2 스모크 체크리스트 (수동; 스크립트는 `TODO(구현)`)

| # | 명령 | 기대값 | 라벨 | 출처 |
|---|---|---|---|---|
| S1 | `curl … eth_chainId` | `"result":"0x6e0ff"` | `[Live Testnet]` | 가이드 A1; 실측 2026-09-02 |
| S2 | `curl … rpc_modules` | `debug`,`eth`,`net`,`rpc`,`txpool`,`web3` 6개 | `[Live Testnet]` | 가이드 A4; 실측 2026-09-02 |
| S3 | `cast balance --rpc-url $RPC --ether $ME` | `> 0` | `[Live Testnet]` | 가이드 A2 |
| S4 | `cast call … 0x…01 "getParams()((address,string))"` | `"atokrw"` | `[Live Testnet]` | 가이드 A5; 실측 2026-09-02 |
| S5 | `cast code --rpc-url $RPC 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` | `0x` (코드 없음, D-2) | `[Live Testnet]` | 가이드 A7; 실측 2026-09-02 `eth_getCode` |
| S6 | `cast call … 0x…05 "contractPolicies(address)" 0x…0b \| xxd -r -p \| strings` | `EAS_POLICY`, `DENYLIST_POLICY` | `[Live Testnet]` | 가이드 A9; 실측 2026-09-02 |
| S7 | `curl … eth_call {"to":"0x…0b","data":"0x68a36263"}` | `"code":3`, `execution reverted: no method with id: 0x68a36263` (D-3) | `[Live Testnet]` | 가이드 C2; 실측 2026-09-02 |
| S8 | `cast call … 0x…05 "policyTemplate(string)" NOPE_POLICY` | revert data `0x6a2b23be…` = `PolicyTemplateNotFound(string)` | `[Live Testnet]` | 가이드 A8; 실측 2026-09-02 |
| S9 | (Step 1 후) `curl … eth_getTransactionReceipt` | `"status":"0x1"` | `[Live Testnet]` | 가이드 Phase B-2 |
| S10 | `ls evidence/live-testnet/` + `grep -rIiE "PRIVATE_KEY=\|mnemonic\|bearer" evidence/` | 파일명이 §5 형식 · grep 출력 없음 | — | 과제 L169, 검토 §1.2 M6 |
| S11 | (Step 4 대체 경로를 실제로 돌렸을 때만) `make privacy-e2e-smoke` 마지막 줄 | `privacy e2e smoke passed` | `[Local]` | Clairveil `scripts/privacy-e2e-smoke.sh:413`; 이 머신 미실행 → `TODO(실측: 가이드 Phase D)` |

### 3.3 초기화·정리(reset) 범위

`bun run reset`(`TODO(구현)`)과 수동 정리는 **리포 내부 생성물만** 지운다(검토 §1.4 nit). 범위는 `.gitignore` 의 생성물 항목과 같다.

```bash
rm -rf demo/node_modules demo/out demo/cache tmp
```

- 지우지 않는 것: `demo/broadcast/`(forge script --broadcast 의 tx 기록, 커밋·evidence 대상) · `demo/bun.lock`(커밋 대상) · `evidence/`(결과물 #2, 과제 L362-366) · `demo/.env`(사용자가 직접 관리) · `~/.clairveil`, `~/.clairveil.backup-*`(Clairveil `make clean` 도 지우지 않는다 — `Makefile:163-165`, 가이드 §3.2-2; 백업 디렉터리에는 dev 키가 남으므로 삭제는 사용자가 확인 후 직접, 가이드 §3.2-4, §8).
- Clairveil `privacy-e2e-smoke` 는 기본 실행에서 mktemp 작업 디렉터리를 `trap cleanup EXIT` 로 지워 흔적을 남기지 않는다(`scripts/privacy-e2e-smoke.sh:63`, 가이드 §3.2-3). `KEEP_WORK_DIR=1` 로 남긴 `out/` 은 필요한 파일만 `evidence/` 로 옮긴 뒤 삭제한다.
- 테스트넷 상태(전송된 OKRW, deposit)는 되돌릴 수 없다. 데모를 다시 돌릴 때는 보조 주소·금액만 바꾼다.

## 4. 변경 범위·출처

| 원본 경로@SHA | 사용 범위 | 라이선스 | 변경 요약 |
|---|---|---|---|
| (현재 없음) | — | — | Clairveil 에서 복사한 파일 없음. `demo/src`·`demo/script` 미작성 |

규칙(과제 L168, 검토 §1.2 M4·M5):
- Clairveil 파일을 복사·수정하면 파일 상단에 `Modified from clairveil@ca85b02 <path>` 고지를 넣고, 이 표에 행을 추가하며, 루트에 `LICENSE`(Apache-2.0) + `NOTICE`(원문 + 파생 한 줄)를 추가한다. Clairveil HEAD `ca85b02708fdd75259d4d2ee2d671c21198cec69`(2026-08-02, v0.4.0, Apache-2.0 + NOTICE).
- `examples/clairveil-dapp/server.js:132-149` 의 공개 dev 니모닉 4개는 어떤 형태로도 가져오지 않는다(과제 L169). 이 dApp 번들은 구 ABI(`0x68a36263`)라 테스트넷에서 동작하지 않으므로(가이드 §3.4-5) 포크 대상이 아니다 — 계획 코드는 docs 기준 직접 작성(검토 §1.7-1).
- bun 의존성은 `@maroo-chain/contracts@0.0.8`(npm 레지스트리(registry.npmjs.org), MIT; `bun add @maroo-chain/contracts@0.0.8`, remapping `@maroo-chain/contracts/=node_modules/@maroo-chain/contracts/`) 하나이며 체인 SDK 는 쓰지 않는다. `demo/package.json` 이 생기면 이 표에 이름·버전만 적는다.

## 5. evidence 규칙 (`../evidence/live-testnet/`)

파일은 만들지 않고 규칙만 둔다. 실제 파일은 Step 1·2-R·3 을 실행할 때 생성한다.

**파일명**: `evidence/live-testnet/<UTC>_<step>_<hash8>.json`
- `<UTC>` = `date -u +%Y%m%dT%H%M%SZ` (예: `20260902T075700Z`)
- `<step>` = `step1` / `step2r` / `step3`
- `<hash8>` = tx hash 의 `0x` 제외 앞 8 hex (예: 표본 tx 라면 `e492ae2c`). tx hash 가 없는 거부 기록(`eth_estimateGas` 단계)은 `reject`.
- 스크린샷은 같은 이름의 `.png` 로 옆에 둔다(검토 §1.3 S8). 새 브라우저 프로필로 찍는다(검토 §1.2 M6).

**포함 필드** (과제 L363-365, L198-202):

```json
{
  "label": "[Live Testnet]",
  "utc": "<UTC>",
  "step": "step1",
  "command": "<실행한 명령 원문. PRIVATE_KEY 값은 \"$PRIVATE_KEY\" 로>",
  "env": { "os": "macOS 26.5.2 (Darwin arm64)", "bun": "1.4.0", "forge": "1.7.1", "cast": "1.7.1", "clairveil_sha": "ca85b02708fdd75259d4d2ee2d671c21198cec69" },
  "tx_hash": "0x<64 hex>",
  "from": "0x<주소>", "to": "0x<주소>",
  "status": "0x1", "gasUsed": "0x<hex>", "blockNumber": "0x<hex>",
  "explorer": "https://explorer-testnet.maroo.io/tx/0x<64 hex>",
  "receipt": { "...": "eth_getTransactionReceipt 응답 result 를 그대로" },
  "error": null
}
```

- 실패·거부 기록은 `tx_hash`/`status`/`gasUsed`/`blockNumber`/`receipt` 를 `null` 로 두고 `error` 에 RPC 응답의 `code`·`message`·`data` 원문과 `"repro": ["<재현 절차>"]` 를 넣는다(과제 L365).
- 값은 RPC 응답 원문 그대로 붙인다. 잘린 해시를 늘려 쓰거나, 문서 값으로 실측을 대체하지 않는다(과제 L156).
- `../SUBMISSION_NOTES.md` › Validation 실행 기록 표에서 이 파일을 상대 경로로 링크한다.

**금지 항목** (과제 L169, 가이드 §8, 검토 §1.2 M6): 개인키·니모닉·`PROVER_BEARER_TOKEN` 값·`.env` 내용·카카오 본인인증 화면·KYC 에 입력한 실명/생년월일/휴대폰·Clairveil dev 니모닉(`examples/clairveil-dapp/server.js:132-149`)·`~/.clairveil/init-out/*-key.json`. **허용**: 주소·tx hash·explorer URL·attestation UID·오류 문자열.
