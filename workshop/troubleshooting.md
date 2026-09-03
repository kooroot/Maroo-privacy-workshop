# 트러블슈팅 — 흔한 오류 8개 + 라이브 장애 시 대체 진행

형식: 증상(원문) / 원인 / 확인 방법(명령) / 해결. 근거가 있는 항목만 실었다. 라벨은 `[Live Testnet]` `[Local]` `[Simulation]` `[Docs Only]` (과제 L158). `[Live Testnet]` 값은 2026-09-02 05:18–05:42 UTC(탐색 가이드) 와 07:52–07:56 UTC(재확인) 에 chain 450815 에서 읽기 전용으로 확인했다.

공통 변수는 [participant-guide.md](participant-guide.md) §0 의 공통 환경 블록(`cd demo` → `source .env` → `RPC`, `EXPL`, `OKRW`, `PCL`, `EAS`, `PRIV`, `ME`) 을 전제한다.

| # | 앵커 | 증상 한 줄 |
|---|---|---|
| 1 | [#no-method-with-id](#no-method-with-id) | `no method with id: 0x68a36263` |
| 2 | [#estimategas-reverted](#estimategas-reverted) | `eth_estimateGas` → `execution reverted` + 오류 데이터 |
| 3 | [#deposit-value-required](#deposit-value-required) | `privacy deposit value is required` |
| 4 | [#faucet-limit](#faucet-limit) | faucet 이 거부하거나 잔액이 0 |
| 5 | [#fee-gas](#fee-gas) | `insufficient funds …` / `intrinsic gas too low` / 포함 안 됨 |
| 6 | [#policy-template-not-found](#policy-template-not-found) | revert `0x6a2b23be…` = `PolicyTemplateNotFound(string)` |
| 7 | [#cosmos-rest-grpc](#cosmos-rest-grpc) | `:1317`/`:9090`/`abci_info` 를 찾는데 없음 |
| 8 | [#local-port-conflict](#local-port-conflict) | `[Local]` `make privacy-e2e-smoke` 포트 충돌 |
| — | [#fallback](#fallback) | 라이브 장애 시 대체 진행 |

---

<a id="no-method-with-id"></a>
## 1. `no method with id: 0x68a36263` — 구 deposit selector (D-3)

**증상(원문)** `[Live Testnet] (2026-09-02T07:53Z)`
- `cast call`: `Error: server returned an error response: error code 3: execution reverted: no method with id: 0x68a36263, data: "0x08c379a0…"`
- curl `eth_call`: `{"code":3,"message":"execution reverted: no method with id: 0x68a36263","data":"0x08c379a0…"}`
- 온체인 표본: `0xe38734cb1e4b299b65b9135418b46baa93f8f5f5a9f7594258f6775997d78a90` (2026-08-26T09:19:46Z, explorer `revert_reason` = `Error(string)` `no method with id: 0x68a36263`, gas_used 1,250,000 — 실패해도 가스를 썼다)

**원인**: Clairveil `examples/clairveil-dapp/public/app.bundle.js` 의 ABI 가 구형 `deposit((string,bytes,bytes))` = `0x68a36263` 이다(가이드 §3.4-5). 현재 테스트넷은 `deposit((bytes,bytes,bytes))` = `0xe6eb7771` 만 받는다(docs contract-privacy-deposit; 가이드 §5.1-③ **D-3**). 2026-06-24 이전 tx 는 구 ABI 로 성공했었다(가이드 §5.1-③).

**확인 방법**
```bash
cast sig "deposit((string,bytes,bytes))"   # 0x68a36263  (구)
cast sig "deposit((bytes,bytes,bytes))"    # 0xe6eb7771  (현재)
cast tx --rpc-url $RPC 0x<내 tx hash> input | head -c 10   # 내가 보낸 selector
```

**해결**: 인코딩을 `deposit((bytes,bytes,bytes))` 로 바꾼다. `noteCommitment` 는 `string` 이 아니라 `bytes`. Clairveil dApp 번들을 그대로 테스트넷에 붙이지 않는다(가이드 §3.4-5 "이 dApp을 그대로 테스트넷에 붙이면 실패한다"). cast 예시는 participant-guide Step 3.

---

<a id="estimategas-reverted"></a>
## 2. `eth_estimateGas` → `execution reverted` + 오류 데이터 해독

**증상(원문)**
- docs `estimate-gas` `[Docs Only]`: `-32000` "시뮬레이션된 호출이 revert되었습니다(대상 컨트랙트의 throw, PCL 정책 거부 등)" (WebFetch 2026-09-02).
- 라이브 `[Live Testnet] (2026-09-02T07:53Z)` (curl, 더미 입력, value 1e18): `{"code":3,"message":"execution reverted: encrypted note is not a canonical deposit-note envelope: encrypted envelope is shorter than the 20-byte header: invalid request","data":"0x08c379a0…"}` — 코드가 `-32000` 이 아니라 `3` 이다(가이드 §5.1-⑥ 의 eth_call 관측과 같은 결).
- `cast estimate`: `Error: server returned an error response: error code 3: execution reverted: <문자열>, data: "0x…"`

**원인**: 두 부류다(docs privacy-policy-aware-precompile, WebFetch 2026-09-02: PCL 거부는 "typed PCL ReasonCode … ABI encoded", executor 실패는 "plain string revert").
- (a) 비-PCL 문자열 revert — `data` 가 `0x08c379a0`(`Error(string)`) 으로 시작. 입력 검증이 PCL 보다 먼저라 더미 입력은 여기서 끝난다(가이드 §4 C5). 2026-09-02T07:53Z 관측 순서: 커밋먼트 0 → `note commitment must be non-zero: invalid request`; 커밋먼트 있음·proof 없음 → `deposit proof is required: invalid request`; proof 있음·envelope 없음 → `encrypted note is not a canonical deposit-note envelope: … 20-byte header: invalid request`.
- (b) PCL 커스텀 오류 — `data` 가 아래 표의 selector 로 시작. `0x…0b` 에는 EAS_POLICY + DENYLIST_POLICY 가 걸려 있으므로(가이드 §4 A9) 정식 입력으로 미인증 sender 가 가면 EAS 계열이 예상된다(미실측).

**selector 표** (`cast sig` 로 2026-09-02 검증; 시그니처 원문은 docs pcl-reason-codes, WebFetch 2026-09-02)

| selector | 시그니처 | 부류 | 비고 |
|---|---|---|---|
| `0x08c379a0` | `Error(string)` | 비-PCL 문자열 | 문자열을 읽는다 |
| `0xbca5593e` | `EasNoAttestationReceived(address)` | PCL/EAS | 이 스키마로 attestation 을 받은 적 없음. EAS_POLICY 검사 순서 1번(docs pcl-template-eas-policy) |
| `0x1a152487` | `EasAttestationRequired(address)` | PCL/EAS | catch-all, 검사 순서 마지막 |
| `0x30d7cfd1` | `AnyOfRejected(bytes[])` | PCL/논리 | 자식 revert 배열을 감쌈 |
| `0x0201b218` | `InDenylist(address)` | PCL | denylist |
| `0x82b42900` | `Unauthorized()` | PCL/설정 | 훅 직접 호출 등 `[Live Testnet]` |
| `0x6a2b23be` | `PolicyTemplateNotFound(string)` | PCL/설정 | 항목 6 `[Live Testnet]` |
| `0xec8860d9` | `UnauthorizedMinter(address,address)` | OKRW | 비발행자 `mint` `[Live Testnet]` |

EAS_POLICY 실패 코드 순서 `[Docs Only]` (docs pcl-template-eas-policy): `EasNoAttestationReceived` → `EasAttestationRevoked` → `EasAttestationExpired` → `EasAttestationLookupFailed` → `EasAttestationRequired`(catch-all). "새 attestation이 온체인에 도달하면 동일 트랜잭션이 성공합니다".

**확인 방법**
```bash
DATA=0x<응답의 data>
echo ${DATA:0:10}
cast decode-error --sig "Error(string)" $DATA
cast decode-error --sig "EasNoAttestationReceived(address)" $DATA
cast decode-error --sig "EasAttestationRequired(address)" $DATA
cast decode-error --sig "AnyOfRejected(bytes[])" $DATA
```
`--sig` 없이 실행하면 openchain 조회를 시도하는데 이 selector 들은 등록돼 있지 않다(`cast 4byte 0xe6eb7771` → `No matching function signatures found`, 2026-09-02). 항상 `--sig` 를 준다.

**해결**
- (a) 문자열이면 입력을 고친다: 커밋먼트 비-0, proof 필수, envelope 는 20바이트 헤더 이상. 정식 입력 생성은 participant-guide Step 3 "입력 생성"(TODO(구현)).
- (b) EAS 계열이면 두 갈래: KYC(`https://kyc-testnet.maroo.io`, 카카오) 로 attestation 을 받아 분기 A, 또는 그 오류 원문·UTC·환경·재현 명령을 그대로 기록해 분기 B(과제 L365).
- 주의 `[Live Testnet] (타인 tx)`: 2026-09-02T07:52:40Z 의 온체인 거부 `0x3839c31d1b5625bd59b5251f6595b3e50ffb451aab93389fdbc488f30ee3899b` 은 `Error(string)`: `no EAS attestation received for sender (index returned empty): maroo1et9t9l3tytvtkjj6g32jwe23305vs37scfk7f3` 로 왔다(gas_used 1,750,000 / gas_limit 3,500,000, value 10 OKRW). EAS 미인증 거부가 (b) 가 아니라 (a) 형태로 온 표본이다. 같은 input 을 미인증 주소(`0x…dEaD`)로 `eth_call`/`eth_estimateGas` 재생해도 같은 문자열이 나와 SUBMISSION_NOTES **D-12** 로 등재했다(`../docs/testnet-reference.md` §4.3, §6.4 재확인 블록). 본인 주소 재현은 TODO(실측: `--from $ME` 재생 로그).

---

<a id="deposit-value-required"></a>
## 3. `privacy deposit value is required` — `msg.value` 가 0

**증상(원문)**: revert 문자열 `privacy deposit value is required` (docs contract-privacy-deposit 원문 "`msg.value`가 전달되지 않았을 때 일반 문자열로 revert됩니다. `deposit`은 `payable`이며 `aokrw` 단위의 양의 값이 필요합니다", en "Plain-string revert when the call carries no `msg.value`", WebFetch 2026-09-02; 가이드 §4 C1 `[Live Testnet] (05:18–05:42Z)`).

**원인**: `deposit` 은 payable 이고 금액은 struct 가 아니라 `msg.value` 로 전달된다(docs contract-privacy-deposit "예치 금액은 EVM의 `msg.value`로 전달합니다"). `--value` 를 빠뜨리거나 0 을 주면 이 문자열이 난다. 같은 페이지의 나머지 revert 3개: `privacy deposit actor must be the non-zero operator`, `privacy precompile only supports native denom`, `invalid fixed privacy deposit funder`.

**확인 방법**
```bash
cast estimate --rpc-url $RPC --from $ME --value 0 $PRIV "deposit((bytes,bytes,bytes))" "($NOTE,$ENC,$PROOF)"
```
주의: 2026-09-02T07:53Z 재확인에서는 더미 입력이면 항목 2-(a) 의 입력 검증 문자열이 **먼저** 나왔다(커밋먼트 0 + value 0 → `note commitment must be non-zero`; 커밋먼트 있음 + value 0 → `deposit proof is required`). 가이드 C1 은 같은 명령으로 `privacy deposit value is required` 를 봤다고 기록하므로 검사 순서가 입력·시점에 따라 다를 수 있다. 정식 입력 + `--value 0` 의 본인 재현은 TODO(실측). 단 attestation 있는 발신자의 value 0 deposit 이 라이브에서 **성공**한 표본(`0x83a1289ef6498763f838a8d07ae6690668b488f2ba633129b29acc1e78935aaa`, 2026-09-02T07:58:22Z, `amount "0atokrw"`)이 있어 docs 의 value 필수 검사는 강제되지 않는다(**D-13**, `../docs/testnet-reference.md` §4.2).

**해결**: `--value <금액>` 을 준다(단위 wei = atokrw; `1ether` = 1e18 atokrw = 1 OKRW, `cast to-wei 1 ether` → `1000000000000000000`). forge script 경로에서는 `IPrivacy(PRIV).deposit{value: 1 ether}(…)`, cast 경로에서는 `--value 1ether`. 참고로 Clairveil 64비트 상한(≈18.44 OKRW, `x/privacy/types/amount.go:8`) 이 Maroo 회로에도 적용되는지는 근거 없음(가이드 §5.3-⑥, §7) — 1 OKRW 로 시작한다.

---

<a id="faucet-limit"></a>
## 4. faucet 이 거부하거나 잔액이 0 (D-7)

**증상(원문)**: `cast balance --ether $ME` → `0`; faucet 페이지에서 요청이 거부됨(문구는 TODO(실측: 브라우저 화면)). `POST /api/sendToken` 을 스크립트로 호출하면 captcha 없이는 400(가이드 §5.5).

**원인** `[Live Testnet]` **D-7** (가이드 §5.5): 요청당 5,000 tOKRW · 10분당 5회 · 잔액 10,000 이상이면 거부 · RainbowKit 지갑 연결 + reCAPTCHA v3 필수 · 로그인 없음. docs testnet-access·getting-started 어디에도 faucet 한도 언급이 없다(testnet-access 원문 "파우셋에서 테스트 tOKRW를 수령합니다", getting-started 원문 "파우셋에서 테스트 OKRW를 받을 수 있습니다" / en "You can get test OKRW from the faucet.", WebFetch 2026-09-02; 가이드 §2.1-2 "파우셋은 '팁'으로만 언급, 한도 없음"). docs 예시 금액 1,500,000 OKRW(docs 의 ethers 예제 원문 `parseEther("1500000")`, 인용) 은 이 한도로 불가(가이드 §5.2-⑫).

**확인 방법**
```bash
cast balance --rpc-url $RPC --ether $ME
curl -s -m 10 -o /dev/null -w '%{http_code}\n' https://faucet.maroo.io/     # 200 (2026-09-02T07:54Z)
```
faucet URL 은 docs testnet-access(`https://faucet.maroo.io`; 페이지 제목 "Maroo Faucet - Get Test Tokens", 2026-09-02).

**해결**: (1) 10분 대기 후 재요청. (2) 진행자 백업 지갑에서 `cast send --value` 로 직접 보낸다(facilitator-guide P2; 명령은 participant-guide Step 1). (3) 잔액이 10,000 이상이라 거부되면 상한 규칙상 잔액을 낮추면 될 것으로 보이나 미실측 TODO(실측). 워크숍 필요량 산식은 facilitator-guide P2.

---

<a id="fee-gas"></a>
## 5. 수수료 부족·가스 — `insufficient funds …`, `intrinsic gas too low`, 포함 안 됨

**증상(원문)**
- `insufficient funds for gas * price + value: balance 0, tx cost 189000000000000001, overshot …` `[Live Testnet]` (가이드 §2.1-6)
- `intrinsic gas too low` (가이드 §4 Phase B-4)
- tx 가 pending 으로 남음 — maxFee 를 explorer 위젯(7,000 gwei 상당) 으로 잡은 경우(가이드 §5.1-⑦; Blockscout `stats.gas_prices` = 7,000 을 2026-09-02T07:52Z 재확인)
- 실패 tx 도 가스를 소모함 — 거부 표본 gas_used 1,750,000(항목 2), 구 selector 표본 1,250,000(항목 1)

**원인** `[Live Testnet]`: EIP-1559, baseFee 8e12 · priority 1e12 · `eth_gasPrice` 9e12 atokrw(가이드 §2.1-8, §4 A3; 2026-09-02T07:56Z `cast base-fee` → `8000000000000`, `cast gas-price` → `9000000000000`). 단순 전송 21,000 gas ≈ 0.189 OKRW(가이드 §2.1-8). deposit 은 성공 표본 gasUsed 2,239,761 ≈ 2.24M gas ≈ 20 OKRW(가이드 §4 Phase E-3; receipt `0xe492ae2c…0a70` 2026-09-02T07:54Z 재확인, `effectiveGasPrice` 9e12). base fee 는 소각(가이드 §2.1-8).

**확인 방법**
```bash
cast base-fee --rpc-url $RPC          # 8000000000000
cast gas-price --rpc-url $RPC         # 9000000000000
cast balance --rpc-url $RPC --ether $ME
cast estimate --rpc-url $RPC --from $ME --value 1ether $AUX     # 21000
```

**해결**: `cast send … --gas-price 9000000000000 --priority-gas-price 1000000000000` 로 max fee ≥ baseFee+priority 를 보장한다(`--gas-price` 는 EIP-1559 에서 max fee per gas, `cast send --help`). 전송 전 `cast estimate` 로 가스와 revert 를 먼저 본다(항목 2). Step 3 는 잔액 ≥ deposit 금액 + ≈20 OKRW 를 확보한다. 잔액이 없으면 항목 4.

---

<a id="policy-template-not-found"></a>
## 6. `PolicyTemplateNotFound(string)` — 템플릿 이름 오타

**증상(원문)** `[Live Testnet] (2026-09-02T07:52Z)`: `cast call … "policyTemplate(string)" NOPE_POLICY` → `Error: server returned an error response: error code 3: execution reverted, data: "0x6a2b23be0000…4e4f50455f504f4c494359…"`.

**원인**: 등록되지 않은 템플릿 이름을 조회하거나 정책에 넣었다. 라이브 오류명은 `PolicyTemplateNotFound(string)` `0x6a2b23be` 이고, docs `pcl-policy-templates`/`pcl-precompile-overview` 는 `InvalidPolicyTemplate` 라고 적어 페이지끼리 다르다(가이드 §5.1-⑪, §5.2-②). 라이브에 등록된 템플릿은 9개(7 leaf + 2 composite, 가이드 §2.3-10 `[Live Testnet]`); 2026-09-02T07:56Z `contractPolicies`/`globalPolicies` 출력에서 보인 이름은 `EAS_POLICY`, `DENYLIST_POLICY`, `VOLUME_POLICY`, `PERIODIC_VOLUME_POLICY`, `LOGICAL_POLICY`, `FOR_EACH_POLICY`. 전체 9개 이름은 TODO(실측: 각 이름을 `policyTemplate(string)` 로 조회).

**확인 방법**
```bash
cast call --rpc-url $RPC $PCL "policyTemplate(string)" EAS_POLICY        # 등록됨 → 데이터 반환
cast call --rpc-url $RPC $PCL "policyTemplate(string)" NOPE_POLICY       # → 0x6a2b23be…
cast decode-error --sig "PolicyTemplateNotFound(string)" 0x6a2b23be<…>   # → "NOPE_POLICY"
```

**해결**: 이름을 등록된 템플릿 이름으로 고친다. docs 의 `InvalidPolicyTemplate` 로 오류를 매칭하는 코드는 라이브에서 잡히지 않는다 — `PolicyTemplateNotFound(string)` 으로 매칭한다.

---

<a id="cosmos-rest-grpc"></a>
## 7. Cosmos REST(`:1317`)/gRPC(`:9090`)/`abci_info` 를 찾는데 없음

**증상(원문)** `[Live Testnet] (2026-09-02T07:52Z)`:
```
curl -s -X POST $RPC -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":7,"method":"abci_info","params":[]}'
{"jsonrpc":"2.0","id":7,"error":{"code":-32601,"message":"the method abci_info does not exist/is not available"}}
```
`/status` 는 404, `rpc_modules` 는 `debug/eth/net/rpc/txpool/web3` 뿐(리뷰 §2.1; 가이드 §4 A4). `clairveild tx privacy deposit 10uclair` 같은 명령은 테스트넷에 성립하지 않는다(리뷰 §2.1).

**원인**: Maroo 테스트넷이 외부에 노출하는 것은 EVM JSON-RPC 뿐이다. Clairveil 의 privacy 쿼리(`tree_state`, `commitment/{hex}`, `nullifier/{hex}`, `events`, `reserve/{denom}` 등 15개, `proto/clairveil/privacy/v1/query.proto:1-160` 의 `rpc` 15건, HEAD ca85b02; 가이드 §3.3-5 는 14개로 적었으나 파일이 정본) 는 테스트넷에 노출되지 않는다(가이드 §3.3-5, §7). Docs 의 Indexer 호스트 `api-testnet.maroo.io` 는 DNS 가 없다(**D-5**, 가이드 §5.1-⑤; `dig +short` 빈 응답 2026-09-02T07:52Z).

**확인 방법**
```bash
cast rpc --rpc-url $RPC rpc_modules
dig +short api-testnet.maroo.io            # (빈 응답)
curl -s "https://explorer-testnet.maroo.io/blockscout/api/v2/stats" | head -c 300   # 200
curl -s -o /dev/null -w '%{http_code}\n' https://explorer-testnet.maroo.io/api/v2/stats  # 404 (가이드 §5.1-⑩)
```

**해결**: 상태 확인은 receipt(`eth_getTransactionReceipt`)·로그(`eth_getLogs`, 상한 -32005 약 10,000건, 가이드 §2.1-11)·Blockscout `/blockscout/api/v2`(`/api/v2` 는 404) 로 한다. `IPrivacy` 에는 view 메서드가 없다(가이드 §2.2-1). Clairveil 로컬넷에서도 REST 는 기본 `enable=false` 다(Clairveil `README.md:93`, `docs/clairveil-getting-started.md`, 가이드 §3.2-1).

---

<a id="local-port-conflict"></a>
## 8. `[Local]` `make privacy-e2e-smoke` 포트 충돌

**증상(원문)**: `clairveild start` 를 켠 채 `make privacy-e2e-smoke` 를 돌리면 기본 포트에서 충돌한다. Clairveil `README.md:93`: "This target creates a separate temporary home and starts its own local node. If a `clairveild start` node is already using the active default RPC, P2P, or gRPC ports (`26657`, `26656`, or `9090`), stop that node first or use e2e port overrides. REST is disabled in the generated `app.toml`; its configured `1317` address binds only when the API is explicitly enabled." 실제 오류 문구는 이 머신 미실행이라 TODO(실측).

**원인**: `scripts/privacy-e2e-smoke.sh:10-15` 기본값 `RPC_PORT=26657 P2P_PORT=26656 ABCI_PORT=26658 GRPC_PORT=9090 API_PORT=1317 PPROF_PORT=6060` 이 실행 중 노드와 같다. 문서 `docs/clairveil-testing-guide.md:303` 은 4개만 적고 스크립트는 6개다(가이드 §5.4-①).

**확인 방법**
```bash
lsof -nP -iTCP:26657 -sTCP:LISTEN     # 누가 26657 을 쓰는지
grep -n "_port=" ../clairveil/scripts/privacy-e2e-smoke.sh | head -6   # L10-15 여섯 줄 (../clairveil = demo/README.md §3.1 의 clone 위치)
```

**해결** (가이드 §3.2-3; 리뷰 §2.2 L208-219)
```bash
RPC_PORT=27657 P2P_PORT=27656 GRPC_PORT=9190 API_PORT=1417 make privacy-e2e-smoke
KEEP_WORK_DIR=1 RPC_PORT=27657 P2P_PORT=27656 GRPC_PORT=9190 API_PORT=1417 make privacy-e2e-smoke   # 산출물 보존
```
또는 실행 중 노드를 먼저 내린다. 기대 종료 문자열은 `privacy e2e smoke passed`(`scripts/privacy-e2e-smoke.sh:413`). 기본 실행은 `trap cleanup EXIT`(L63) 로 흔적을 남기지 않으므로 증거가 필요하면 `KEEP_WORK_DIR=1`(L7).

---

<a id="fallback"></a>
## 라이브 장애 시 대체 진행

정본은 이 절이다. facilitator-guide 는 여기로 링크만 건다. 전환하면 그 시각(UTC)·판단 근거·명령 출력을 `evidence/` 와 SUBMISSION_NOTES Validation 에 남긴다(과제 L365-366).

### 전환 판단 기준

| 장애 | 확인 명령 | 정상 `[Live Testnet] (2026-09-02)` | 전환 조건 |
|---|---|---|---|
| RPC 무응답 | `curl -s -m 10 -X POST https://rpc-testnet.maroo.io -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'` | `{"jsonrpc":"2.0","id":1,"result":"0x6e0ff"}` | 10초 타임아웃 또는 non-2xx 가 1분 간격 3회 연속 → Step 1~3 를 `[Local]` 로 전환 |
| faucet 다운 | `curl -s -m 10 -o /dev/null -w '%{http_code}\n' https://faucet.maroo.io/` | `200` | non-200 → 전환이 아니라 진행자 백업 지갑에서 `cast send` 로 분배(항목 4). 백업도 바닥이면 `[Local]` |
| explorer 지연 | `curl -s -m 10 "https://explorer-testnet.maroo.io/blockscout/api/v2/stats"` 의 `average_block_time` · `curl -s -m 10 -o /dev/null -w '%{http_code}\n' https://explorer-testnet.maroo.io/tx/0xe492ae2ceebda2a9a48691e42aa9ac0a1df5d00d517fb31783216fc7d0770a70` | `1010.0`(ms) · `200` | explorer 만 느리면 전환하지 않는다 — success criteria 의 explorer 링크는 `cast receipt --json` 파일로 대신하고 링크는 사후 보완(TODO 표기). RPC 가 살아 있으면 `[Live Testnet]` 유지 |
| prover 장애(분기 A) | TODO(실측: proverd 기동 확인 명령) | — | 분기 B(estimateGas 거부) 로 내려간다. 라벨은 그대로 `[Live Testnet]` |

### `[Local]` 전환 절차 — Clairveil `make privacy-e2e-smoke`

이 머신은 `~/.clairveil` 이 없다(`make init` 미실행, 2026-09-02). 아래 소요 시간·메모리는 전부 TODO(실측: `time`, `/usr/bin/time -l`, 가이드 §4 Phase D). 자원 계획: 메모리 4 GiB 초과, 디스크 1 GiB 이상(`docs/clairveil-getting-started.md:40`).

```bash
cd ../clairveil && git rev-parse HEAD      # ca85b02708fdd75259d4d2ee2d671c21198cec69 (../clairveil = demo/README.md §3.1 의 clone 위치)
go version && node -v                                                     # go1.25.12 / v22.13.0 (이 머신)
make init                                  # ~/.clairveil 생성 + artifact 4회로 (소요 TODO(실측))
source ~/.clairveil/clairveil.env          # 가이드 §3.2-1
make privacy-e2e-smoke                     # 기대: 'privacy e2e smoke passed' (scripts/privacy-e2e-smoke.sh:413)
# 노드가 이미 떠 있으면 포트 오버라이드 (가이드 §3.2-3)
RPC_PORT=27657 P2P_PORT=27656 GRPC_PORT=9190 API_PORT=1417 make privacy-e2e-smoke
# 로그·산출물 보존 (각 tx JSON, *-report.json, reserve-uclair.json → 가이드 §4 Phase D)
KEEP_WORK_DIR=1 make privacy-e2e-smoke
```

클린 환경으로 돌리려면 임시 home: `tmp="$(mktemp -d)"; GOBIN="$tmp/bin" CLAIRVEIL_HOME="$tmp/home" make init` (`docs/clairveil-testing-guide.md:257-262`, 가이드 §3.2-5). 정리: `rm -rf "$tmp"`, 그리고 `~/.clairveil.backup-*` 디렉터리(개발 키 포함) 확인 후 삭제(가이드 §3.2-4, §8). `make clean` 은 루트 바이너리만 지운다(`Makefile:164`, 가이드 §3.2-2).

검증 범위 `[Local]`: deposit → private/public/recipient-encrypted transfer → 4 plane decode → direct/relayed withdraw → reserve invariant(가이드 §3.2-3). 체인은 `clairveil-local-1`, denom `uclair`, prefix `clairs`(가이드 §3.1-1). 첫 블록 전 privacy tx 는 `invalid height`(가이드 §3.1-2).

### `[Simulation]` 으로 강등되는 항목

| 워크숍 항목 | `[Local]` 대체 가능? | 강등 라벨 | 근거 |
|---|---|---|---|
| Step 1 OKRW 네이티브 전송 | 불가 — Clairveil 에 OKRW 없음(`grep -rniE "okrw"` 0건) | `[Docs Only]` (docs sending-okrw 레시피 낭독) | 가이드 §3.1-4 |
| Step 2 PCL 정책 읽기·거부 | 불가 — PCL/PolicyOperation 코드 0건 | `[Docs Only]` (가이드 §4 A9 값·§2.3-12 트리 슬라이드) | 가이드 §3.1-4, §5.3-① |
| Step 3 Privacy deposit | Privacy 코어만 — `uclair`, Cosmos Msg, 증명 필요(`tx.proto:39`) | `[Local]` (e2e-smoke 의 deposit 단계) | 가이드 §3.2-3, §3.3-1 |
| OKRW→PCL→Privacy **한 tx** 흐름 | 불가 — 래퍼는 비공개 Maroo 바이너리 | `[Simulation]`/`[Docs Only]` | 가이드 §5.3-①② |
| 노드 없이 1분 데모 | `make reference-payroll-demo` — proof·브로드캐스트 없음(`examples/reference-payroll/README.md:36`) | `[Simulation]` (이 머신 51s `[Local]` 실행 OK, 2026-09-02) | 가이드 §3.5-2 |

강등된 항목은 SUBMISSION_NOTES Known Limitations 에 "mock 또는 simulation 으로 처리한 부분" 으로 기록한다(과제 L226-228 영역).

### 참가자 안내 문구 (그대로 읽는다)

1. "지금 Maroo 테스트넷 RPC 가 응답하지 않아(확인 시각 UTC ___, 명령 `eth_chainId` 3회 실패) 남은 단계는 Clairveil 로컬넷으로 진행합니다. 이 로컬넷에는 EVM·OKRW·PCL 이 없어서 오늘 보는 것은 Privacy 모듈 코어뿐이며, 산출물 라벨은 `[Live Testnet]` 이 아니라 `[Local]`(실행) 또는 `[Simulation]`(체인·증명 없음) 입니다."
2. "OKRW 전송과 PCL 거부는 로컬에서 재현할 수 없으므로 문서와 오늘 오전 라이브 표본(tx `0xe492ae2c…0a70` 성공, `0x3839c31d…899b` 거부) 화면으로 대신하고 `[Docs Only]` 로 표시합니다."
3. "테스트넷이 복구되면 participant-guide Step 1~3 을 각자 다시 실행해 `[Live Testnet]` 증거를 채우고, 오늘 로컬 결과는 evidence 에 라벨을 붙여 함께 제출합니다. 실패 자체도 시각·환경·재현 절차와 함께 기록하면 유효한 증거입니다(과제 L365)."
