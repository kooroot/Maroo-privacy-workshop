# 참가자 가이드 — Maroo 프라이버시·컴플라이언스 흐름 (75분)

대상: Maroo 테스트넷에 기관 서비스를 붙이려는 엔지니어(Solidity/TypeScript 가능, Cosmos 지식 불필요). 사전 요구·설치·라벨 범례의 정본은 [../README.md](../README.md), 데모 단계표는 [../demo/README.md](../demo/README.md), 주소·selector·오류 표는 [../docs/testnet-reference.md](../docs/testnet-reference.md), 흐름 다이어그램과 신뢰 경계는 [../docs/architecture.md](../docs/architecture.md) 다. 이 문서는 절차와 **단계별 success criteria 의 정본**이다(과제 L373). 진행자용 시간표·토론 질문은 [facilitator-guide.md](facilitator-guide.md), 막히면 [troubleshooting.md](troubleshooting.md).

증거 라벨은 네 가지만 쓴다(과제 L158): `[Live Testnet]` `[Local]` `[Simulation]` `[Docs Only]`. 이 문서의 `[Live Testnet]` 값은 2026-09-02 05:18–05:42 UTC(탐색 가이드 §0) 와 07:52–07:56 UTC(이 문서 작성 시 읽기 전용 재확인)에 chain 450815 에서 확인한 것이다.

실행 대상은 **Maroo 테스트넷**(EVM JSON-RPC, chainId 450815 = `0x6e0ff`, RPC `https://rpc-testnet.maroo.io`, explorer `https://explorer-testnet.maroo.io`) 이다. Clairveil 로컬넷(`clairveild`, `uclair`)에는 EVM·OKRW·PCL 이 없으므로 기반 Privacy 모듈의 구현 참고 자료이자 장애 시 `[Local]`/`[Simulation]` 대체 경로일 뿐이다(리뷰 §2.1, 가이드 §3.1-4).

---

## 학습 목표 (과제 L337-342)

워크숍을 마치면 다음을 할 수 있어야 한다.

1. Maroo 테스트넷에 연결하고 테스트 자산(tOKRW)이 준비됐는지 스스로 확인한다 (과제 L337-338). — Step 0
2. OKRW(네이티브 `msg.value`) → PCL(정책 평가) → Privacy(`IPrivacy.deposit`) 가 **한 tx** 안에서 연결되는 흐름을 실행한다 (과제 L339; 가이드 §1 REQ-FLOW). — Step 1~3
3. 성공(receipt `status 0x1`) 또는 거부(revert 데이터)를 확인하고, 그 결과로 disclosure·policy·privacy 상태를 설명한다 (과제 L340-341). — Step 2~4
4. 프로덕션 연동 전에 조직이 추가로 결정해야 할 사항을 구분한다 (과제 L342). — 종료 후 다음 단계

---

## §0 준비 확인 (워크숍 전에 집에서)

사전 요구(bun 1.4.0, foundry 1.7.1 `cast`/`forge`, `.env`)는 [../README.md](../README.md) 의 Quick Start 를 따른다. 이 문서는 절차를 재기술하지 않는다.

공통 셸 준비(모든 Step 이 이 변수를 쓴다). `PRIVATE_KEY` 는 `demo/.env`(gitignore) 에만 둔다(과제 L169-170).

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

오늘 바로 실행 가능한 확인 명령 3개와 기대 출력 `[Live Testnet] (2026-09-02T07:52Z)`:

| # | 명령 | 기대 출력 | 출처 |
|---|---|---|---|
| 1 | `curl -s -X POST $RPC -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'` | `{"jsonrpc":"2.0","id":1,"result":"0x6e0ff"}` | 가이드 §4 A1; 재확인 |
| 2 | `curl -s -X POST $RPC -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":2,"method":"rpc_modules","params":[]}'` | `{"jsonrpc":"2.0","id":2,"result":{"debug":"1.0","eth":"1.0","net":"1.0","rpc":"1.0","txpool":"1.0","web3":"1.0"}}` — Maroo 전용 네임스페이스 없음 | 가이드 §4 A4; 재확인 |
| 3 | `cast call --rpc-url $RPC $OKRW "getParams()((address,string))"` | `(0x83cBceF68d5989a30795Ce63C9617Aa93016f63F, "atokrw")` | 가이드 §4 A5(selector `0x5e615a6b`); 재확인 |

세 값이 다르면 워크숍 당일 Step 0 에서 진행자에게 알린다. 셋 중 하나라도 응답이 없으면 [troubleshooting.md#fallback](troubleshooting.md#fallback) 의 전환 판단 기준을 본다.

> 참고: 가이드 §4 A5 의 `"getParams()(address,string)"` 형태는 cast 1.7.1 에서 `could not decode output` 로 실패한다(프리컴파일이 튜플 오프셋을 붙여 반환). 위 표의 `((address,string))` 형태를 쓴다 `[Live Testnet] (2026-09-02T07:56Z)`. curl 원본 응답에서 `61746f6b7277` 이 보이면 `cast --to-ascii 0x61746f6b7277` → `atokrw`.

---

## Step 0 (00–10) 준비 확인 `[Live Testnet]`

**목표**: 연결·잔액·denom 세 가지를 눈으로 확인하고, Docs 와 Live 의 첫 불일치(D-1)를 관찰한다.

**명령** — 계획: `bun run step:0` (TODO(구현)). 오늘 실행 가능한 동등 명령:

```bash
cast chain-id --rpc-url $RPC                                   # 450815
cast rpc --rpc-url $RPC rpc_modules                            # {"debug":"1.0","eth":"1.0",...}
cast balance --rpc-url $RPC --ether $ME                        # > 0 (faucet tOKRW 수령분)
cast call --rpc-url $RPC $OKRW "getParams()((address,string))" # (0x83cB…f63F, "atokrw")
```

**기대 출력** `[Live Testnet] (2026-09-02T07:56Z)`: `450815` / `{"debug":"1.0","eth":"1.0","net":"1.0","rpc":"1.0","txpool":"1.0","web3":"1.0"}` / 본인 잔액 TODO(실측: `cast balance --ether $ME`) / `(0x83cBceF68d5989a30795Ce63C9617Aa93016f63F, "atokrw")`.

관찰: docs.maroo.io(testnet-access 등 19개 페이지)는 base unit 을 `aokrw` 라고 쓰지만 체인은 `atokrw` 를 돌려준다 → **D-1** (가이드 §5.1-①). 코드에 denom 을 하드코딩하지 말고 `getParams()` 값을 읽는다.

**Success criteria (정본)**:
- S0-1: `eth_chainId` 응답이 `0x6e0ff`(= 450815) 이다.
- S0-2: `rpc_modules` 에 `eth` 가 있고 Cosmos 네임스페이스는 없다.
- S0-3: `eth_getBalance($ME)` 가 0 보다 크다.
- S0-4: `getParams().mintDenom` 이 `atokrw` 임을 읽고 D-1 을 한 문장으로 말할 수 있다.

**라벨**: `[Live Testnet]`
**막히면**: 잔액 0 → [troubleshooting.md#faucet-limit](troubleshooting.md#faucet-limit) · RPC 무응답 → [troubleshooting.md#fallback](troubleshooting.md#fallback) · REST/gRPC 를 찾고 있다면 → [troubleshooting.md#cosmos-rest-grpc](troubleshooting.md#cosmos-rest-grpc)

---

## Step 1 (10–25) OKRW 네이티브 전송 `[Live Testnet]` — Track B 결과물 #2

**목표**: 상태를 변경하는 테스트넷 tx 를 최소 한 번 실제로 시도한다(과제 L363). 1 OKRW = 1e18 atokrw 를 본인 보조 주소로 보내고 receipt 와 explorer 링크를 증거로 남긴다.

**보조 주소**: `cast wallet new` 로 만든 새 키쌍의 **주소만** 쓰거나 진행자가 나눠 준 주소를 쓴다. 새 키쌍의 개인키는 evidence·스크린샷에 절대 넣지 않는다(과제 L169).

**수수료** `[Live Testnet]`: baseFee 8e12 · priority 1e12 · `eth_gasPrice` 9e12 atokrw (가이드 §2.1-8, §4 A3; 2026-09-02T07:56Z `cast base-fee` → `8000000000000`, `cast gas-price` → `9000000000000` 재확인). 단순 전송 21,000 gas ≈ 0.189 OKRW (가이드 §2.1-8).

**명령** — 계획: `bun run step:1` (TODO(구현); demo/src 의 bun TS 실행기가 아래 `cast send` → `cast receipt` 를 호출해 결과를 `evidence/live-testnet/` 에 저장). 정본 경로는 `cast send` → `cast receipt` 다 — 가이드 §4 Phase B 가 참조한 docs `sending-okrw` 는 ethers v6 예제로 쓰여 있으나 이 패키지는 그 레시피를 쓰지 않는다. 오늘 실행 가능한 동등 명령(플래그는 `cast send --help` 로 확인함):

```bash
export AUX=0x<보조 주소>
cast send --rpc-url $RPC --chain "$MAROO_CHAIN_ID" --private-key "$PRIVATE_KEY" \
  --value 1ether \
  --gas-price 9000000000000 --priority-gas-price 1000000000000 \
  --json $AUX
# --chain = 450815 (.env 의 MAROO_CHAIN_ID). --gas-price 는 EIP-1559 에서 max fee per gas, --priority-gas-price 는 max priority fee (cast send --help)
```

응답 JSON 의 `transactionHash` 를 `TX` 로 두고:

```bash
export TX=0x<transactionHash>
cast receipt --rpc-url $RPC --json $TX > ../evidence/live-testnet/$(date -u +%Y%m%dT%H%M%SZ)_step1_${TX:2:8}.json
cast receipt --rpc-url $RPC $TX status        # true
echo https://explorer-testnet.maroo.io/tx/$TX # 브라우저에서 200
```

**기대 출력**: receipt `"status":"0x1"`, `effectiveGasPrice` ≈ `0x82f79cd9000`(9e12) (가이드 §4 Phase B-2), `gasUsed` `0x5208`(21,000) TODO(실측: 본인 receipt). explorer `/tx/<hash>` 가 열린다(성공 표본 tx 의 `/tx/` 페이지가 HTTP 200 임을 2026-09-02T07:54Z 확인).

**evidence 기록** (과제 L363-365): receipt JSON 파일 + 같은 이름의 `.png`(explorer 화면) + `UTC`, OS/bun/forge·cast 버전, 명령 원문. 파일명 규칙 `<UTC>_<step>_<hash8>.json/.png` 의 정본은 [../README.md](../README.md).

**Success criteria (정본)**:
- S1-1: `eth_getTransactionReceipt` 의 `status` 가 `0x1` 이다.
- S1-2: `https://explorer-testnet.maroo.io/tx/<hash>` 가 열리고 같은 해시를 보여 준다.
- S1-3: `evidence/live-testnet/` 에 receipt JSON 과 UTC·환경 기록이 있다.
- S1-4 (실패 시 대체): tx 가 실패했다면 오류 원문·UTC·환경·재현 절차를 같은 위치에 기록했다(과제 L365).

**라벨**: `[Live Testnet]`
**막히면**: `insufficient funds …` / `intrinsic gas too low` / 포함 안 됨 → [troubleshooting.md#fee-gas](troubleshooting.md#fee-gas) · `incorrect chain-id; expected 450815, got …` → Step 0 의 chainId 확인으로 돌아간다(가이드 §5.1-⑥) · explorer 지연 → [troubleshooting.md#fallback](troubleshooting.md#fallback)

---

## Step 2 (25–40) PCL 읽기 + 거부 재현 `[Live Testnet]`

**목표**: Privacy 프리컴파일 `0x…0b` 에 **이미 걸려 있는** 컨트랙트 정책과 전역 정책을 읽고, tx 를 보내기 전에 `eth_estimateGas` 로 거부를 재현·해독한다.

**명령** — 계획: `bun run step:2` (TODO(구현)). 오늘 실행 가능한 동등 명령:

```bash
# (a) 컨트랙트 정책: IPcl.contractPolicies(address) selector 0xd24d98d8
cast call --rpc-url $RPC $PCL "contractPolicies(address)" $PRIV
#     ABI 없이 이름만 보려면:
cast call --rpc-url $RPC $PCL "contractPolicies(address)" $PRIV | sed 's/^0x//' | xxd -r -p | strings | grep POLICY

# (b) 전역 정책: IPcl.globalPolicies() (cast sig → 0x9af4d161)
cast call --rpc-url $RPC $PCL "globalPolicies()" | sed 's/^0x//' | xxd -r -p | strings | grep -E "POLICY|atokrw"

# (c) 거부 재현: 미인증 sender(본인)로 deposit 사전 점검 — tx 전송 아님
C32="0x$(printf '01%.0s' {1..32})"; P164="0x$(printf '01%.0s' {1..164})"
cast estimate --rpc-url $RPC --from $ME --value 1ether $PRIV \
  "deposit((bytes,bytes,bytes))" "($C32,0x,$P164)"
#     같은 것을 curl 로:
CD=$(cast calldata "deposit((bytes,bytes,bytes))" "($C32,0x,$P164)")
curl -s -X POST $RPC -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":9,"method":"eth_estimateGas","params":[{"from":"'$ME'","to":"'$PRIV'","value":"0xde0b6b3a7640000","data":"'$CD'"}]}'

# (d) 덤: PCL 훅 직접 호출은 왜 안 되나
cast call --rpc-url $RPC --from $ME $PCL "preCall(address,address,bytes,uint256)" $ME $PRIV 0x 0
```

**기대 출력**:
- (a) `[Live Testnet] (2026-09-02T07:56Z)` strings 에 `EAS_POLICY` 와 `DENYLIST_POLICY` 가 보인다. 원본 hex 에는 admin `0x58ec1e718ff15e5f34591747d47adf5bccda804f`(= policyAdmin, 가이드 §2.3-2), EAS 주소 `0x…07`, indexer `0x…08`, schema `0x3e448d939524a8f3e6a403502e57ce60ee10146292114a58f4bfd1b1d35f527d` 가 들어 있다(가이드 §4 A9 는 `0x3e448d93…527d` 로 표기; 전체 값은 이번 raw 출력에서 확인). 필드 단위 디코드는 TODO(실측: `@maroo-chain/contracts@0.0.8` 패키지(`bun add` 로 설치)의 `precompiles/pcl/IPcl.sol` / `dist/abi/precompiles/pcl/IPcl.js` ABI 로 `cast abi-decode`).
- (b) `[Live Testnet] (2026-09-02T07:56Z)` `FOR_EACH_POLICY`, `LOGICAL_POLICY`, `PERIODIC_VOLUME_POLICY`, `VOLUME_POLICY`, `EAS_POLICY`, `atokrw` 문자열이 보인다. 트리 구조의 해석은 가이드 §2.3-12(미인증 발신자 OR(VOLUME 2,000,000 tOKRW/건 | EAS | ForEach(Any, AgentOwners, EAS)), AgentOwners 에 PERIODIC 10,000,000/24h) `[Live Testnet]` 를 따르되, 필드 디코드는 TODO(실측: IPcl ABI).
- (c) `[Live Testnet] (2026-09-02T07:53Z, from=policyAdmin 로 재확인)` 더미 입력은 **입력 검증 문자열이 먼저** 나와 PCL 단계까지 가지 않는다(가이드 §4 C5): `{"code":3,"message":"execution reverted: encrypted note is not a canonical deposit-note envelope: encrypted envelope is shorter than the 20-byte header: invalid request","data":"0x08c379a0…"}`. docs `estimate-gas` 페이지는 `-32000 execution reverted` 라고 쓰지만 `[Docs Only]`, 라이브는 `code 3` 으로 온다(가이드 §5.1-⑥ 과 같은 결). **본인 주소로 실행한 결과는 TODO(실측: 위 (c) 를 `--from $ME` 로 실행해 오류 원문 기록)**.
- (c) 를 정식 commitment·envelope·proof 로 실행했을 때 PCL 거부가 어떤 형태로 오는지 — `EasAttestationRequired(address)` `0x1a152487` vs `EasNoAttestationReceived(address)` `0xbca5593e` vs 문자열 — 는 TODO(실측: 정식 입력 필요, 가이드 §4 Phase E). 참고 관측 `[Live Testnet] (타인 tx)`: 2026-09-02T07:52:40Z 에 `0xCaCaB2FE2b22D8BB4A5A44552765518be8C847d0` 가 보낸 deposit tx `0x3839c31d1b5625bd59b5251f6595b3e50ffb451aab93389fdbc488f30ee3899b` 은 explorer `revert_reason` 이 `Error(string)`: `no EAS attestation received for sender (index returned empty): maroo1et9t9l3tytvtkjj6g32jwe23305vs37scfk7f3` 였다(gas_used 1,750,000). 즉 EAS 미인증 거부가 커스텀 오류가 아니라 **문자열**로 온 표본이 하나 있다 — docs(pcl-policy-enforcement "실패는 ABI 커스텀 오류")와 다르므로 **D-12** 로 등재됐다(SUBMISSION_NOTES Discrepancies; 같은 calldata 를 미인증 주소로 `eth_call` 재생하면 같은 문자열이 재현됨 — [../docs/testnet-reference.md](../docs/testnet-reference.md) §4.3, §6.4 재확인 블록). 본인 주소 재현은 TODO(실측: 관측 tx input 을 `--from $ME` 로 `eth_estimateGas`).
- (d) `[Live Testnet] (2026-09-02T07:52Z)` `execution reverted, data: "0x82b42900"` = `Unauthorized()` (가이드 §4 C6). 훅은 `deployPclProxy → preCall/postCall` 경유로만 호출된다(**D-6**: `runOnPcl` 같은 함수는 없다).

**해독법** (어느 오류든 revert `data` 첫 4바이트로 판정):

```bash
DATA=0x<estimateGas 응답의 data>
echo ${DATA:0:10}                                                  # selector
cast decode-error --sig "Error(string)" $DATA                       # 0x08c379a0 이면 비-PCL 문자열 revert
cast decode-error --sig "EasNoAttestationReceived(address)" $DATA   # 0xbca5593e 이면
cast decode-error --sig "EasAttestationRequired(address)" $DATA     # 0x1a152487 이면
```

selector 표는 [troubleshooting.md#estimategas-reverted](troubleshooting.md#estimategas-reverted) 에 있다(전부 `cast sig` 로 검증, 시그니처는 docs pcl-reason-codes 원문).

**Success criteria (정본)**:
- S2-1: `contractPolicies(0x…0b)` 출력에서 `EAS_POLICY` 와 `DENYLIST_POLICY`, admin `0x58eC…804F` 를 가리킬 수 있다.
- S2-2: `globalPolicies()` 가 응답하고, 전역 정책은 PolicyAdmin 만 바꿀 수 있음을 말할 수 있다(가이드 §2.3-2).
- S2-3: `eth_estimateGas` 가 revert 하고, 그 `data` 의 selector 를 표에서 찾아 **이름**으로 설명한다(`Error(string)` 이면 문자열 원문을 함께).
- S2-4: 오류 원문·UTC·환경을 `evidence/live-testnet/` 에 기록했다.

**라벨**: `[Live Testnet]`
**막히면**: revert 해독 → [troubleshooting.md#estimategas-reverted](troubleshooting.md#estimategas-reverted) · `PolicyTemplateNotFound` → [troubleshooting.md#policy-template-not-found](troubleshooting.md#policy-template-not-found) · `privacy deposit value is required` → [troubleshooting.md#deposit-value-required](troubleshooting.md#deposit-value-required)

---

## Step 3 (40–60) Privacy deposit `[Live Testnet]`

**목표**: `IPrivacy.deposit` 을 실제로 시도해 **성공 또는 결정적 거부** 를 확보한다(과제 L340, L363-365). 어느 분기가 실행되는지는 진행자의 게이트 ⑥ 결정(가이드 §6)에 따른다 — **이번 회차 분기: TODO(실측: A 또는 B)**.

**인터페이스** (docs contract-privacy-deposit, WebFetch 2026-09-02; 가이드 §2.2-3):
`deposit(PrivacyDepositRequest calldata request) external payable returns (bool)`, struct `{bytes noteCommitment; bytes encryptedNote; bytes proof}`, 금액은 `msg.value`(docs 는 value 0 이면 `privacy deposit value is required` 로 revert 라고 쓰지만 라이브에서 value 0 성공 표본이 있다 — **D-13**; 워크숍은 OKRW 를 잠그기 위해 `--value` 를 준다). selector `0xe6eb7771` = `deposit((bytes,bytes,bytes))` `[Live Testnet]`. 구 시그니처 `deposit((string,bytes,bytes))` `0x68a36263`(Clairveil dApp 번들)은 `no method with id: 0x68a36263` → **D-3** (가이드 §5.1-③; 2026-09-02T07:53Z 재확인).

**입력 생성**: 유효한 `noteCommitment`·`encryptedNote`·`proof` 를 만드는 수단은 미확정이다 — docs 에 prover/SDK 링크가 없고(`buildDepositWitness` 미정의, 가이드 §2.2-3), Clairveil `clairveil-proverd` 는 dev-only artifact 라 Maroo VK 와의 호환이 미검증이다(가이드 §4 Phase E-1, `docs/clairveil-circuits.md:276`). 따라서 입력은 TODO(구현: prover 경로, 게이트 ⑥). 사용 시 `PROVER_BEARER_TOKEN` 은 당일 별도 채널로 받는다.

**가스** `[Live Testnet]`: 성공 표본 deposit 은 gasUsed 2,239,761 ≈ 2.24M gas ≈ 20 OKRW(9e12 기준) (가이드 §4 Phase E-3; receipt 2026-09-02T07:54Z 재확인). 실패해도 가스는 소모된다 — 위 거부 표본은 1,750,000 gas 를 썼다. **반드시 Step 2 (c) 의 estimateGas 를 먼저 통과시킨 뒤 전송한다.**

### 분기 A — KYC attestation 보유 + 유효 proof → 성공 tx

전제: 지갑이 `https://kyc-testnet.maroo.io`(카카오 본인인증, 가이드 §2.4-4) 에서 EAS attestation 을 받았고, 정식 proof 가 있다.

**명령** — 계획: `bun run step:3` (TODO(구현); 내부적으로 `forge script script/Step3Deposit.s.sol --rpc-url $RPC --broadcast --private-key "$PRIVATE_KEY"` 를 호출하며 스크립트는 `IPrivacy(PRIV).deposit{value: 1 ether}(commitment, encryptedNote, proof)` 를 실행, tx 기록은 `demo/broadcast/`). 오늘 실행 가능한 동등 명령(입력값은 TODO(구현)):

```bash
NOTE=0x<noteCommitment>; ENC=0x<encryptedNote>; PROOF=0x<proof>
cast estimate --rpc-url $RPC --from $ME --value 1ether $PRIV "deposit((bytes,bytes,bytes))" "($NOTE,$ENC,$PROOF)"
cast send --rpc-url $RPC --chain "$MAROO_CHAIN_ID" --private-key "$PRIVATE_KEY" --value 1ether \
  --gas-price 9000000000000 --priority-gas-price 1000000000000 \
  --json $PRIV "deposit((bytes,bytes,bytes))" "($NOTE,$ENC,$PROOF)"   # --chain = 450815
```

**기대 출력**: receipt `status 0x1`, 로그 1건 `address 0x…0b`, `topic0 0xe94fdc798d990ba081f57f5497bc5502379cc0db08b512c87d808678e51787c2` = keccak(`PrivacyDeposit(address,address,string,bytes)`) (`cast keccak` 으로 확인; 가이드 §2.2-8), `amount` 문자열에 `atokrw` (가이드 §5.1-①). **성공 표본** `[Live Testnet]`: `0xe492ae2ceebda2a9a48691e42aa9ac0a1df5d00d517fb31783216fc7d0770a70` — 2026-09-02T02:56:17Z, block 17080168, gasUsed 2,239,761, effectiveGasPrice 9e12, from `0x5164fcc0bae866a669ef01f831493848112f44f8` (가이드 §4 A11 의 `0xe492ae2c…0a70`; 전체 해시는 explorer `/blockscout/api/v2/addresses/0x…0b/transactions` 에서 2026-09-02T07:52Z 확인). 본인 tx 값은 TODO(실측).

### 분기 B — 미인증 지갑 → 결정적 거부 기록

전제: KYC attestation 없음(외국인·비카카오 참가자 포함).

**명령** — 계획: `bun run step:3 -- --expect-reject` (TODO(구현)). 오늘 실행 가능한 동등 명령: Step 2 (c) 와 같은 `cast estimate` / `curl eth_estimateGas` 를 **본인 주소**로 실행하고 오류 원문을 그대로 저장한다. 온체인 전송은 하지 않아도 된다(estimateGas 거부가 곧 결정적 거부이며 가스를 쓰지 않는다). 진행자가 지시할 때만 `cast send` 로 전송해 `status 0x0` receipt 를 남긴다(≈15.75 OKRW 소모: 표본 1,750,000 gas × 9e12).

**기대 출력**: `{"code":3,"message":"execution reverted: …","data":"0x…"}`. 문자열이면 `cast decode-error --sig "Error(string)"`, PCL selector 면 표로 해독. 어느 오류가 먼저 나는지는 TODO(실측). 기록 항목(과제 L365): 오류 원문, UTC, 환경(OS/bun/forge·cast), 재현 명령 원문.

**Success criteria (정본)** — A 또는 B 중 하나를 만족:
- S3-A1: receipt `status 0x1` 이고 `PrivacyDeposit` 이벤트(topic0 `0xe94fdc79…87c2`) 가 있다.
- S3-A2: explorer `/tx/<hash>` 링크와 receipt JSON 이 `evidence/live-testnet/` 에 있다.
- S3-B1: `eth_estimateGas`(또는 receipt `status 0x0`) 의 오류 원문을 selector/문자열 수준에서 해독해 "무엇이 거부했는지" 한 문장으로 말한다.
- S3-B2: 오류 원문·UTC·환경·재현 명령이 `evidence/live-testnet/` 에 있다(과제 L365).
- S3-C (공통): 결과가 `[Live Testnet]` 인지, 대체 경로(`[Local]`/`[Simulation]`) 인지 라벨을 붙였다.

**라벨**: `[Live Testnet]` (대체 경로로 진행했다면 `[Local]` 또는 `[Simulation]`, [troubleshooting.md#fallback](troubleshooting.md#fallback))
**막히면**: `no method with id` → [troubleshooting.md#no-method-with-id](troubleshooting.md#no-method-with-id) · `privacy deposit value is required` → [troubleshooting.md#deposit-value-required](troubleshooting.md#deposit-value-required) · revert 해독 → [troubleshooting.md#estimategas-reverted](troubleshooting.md#estimategas-reverted) · 가스 → [troubleshooting.md#fee-gas](troubleshooting.md#fee-gas)

---

## Step 4 (60–75) 정리·토론·다음 단계

**목표**: 오늘 본 것을 세 축으로 정리한다 — (1) ZK 익명성 vs 감사 disclosure, (2) 전역 정책(AnteHandler) vs 컨트랙트 정책(`deployPclProxy → preCall/postCall`), (3) Docs vs Live 불일치의 의미. 진행자의 토론 질문은 [facilitator-guide.md](facilitator-guide.md) 에 있다.

**명령**: 없음. 대신 evidence 디렉터리를 정리한다.

```bash
ls -1 ../evidence/live-testnet/
grep -ril "PRIVATE_KEY\|mnemonic\|bearer" ../evidence/ || echo "no secrets"
```

**상태 설명 재료** (과제 L341):
- privacy 상태: `IPrivacy` 에는 view 메서드가 없다 → receipt·이벤트·explorer 로만 설명한다(가이드 §2.2-1) `[Docs Only]`. Clairveil 의 `tree_state`/`commitment`/`nullifier` REST 쿼리는 테스트넷에 노출되지 않는다(가이드 §3.3-5, §7; [troubleshooting.md#cosmos-rest-grpc](troubleshooting.md#cosmos-rest-grpc)).
- policy 상태: Step 2 (a)(b) 의 읽기 결과 `[Live Testnet]`.
- disclosure 상태: 감사 disclosure 는 파일이 아니라 transfer 메시지의 필드다(리뷰 §2.2, `proto/clairveil/privacy/v1/tx.proto:87-89`); 모드 NONE/PUBLIC/RECIPIENT_ENCRYPTED 와 정책 상수는 `x/privacy/types/msg.go:22-31`(가이드 §3.3-1, §3.3-6) `[Local]` 코드 근거. Maroo 테스트넷에서 transfer 는 이 워크숍 범위 밖.

**Success criteria (정본)**:
- S4-1: 세 라벨(`[Live Testnet]`/`[Local]`/`[Docs Only]`) 을 오늘의 산출물에 정확히 붙여 말할 수 있다.
- S4-2: "전역 정책은 AnteHandler 에서 EVM 실행 전에, 컨트랙트 정책은 프록시 훅에서" 를 자기 말로 설명한다.
- S4-3: D-1·D-3·D-6 중 하나를 재현 명령과 함께 설명한다.

**라벨**: `[Live Testnet]` (토론 자체는 라벨 없음) · 대체 경로 사용 시 `[Local]`/`[Simulation]`
**막히면**: 라이브 장애 중이면 [troubleshooting.md#fallback](troubleshooting.md#fallback) 의 안내 문구를 그대로 듣는다.

---

## 종료 후 다음 단계 — 프로덕션 연동 전 결정 사항 (과제 L342)

참가자 조직이 돌아가서 정해야 하는 것 3가지. 각각 오늘 본 근거를 붙였다.

1. **신원(attestation) 공급 경로** — 테스트넷 `0x…0b` 는 Maroo KYC(카카오)가 발급한 schema `0x3e448d93…527d` 의 EAS_POLICY 로 막혀 있다(Step 2, 가이드 §2.3-7). 프로덕션에서 (a) Maroo 가 제공하는 attestation 을 그대로 쓸지, (b) 조직 자체 스키마를 등록하고 `deployPclProxy → changeContractPolicies(EAS_POLICY)` 로 자기 컨트랙트에만 붙일지(가이드 §2.3-8, §2.3-11), (c) 카카오 미보유 고객(외국인)을 어떻게 다룰지(가이드 §2.4-4). 결정 주체·SLA·폐기(revoke) 절차까지.
2. **증명 생성 토폴로지와 회로 신뢰** — 브라우저 WASM prover 는 리포에 없고(가이드 §3.4-4), `clairveil-proverd` 는 HTTP 서비스이며 Bearer 토큰이 비면 무인증이다(가이드 §3.4-3, §8). 현재 artifact 는 "development-only, no trusted setup"(`docs/clairveil-circuits.md:276`) 이고 Maroo 테스트넷 VK 와의 동일성 근거가 없다(가이드 §4 Phase E-1). prover 를 누가 어디서 운영하고, trusted setup·VK 배포·`privacy_zk_manifest.json` 무결성 비교(리뷰 §2.2)를 누가 책임지는지.
3. **감사 disclosure·키 custody 와 정책 관리 주체** — Clairveil 은 `PUBLICATION_READY_EXPERIMENTAL`, "not PRODUCTION_RELEASE_READY"(`CHANGELOG.md`, 가이드 §3.1-3). 감사 master pubkey 미설정이면 transfer 가 거부되고(`x/privacy/keeper/msg_server.go:250-253`), 감사 키 custody 는 알려진 리스크다(`docs/clairveil-release-handoff-pack.md:128-137, 175-187`, 가이드 §3.1-6). 전역 정책은 PolicyAdmin 만, 컨트랙트 정책은 최초 호출자가 admin 이 된다(가이드 §2.3-2, §2.3-10). 조직 내에서 누가 disclosure 정책·감사 키·PCL admin 키를 쥐는지.

체크리스트 원형은 `docs/clairveil-client-api-checklist.md:11-46, 101-110`(가이드 §3.4-8) 을 참고한다.
