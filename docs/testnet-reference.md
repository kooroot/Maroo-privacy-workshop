# Maroo 테스트넷 레퍼런스 — 검증된 주소·selector·오류·정책 상태

이 문서는 워크숍 패키지 전체가 인용하는 **테스트넷 값의 단일 정본**이다. 모든 행은 `값 | 출처 | 라벨` 을 갖고, 각 절 끝에 그대로 복사해 실행할 수 있는 **재확인 명령** 블록을 둔다. 상태 변경 tx 는 이 문서의 어떤 명령도 보내지 않는다(전부 `eth_call` / `eth_estimateGas` / `eth_getCode` / Blockscout 읽기).

- 실측 시각: `[Live Testnet]` 값은 세 시각에 확인했다. ① 탐색 가이드 실측 2026-09-02 05:18–05:42 UTC(`../../maroo-exploration-guide.md` §0), ② 이 문서 작성 시 재실측 2026-09-02 07:52–08:01 UTC, ③ 검수 반영 재실측 2026-09-02 08:24–08:29 UTC(Blockscout 목록·`gas_prices`·value 0 deposit tx), ④ 교차 문서 검수 재실측 2026-09-02 08:38 UTC(D-12 `eth_call`·`eth_estimateGas` 재생, D-13 receipt, `0x…09` `eth_getCode`). 서로 다르면 행에 적었다.
- 실측 환경: macOS 26.5.2 (Darwin arm64), `cast 1.7.1` (foundry), `curl`, `python3`. Node v22.13.0 은 이 문서의 명령에 쓰지 않는다.
- 라벨은 과제가 권장한 네 가지만 쓴다(과제 L158): `[Live Testnet]` `[Local]` `[Simulation]` `[Docs Only]`.
- 출처 약어: **가이드** = `../../maroo-exploration-guide.md`, **리뷰** = `../../review-skeleton-and-track2.md`, **docs** = docs.maroo.io (2026-09-02 WebFetch, `/en/` 경로), **과제** = `../../Maroo_developer_relations.md`.
- 불일치 번호 `D-n` 은 `../SUBMISSION_NOTES.md` › Discrepancies 와 같은 번호를 쓴다(§8).
- `TODO(실측: …)` 는 출처가 없어 비워 둔 값이다. 값을 지어내지 않는다.

모든 재확인 블록은 다음 변수를 전제한다(변수 이름은 가이드 §4, 값은 `demo/.env` 에서 읽는다. 이 문서는 읽기 전용이라 지갑 없이도 된다).

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
export ME=0x<네 주소>   # 지갑이 있으면 cast wallet address --private-key "$PRIVATE_KEY"
alias rpc='curl -s -X POST $RPC -H "Content-Type: application/json" -d'
```

---

## 1. 네트워크

| 항목 | 값 | 출처 | 라벨 |
|---|---|---|---|
| chainId | `450815` (`0x6e0ff`) | docs `resources/network/testnet-access`; `eth_chainId` 응답 `0x6e0ff` (07:52 UTC) | `[Live Testnet]` |
| JSON-RPC | `https://rpc-testnet.maroo.io` | docs testnet-access; 위 응답을 이 호스트에서 받음 | `[Live Testnet]` |
| WebSocket | `wss://ws-testnet.maroo.io` | docs testnet-access. `dig +short ws-testnet.maroo.io` → `ws-testnet.maroo.io.cdn.cloudflare.net.` (DNS 만 확인). WS 프레임 교환은 미검증 → TODO(실측: `wscat -c wss://ws-testnet.maroo.io` 로 `eth_chainId`) | `[Docs Only]` |
| Explorer | `https://explorer-testnet.maroo.io` | docs testnet-access; `/tx/<hash>` 가 HTTP 200 (§6 표본 2건) | `[Live Testnet]` |
| Blockscout API base | `https://explorer-testnet.maroo.io/blockscout/api/v2` | docs testnet-access "Indexer API"; `curl -sI $EXPL/stats` → 200, `https://explorer-testnet.maroo.io/api/v2/stats` → 404 (가이드 §5.1-⑩) | `[Live Testnet]` (D-8) |
| Faucet | `https://faucet.maroo.io` | docs testnet-access; HTTP 200. 한도·캡차 규칙은 §7 (D-7) | `[Live Testnet]` |
| KYC (mock) | `https://kyc-testnet.maroo.io` | docs testnet-access "KYC (mock)"; HTTP 200. 실제 절차는 카카오 본인인증(가이드 §2.4-4, §5.1-⑨) | `[Live Testnet]` |
| `api-testnet.maroo.io` | DNS 없음(`dig +short` 빈 응답) | 가이드 §2.1-1, §5.1-⑤ (docs testnet-access 에 등장). 2026-09-02 `/en/` 페이지 WebFetch 요약에는 이 호스트가 보이지 않음 → TODO(실측: ko 페이지 또는 원문 HTML 에서 문자열 위치 확인) | `[Live Testnet]` (D-5) |
| `rpc_modules` | `debug` `eth` `net` `rpc` `txpool` `web3` (모두 `1.0`) | `rpc_modules` 응답 (07:52 UTC); 가이드 §4 A4 동일 | `[Live Testnet]` |
| Cosmos RPC/REST/gRPC (같은 호스트) | 미노출: `GET /status` → 404, `abci_info` → `-32601 the method abci_info does not exist/is not available`, `GET /cosmos/base/tendermint/v1beta1/node_info` → 404, `GET /clairveil/privacy/v1/tree_state` → 404 | 07:5x UTC 실측; 리뷰 §2.1(1) 동일. 다른 호스트·포트(1317/9090/26657) 노출 여부는 TODO(실측: 1317/9090/26657 포트나 별도 호스트 노출 여부 — docs 에 항목 없음) | `[Live Testnet]` |
| 통화 | 표기 `tOKRW`, 18 decimals. base unit: docs `aokrw` / 실측 `atokrw` | docs testnet-access; `IOkrw.getParams().mintDenom` (§6) | `[Live Testnet]` (D-1) |
| baseFeePerGas | `0x746a5288000` = 8,000,000,000,000 atokrw (8e12) | `eth_feeHistory ["0x4","latest",[25,50,75]]` (07:52 UTC); 가이드 §2.1-8 | `[Live Testnet]` |
| `eth_gasPrice` | `0x82f79cd9000` = 9,000,000,000,000 (9e12) | `eth_gasPrice` (07:52 UTC); 가이드 §4 A3 | `[Live Testnet]` |
| priority fee | 1e12 (`0xe8d4a51000`) — 성공 deposit 표본 tx 의 `maxPriorityFeePerGas`. `eth_feeHistory.reward` 는 빈 블록이라 전부 `0x0` | `eth_getTransactionByHash` 표본 (§6); 가이드 §2.1-8 | `[Live Testnet]` |
| 단순 전송 수수료 | ≈ 0.189 OKRW (21,000 gas × 9e12) | 가이드 §2.1-8 계산값. 실제 receipt 는 Step 1 실행 후 기록 → TODO(실측: 네이티브 전송 receipt `effectiveGasPrice × gasUsed`) | `[Live Testnet]` (계산) |
| 평균 블록 시간 | 1,010 ms (`average_block_time`) | `curl -s $EXPL/stats` (07:52 UTC); 가이드 A11 ≈1.02 s | `[Live Testnet]` |
| Blockscout 가스 위젯 | `gas_prices` slow/average/fast 모두 `7000` (gwei 상당) — RPC baseFee 8,000·gasPrice 9,000 gwei 상당보다 낮으므로 위젯 값으로 수수료를 잡으면 baseFee 미달 | `curl -s $EXPL/stats` (08:24 UTC, 응답 `gas_price_updated_at` `2026-09-02T08:23:54Z` — 값은 주기적으로 갱신됨); 가이드 §5.1-⑦ 동일 | `[Live Testnet]` |
| 최신 블록 (참고) | `0x104e385` = 17,097,605 | `eth_blockNumber` (07:52 UTC) | `[Live Testnet]` |

재확인 명령:

```bash
rpc '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
rpc '{"jsonrpc":"2.0","id":1,"method":"rpc_modules","params":[]}'
rpc '{"jsonrpc":"2.0","id":1,"method":"eth_gasPrice","params":[]}'
rpc '{"jsonrpc":"2.0","id":1,"method":"eth_feeHistory","params":["0x4","latest",[25,50,75]]}'
rpc '{"jsonrpc":"2.0","id":1,"method":"eth_getBalance","params":["'$ME'","latest"]}'
cast chain-id --rpc-url $RPC            # 450815
cast rpc --rpc-url $RPC eth_chainId     # "0x6e0ff"
curl -sI $EXPL/stats | head -1          # HTTP/2 200
curl -sI https://explorer-testnet.maroo.io/api/v2/stats | head -1   # HTTP/2 404
dig +short api-testnet.maroo.io         # (빈 출력)
curl -s -o /dev/null -w '%{http_code}\n' $RPC/status                # 404
rpc '{"jsonrpc":"2.0","id":1,"method":"abci_info","params":[]}'     # -32601
```

---

## 2. 고정 주소

| 이름 | 주소 | 출처 | 라벨 |
|---|---|---|---|
| IOkrw 프리컴파일 | `0x1000000000000000000000000000000000000001` | docs `resources/contracts/deployed-contracts`; `getParams()` 응답 (§6) | `[Live Testnet]` |
| IPcl 프리컴파일 | `0x1000000000000000000000000000000000000005` | docs deployed-contracts; `policyAdmin()`·`contractPolicies()` 응답 (§6) | `[Live Testnet]` |
| IEas 프리컴파일 | `0x1000000000000000000000000000000000000009` | docs deployed-contracts, `concepts/identity/eas-precompile-overview`; `getParams()` 응답 (§6) | `[Live Testnet]` |
| IAgent 프리컴파일 | `0x100000000000000000000000000000000000000A` | docs deployed-contracts. 이 문서에서는 메서드를 호출하지 않음 → TODO(실측: IAgent 메서드 1개 `eth_call`) | `[Docs Only]` |
| IPrivacy 프리컴파일 | `0x100000000000000000000000000000000000000b` | docs `concepts/privacy/privacy-precompile-overview`; `deposit` 호출 응답·`PrivacyDeposit` 이벤트 (§5, §6). deployed-contracts 의 "four precompile" 목록에는 없음 | `[Live Testnet]` (D-4) |
| EAS SchemaRegistry | `0x1000000000000000000000000000000000000006` | `IEas.getParams()` 1번째 필드; `eth_getCode` → `0x6080…` (컨트랙트 코드 있음). docs 어디에도 주소 문자열 없음(가이드 §2.4-1) | `[Live Testnet]` |
| EAS | `0x1000000000000000000000000000000000000007` | `IEas.getParams()` 2번째; `eth_getCode` → `0x6080…`. `contractPolicies(0x…0b)` 의 EAS_POLICY 설정에도 이 주소 | `[Live Testnet]` |
| EAS Indexer | `0x1000000000000000000000000000000000000008` | `IEas.getParams()` 3번째; `eth_getCode` → `0x6080…` | `[Live Testnet]` |
| ERC-8004 IdentityRegistry | `0x8004000000000000000000000000000000000001` | docs deployed-contracts "IdentityRegistry preinstall"; `eth_getCode` → `0x6040…` (코드 있음). 인터페이스가 docs 스니펫과 다르다는 가이드 §5.1-⑧ 은 재검증 안 함 → TODO(실측: `cast interface` 또는 Blockscout ABI 비교) | `[Live Testnet]` (주소만) |
| OKRW ERC20 표현 | `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` | docs deployed-contracts, `concepts/core/okrw-precompile-overview` ("Standard ERC20 ABIs work against it unchanged"); `eth_getCode` → `0x` | `[Live Testnet]` (D-2) |
| OKRW minter | `0x83cBceF68d5989a30795Ce63C9617Aa93016f63F` | `IOkrw.getParams().minter` (07:5x UTC); 가이드 A5 | `[Live Testnet]` |
| PCL policyAdmin | `0x58eC1E718ff15e5f34591747D47ADf5BccDA804F` | `IPcl.policyAdmin()` (07:5x UTC); docs `concepts/compliance/pcl-policy-admin` ("Read it on-chain via `IPcl.policyAdmin()`"); 가이드 §2.3-2 | `[Live Testnet]` |
| KYC attester | `0xBfa4d8140b4104cA0Dd8c4E4b8cA420D551c0aE3` | 가이드 §2.4-4 (kyc-testnet 브라우저 관측). 이 문서에서는 재확인 안 함 → TODO(실측: attestation UID 확보 후 `EAS.getAttestation(uid).attester`) | `[Live Testnet]` (가이드 인용) |
| EAS_POLICY schemaUid (0x…0b 에 바인딩) | `0x3e448d939524a8f3e6a403502e57ce60ee10146292114a58f4bfd1b1d35f527d` | `contractPolicies(0x…0b)` raw 응답 (07:5x UTC); 스키마 문자열 "bytes32 kakaoIdHash, uint8 version" 은 가이드 §2.3-7 | `[Live Testnet]` |

참고: 프리컴파일 5개(`0x…01` `0x…05` `0x…09` `0x…0A` `0x…0b`)는 `eth_getCode` 가 `0x` 이지만(`0x…09` 는 08:38 UTC 확인) `eth_call` 은 정상 응답한다(§6). "코드 없음 = 호출 불가" 가 아니다. 반면 `0xEeee…` 는 코드도 없고 모든 view 호출도 `0x` 다(가이드 A7).

재확인 명령:

```bash
cast call --rpc-url $RPC 0x1000000000000000000000000000000000000001 "getParams()((address,string))"
#   (0x83cBceF68d5989a30795Ce63C9617Aa93016f63F, "atokrw")
cast call --rpc-url $RPC 0x1000000000000000000000000000000000000009 "getParams()((address,address,address))"
#   (0x…06, 0x…07, 0x…08)
cast call --rpc-url $RPC 0x1000000000000000000000000000000000000005 "policyAdmin()"
#   0x…58ec1e718ff15e5f34591747d47adf5bccda804f
for a in 0x1000000000000000000000000000000000000001 0x1000000000000000000000000000000000000005 \
         0x1000000000000000000000000000000000000009 0x100000000000000000000000000000000000000A 0x100000000000000000000000000000000000000b \
         0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE; do printf '%s ' $a; cast code --rpc-url $RPC $a; done   # 전부 0x
for a in 0x1000000000000000000000000000000000000006 0x1000000000000000000000000000000000000007 \
         0x1000000000000000000000000000000000000008 0x8004000000000000000000000000000000000001; do
  printf '%s ' $a; cast code --rpc-url $RPC $a | head -c 12; echo; done                                  # 0x6080…/0x6040…
```

주의(cast 1.7.1): 가이드 A5 의 `"getParams()(address,string)"` 형태는 이 버전에서 `could not decode output` 으로 실패한다. 반환값이 struct(tuple) 이므로 위처럼 `((address,string))` 로 써야 디코드된다. 값 자체는 가이드와 동일.

---

## 3. 함수 selector

selector 는 전부 `cast sig "<시그니처>"` 로 계산했고, `[Live Testnet]` 행은 그 selector 로 실제 응답(정상 또는 해당 오류)을 받은 것이다.

| 함수 | selector | 대상 | 근거 | 라벨 |
|---|---|---|---|---|
| `deposit((bytes,bytes,bytes))` — `deposit(PrivacyDepositRequest)` payable, struct `{bytes noteCommitment; bytes encryptedNote; bytes proof}` | `0xe6eb7771` | `0x…0b` | docs `apis/contract/contract-privacy-deposit`; 성공 표본 tx input 첫 4바이트 = `0xe6eb7771` (§6); `eth_call` 로 입력 검증 문자열 수신 (§4.3) | `[Live Testnet]` (D-3) |
| `deposit((string,bytes,bytes))` — 구 시그니처 (Clairveil dApp 번들) | `0x68a36263` | `0x…0b` | `eth_call` → `no method with id: 0x68a36263`; 2026-08-26 이 selector 로 보낸 tx 2건 revert (§6); 가이드 §5.1-③, C2 | `[Live Testnet]` (D-3) |
| `getParams()` | `0x5e615a6b` | `0x…01` (→ `(address minter, string mintDenom)`), `0x…09` (→ `(schemaRegistry, eas, indexer)`) | docs `apis/contract/contract-okrw-get-params`, eas-precompile-overview; §2 응답 | `[Live Testnet]` |
| `policyTemplate(string)` | `0x9f35259d` | `0x…05` | docs `apis/contract/pcl-get-policy-template` ("Reverts with the typed `PolicyTemplateNotFound(string templateId)`"); 9개 이름 정상 응답, `NOPE_POLICY` → `0x6a2b23be…` (§6) | `[Live Testnet]` |
| `contractPolicies(address)` | `0xd24d98d8` | `0x…05` | 가이드 A9; `0x…0b` 입력 시 EAS_POLICY + DENYLIST_POLICY 응답 (§6) | `[Live Testnet]` |
| `pclProxy(address)` | `0x777b5e8f` | `0x…05` | docs `guides/integration/simulating-pcl-checks` ("every field is zero when the address is not a registered PCL proxy"); `0x…0b` 입력 시 전부 0 (§6) | `[Live Testnet]` |
| `deployPclProxy(uint8,uint256,bytes)` — docs 원문 `deployPclProxy(PclProxyKind kind, uint256 value, bytes initData) returns (address proxy)` (enum → uint8) | `0x7a409ccd` | `0x…05` | docs `apis/contract/contract-pcl-deploy-pcl-proxy`. selector 는 계산값이며 라이브 호출은 상태 변경이라 하지 않음 | `[Docs Only]` (D-6) |
| `preCall(address,address,bytes,uint256)` — docs 원문 `IPcl.preCall(target, principal, data, value)` | `0x43d1bbb2` | `0x…05` | docs `concepts/compliance/pcl-policy-enforcement`; 직접 호출 시 `0x82b42900` = `Unauthorized()` (가이드 C6, 07:5x UTC 재현) | `[Live Testnet]` (D-6) |
| `globalPolicies()` (가이드 외, 본 문서 실측) | `0x9af4d161` | `0x…05` | docs `concepts/compliance/pcl-precompile-overview` 메서드 목록; 3,776 바이트 응답 (§6) | `[Live Testnet]` |
| `policyAdmin()` (가이드 외) | `0x58e51896` | `0x…05` | docs pcl-policy-admin; §2 응답 | `[Live Testnet]` |
| `mint(address,uint256)` | `0x40c10f19` | `0x…01` | docs okrw-precompile-overview ("Only the configured authorized minter"); 비발행자 호출 → `0xec8860d9…` (§4) | `[Live Testnet]` |
| `policyTemplates()` — **존재하지 않음** | `0x9a058f57` | `0x…05` | 본 문서 작성 중 추측 호출 → `no method with id: 0x9a058f57`. docs 메서드 목록에도 없음. 쓰지 말 것 | `[Live Testnet]` (부재 확인) |

`transfer` / `withdraw` / `*WithAuthorization` / `batchTransfer` / `singleProofBatchTransfer` 의 selector 는 struct 필드 순서를 `@maroo-chain/contracts@0.0.8` 패키지의 `precompiles/privacy/IPrivacy.sol`(`bun add @maroo-chain/contracts@0.0.8` 로 설치; 조회는 `bun info @maroo-chain/contracts@0.0.8`) 에서 확인해야 계산할 수 있다(가이드 §2.2-8) → TODO(실측: `bun add` 로 받은 `precompiles/privacy/IPrivacy.sol` 의 struct 순서로 `cast sig`).

재확인 명령:

```bash
cast sig "deposit((bytes,bytes,bytes))"          # 0xe6eb7771
cast sig "deposit((string,bytes,bytes))"         # 0x68a36263
cast sig "getParams()"                           # 0x5e615a6b
cast sig "policyTemplate(string)"                # 0x9f35259d
cast sig "contractPolicies(address)"             # 0xd24d98d8
cast sig "pclProxy(address)"                     # 0x777b5e8f
cast sig "deployPclProxy(uint8,uint256,bytes)"   # 0x7a409ccd
cast sig "preCall(address,address,bytes,uint256)" # 0x43d1bbb2
cast sig "globalPolicies()"                      # 0x9af4d161
# 라이브 응답
cast call --rpc-url $RPC 0x1000000000000000000000000000000000000005 "contractPolicies(address)" 0x100000000000000000000000000000000000000b
cast call --rpc-url $RPC 0x1000000000000000000000000000000000000005 "pclProxy(address)" 0x100000000000000000000000000000000000000b   # 0x000…000
cast call --rpc-url $RPC --from $ME 0x100000000000000000000000000000000000000b 0x68a36263   # no method with id: 0x68a36263
```

---

## 4. 오류 selector · 문자열

### 4.1 커스텀 오류 (ABI 인코딩, 첫 4바이트 = selector)

시그니처 원문은 docs `concepts/compliance/pcl-reason-codes` (PCL), `guides/integration/handling-okrw-errors` (IOkrw). selector 는 `cast sig` 계산값.

| 오류 | selector | 어디서 | 근거 | 라벨 |
|---|---|---|---|---|
| `PolicyTemplateNotFound(string templateId)` | `0x6a2b23be` | `IPcl.policyTemplate` 미등록 id | `eth_call` 응답 `0x6a2b23be…"NOPE_POLICY"` (07:5x UTC); 가이드 A8 | `[Live Testnet]` |
| `Unauthorized()` | `0x82b42900` | `IPcl.preCall` 직접 호출, 관리자 전용 메서드 | `eth_call` 응답 `0x82b42900` (07:5x UTC); 가이드 C6 | `[Live Testnet]` |
| `UnauthorizedMinter(address caller, address authorizedMinter)` | `0xec8860d9` | `IOkrw.mint` 비발행자 | `eth_call` 응답 `0xec8860d9 + caller + 0x83cb…f63f` (07:5x UTC); 가이드 A6 | `[Live Testnet]` |
| `EasNoAttestationReceived(address sender)` | `0xbca5593e` | EAS_POLICY 1순위 코드 ("no attestation has ever been received") | docs `pcl-template-eas-policy`. **라이브에서는 이 selector 대신 문자열 revert 가 왔다(§4.2, D-12)** | `[Docs Only]` |
| `EasAttestationRequired(address sender)` | `0x1a152487` | EAS_POLICY 최종 fallback | docs pcl-template-eas-policy, privacy-policy-aware-precompile | `[Docs Only]` |
| `EasAttestationRevoked(address sender)` | `0x906ffd43` | EAS_POLICY 2순위 | docs pcl-template-eas-policy | `[Docs Only]` |
| `EasAttestationExpired(address sender)` | `0xf0ee3ab6` | EAS_POLICY 3순위 | docs pcl-template-eas-policy | `[Docs Only]` |
| `EasAttestationLookupFailed(address sender)` | `0xb2b14096` | EAS_POLICY 4순위 | docs pcl-template-eas-policy | `[Docs Only]` |
| `InDenylist(address sender)` | `0x0201b218` | DENYLIST_POLICY | docs `pcl-template-denylist-policy`, pcl-reason-codes; 가이드 C7 | `[Docs Only]` |
| `AnyOfRejected(bytes[] childReverts)` | `0x30d7cfd1` | LOGICAL_POLICY(Or) 전부 실패 | docs pcl-reason-codes; 가이드 §6-⑥ | `[Docs Only]` |
| `ExceededPeriodicVolume(uint256 maxLimit, uint256 value, uint256 resetAt)` | `0x37ff087b` | PERIODIC_VOLUME_POLICY | docs pcl-reason-codes | `[Docs Only]` |
| `ReachedLimitOfNonEAS(uint256 maxLimit, uint256 value)` | `0xc755bafa` | OKRW_EAS_TRANSFER_LIMIT_POLICY | docs pcl-reason-codes (가이드 §5.2-③: 다른 페이지는 `ExceededAgentTransferLimit`) | `[Docs Only]` |
| `InvalidPolicyTemplate(string input)` | `0xafcf4698` | docs pcl-policy-templates 가 미등록 템플릿 오류로 서술 — 라이브는 `PolicyTemplateNotFound` | docs pcl-reason-codes; 가이드 §5.1-⑪, §5.2-② | `[Docs Only]` (D-11) |
| `Error(string)` | `0x08c379a0` | 모든 문자열 revert 의 래퍼 | Solidity 표준; §4.2 의 모든 문자열이 이 selector 로 옴 | `[Live Testnet]` |
| `AlreadyExists()` | `0x23369fa6` | EAS SchemaRegistry 에 이미 등록된 스키마 재등록 | 가이드 §5.2-⑨ (`eth_call`) | `[Live Testnet]` (가이드 인용) |

### 4.2 문자열 revert (Error(string) 안의 문자열 원문)

| 문자열 | 어디서 | 근거 | 라벨 |
|---|---|---|---|
| `no method with id: 0x68a36263` | `0x…0b` 에 구 selector 전송 | `eth_call` (07:5x UTC); 가이드 C2 | `[Live Testnet]` (D-3) |
| `no method with id: 0x9a058f57` | `0x…05` 에 존재하지 않는 selector | `eth_call` (07:5x UTC) | `[Live Testnet]` |
| `note commitment must be non-zero: invalid request` | `deposit` — `noteCommitment` 가 32바이트 0 | `eth_call` (07:5x UTC). docs 미기재 | `[Live Testnet]` (D-9) |
| `deposit proof is required: invalid request` | `deposit` — `proof` 비어 있음 | `eth_call` (07:5x UTC). docs 미기재 | `[Live Testnet]` (D-9) |
| `encrypted note is not a canonical deposit-note envelope: encrypted envelope is shorter than the 20-byte header: invalid request` | `deposit` — `encryptedNote` 20바이트 미만 | `eth_call` (07:5x UTC). docs 미기재 | `[Live Testnet]` (D-9) |
| `no EAS attestation received for sender (index returned empty): maroo1<bech32(from)>` | `deposit` — 형식 검증을 통과한 입력, 발신자에 EAS attestation 없음 | 채굴된 tx `0x3839c31d…899b` (status 0x0) 의 Blockscout `revert_reason`; 같은 input 을 `eth_call` 로 재생 (§6.4). docs 는 typed `EasNoAttestationReceived(sender)` 로 서술 | `[Live Testnet]` (D-12) |
| `deposit proof verification failed; the proof, amount, asset, or commitment may not match: pairing doesn't match: invalid request` | `deposit` — attestation 있는 발신자, `msg.value` 가 proof 에 묶인 금액과 다름 | `eth_call` (07:5x UTC, §6.4 (b)) | `[Live Testnet]` |
| `note commitment already exists: invalid request` | `deposit` — 이미 트리에 들어간 commitment 재사용 | `eth_call` (07:5x UTC, §6.4 (5)) | `[Live Testnet]` |
| `privacy deposit value is required` | `deposit` — docs 는 `msg.value == 0` 이면 이 문자열로 revert 한다고 서술 | docs contract-privacy-deposit; 가이드 C1 은 05:xx UTC `[Live Testnet]` 으로 기록. 07:5x UTC 더미 입력 재실행에서는 `note commitment must be non-zero` 가 먼저 나와 재현 못 함(D-9). **반대로 attestation 있는 발신자가 value 0 으로 보낸 deposit 이 라이브에서 성공했다**: tx `0x83a1289ef6498763f838a8d07ae6690668b488f2ba633129b29acc1e78935aaa` — block 17,097,995, 2026-09-02T07:58:22Z, from `0x5164fcc0BAE866A669eF01F831493848112F44F8`, selector `0xe6eb7771`, value `0x0`, `status 0x1`, gasUsed 2,233,231 (gas limit 2,680,407), `PrivacyDeposit.amount = "0atokrw"` (`cast tx`/`cast receipt` 08:24 UTC, explorer `/tx/` 200). 즉 docs 의 value 필수 검사는 라이브에서 강제되지 않는다 | `[Live Testnet]` (D-13) |
| `privacy deposit actor must be the non-zero operator` / `privacy precompile only supports native denom` / `invalid fixed privacy deposit funder` | `deposit` 나머지 3개 | docs contract-privacy-deposit. 라이브 미관측 | `[Docs Only]` |
| `expiresAtUnix is required` | `transfer` — `expiresAtUnix == 0` ("String revert (not a typed custom error)") | docs `apis/contract/contract-privacy-transfer`; 가이드 C3 미확인 → TODO(실측: 17필드 struct 인코딩 후 `eth_call`) | `[Docs Only]` |
| `expiresAtUnix overflows int64` / `transfer payload has expired` | `transfer` | docs contract-privacy-transfer | `[Docs Only]` |
| `insufficient funds for gas * price + value: balance 0, tx cost 189000000000000001, overshot …` | 브로드캐스트 (`eth_sendRawTransaction`) | 가이드 §2.1-6 `[Live Testnet]` | `[Live Testnet]` (가이드 인용) |
| `incorrect chain-id; expected 450815, got 1` (code `-32000`; docs 는 `-32602 Invalid signature`) | 브로드캐스트 | 가이드 §2.1-6, §5.1-⑥ | `[Live Testnet]` (가이드 인용, D-10) |
| `intrinsic gas too low` | 브로드캐스트 | 가이드 §4 Phase B "알려진 문자열" (라벨 없음) → TODO(실측: `eth_estimateGas` 값보다 낮은 gas 로 전송했을 때의 브로드캐스트 오류 원문) | `[Docs Only]` |
| `-32000 execution reverted` (estimateGas) / `code 3 execution reverted` (eth_call) | RPC 오류 코드 | docs `apis/rpc/estimate-gas` (-32000, "The error data carries the original revert reason"); 실측 `eth_call`·`eth_estimateGas` 모두 `"code":3` (07:5x UTC; 가이드 §5.1-⑥) | `[Live Testnet]` (D-10) |

### 4.3 deposit 검사 순서 (실측)

같은 `from` 에 대해 입력을 바꿔가며 `eth_call` 한 결과. 위에서부터 먼저 걸리는 순서다. `from` 은 `0x000000000000000000000000000000000000dEaD` (잔액 0, attestation 없음) 과, 성공 deposit 이력이 있는 `0x5164fcc0BAE866A669eF01F831493848112F44F8` (attestation 있음으로 추정 — 그 지갑의 deposit 이 성공했다는 사실만 확인) 을 썼다. `[Live Testnet]` 2026-09-02 07:55–07:58 UTC (#1–#7), 08:27 UTC (#8–#9).

| # | 입력 | 결과 |
|---|---|---|
| 1 | commitment 32바이트 0, 나머지 아무거나, value 0/1 ether | `note commitment must be non-zero` |
| 2 | commitment ≠ 0, proof 빈 bytes, value 0/1 ether | `deposit proof is required` |
| 3 | commitment ≠ 0, proof 164바이트 0, encryptedNote 빈 bytes | `encrypted note is not a canonical deposit-note envelope: … 20-byte header` |
| 4 | 형식 통과 입력(관측 tx `0x3839…` 의 calldata), from = attestation 없음, **value 0 이든 10 ether 든** | `no EAS attestation received for sender (index returned empty): maroo1…` — PCL 이 value 검사보다 먼저 |
| 5 | 같은 calldata, from = `0x5164…`(attestation 있음), value 0 | `deposit proof verification failed … pairing doesn't match` — proof 가 금액에 묶여 있음 |
| 6 | 같은 calldata, from = `0x5164…`, value 10 ether(=proof 금액) | `eth_call` 결과 `0x…01` (성공 시뮬레이션). 즉 관측 tx `0x3839…` 는 **proof 는 유효했고 EAS 만 막았다** |
| 7 | 성공 tx `0xe492…` 의 calldata, from = `0x5164…`, value 10 ether | `note commitment already exists` |
| 8 | value 0 성공 tx `0x83a1…`(§4.2 D-13, §6.4) 의 calldata(필드 길이 32/398/164), from = `0x5164…`, **value 0 이든 10 ether 든** | `note commitment already exists` — value 가 proof 금액과 달라도 이 문자열이므로 **중복 검사가 proof 검사보다 먼저**다 |
| 9 | 같은 calldata, from = `0x…dEaD`, value 0 | `no EAS attestation received … maroo1qqqq…ph4d4lmh8z` — PCL 이 중복 검사보다 먼저 |

`privacy deposit value is required` 는 미관측이다. 대신 "attestation 있음 + 새 commitment + value 0" 조합은 실제 tx 로 **성공**했다(`0x83a1…`, `amount "0atokrw"`, §4.2 D-13). #5 대로 value ≠ proof 금액이면 pairing 오류가 나므로 그 tx 의 proof 는 금액 0 에 묶인 것으로 추정한다(proof 생성 수단이 없어 직접 재현은 못 함 → TODO(실측: 게이트 ⑥ 이후 금액 0 proof 로 재현)).

워크숍 함의(사실만): (a) 형식 검증 → PCL(EAS) → commitment 중복 → proof 검증 순서다(#1–#4, #9, #8, #5). 07:5x 실측(#7)만으로는 proof 와 중복의 선후를 가릴 수 없었고(value 가 proof 금액과 같았음), 08:27 UTC #8 로 확정했다. (b) attestation 없는 지갑은 **proof 를 만들지 않아도** 관측 tx 의 calldata 를 `eth_call`/`eth_estimateGas` 에 `from=$ME` 로 넣으면 EAS 거부 문자열을 결정적으로 재현할 수 있다(Step 2 거부 재현). (c) 실제 tx 로 보내면 `0x3839…` 처럼 채굴 후 `status 0x0`, gasUsed 1,750,000 (gas limit 3,500,000 의 50%) 이 된다 — 브로드캐스트 필터가 아니라 채굴 후 revert 다. (d) docs 의 `msg.value` 필수(`privacy deposit value is required`)는 라이브에서 강제되지 않는다(D-13). 따라서 워크숍 Step 3 의 "`msg.value` 필수" 전제(참가자 가이드·`demo/README.md` 단계표)는 재검토 대상이다 — 다만 OKRW 를 실제로 잠그려면 value 를 넣어야 한다는 점("The deposit amount is derived from `msg.value`", docs privacy-precompile-overview)과 `amount` 가 `msg.value` 그대로 공개된다는 점은 그대로다.

### 4.4 해독 방법 (cast 1.7.1 에서 `--help` 로 확인한 하위 명령만)

```bash
# ① 문자열 revert / openchain 에 등록된 오류: 시그니처 없이
cast decode-error 0x08c379a0…            # → Error(string) "note commitment must be non-zero: invalid request"
cast decode-error 0x82b42900             # → Unauthorized()
# ② PCL·IOkrw 커스텀 오류: 시그니처를 직접 지정 (openchain 에 없을 수 있음)
cast decode-error --sig "UnauthorizedMinter(address,address)" 0xec8860d9…
cast decode-error --sig "PolicyTemplateNotFound(string)" 0x6a2b23be…      # → "NOPE_POLICY"
cast decode-error --sig "EasNoAttestationReceived(address)" 0xbca5593e…
# ③ selector 만 비교: revert data 앞 4바이트(10글자) 와 cast sig 결과 대조
cast sig "EasAttestationRequired(address)"   # 0x1a152487
# ④ calldata 디코드 (deposit 입력 3필드 길이 확인)
cast decode-calldata "deposit((bytes,bytes,bytes))" <tx input hex>
# ⑤ selector → 시그니처 역조회는 openchain 의존: 0xe6eb7771 은 미등록 ("No matching function signatures found")
cast 4byte 0xe6eb7771
# ⑥ struct 반환값(contractPolicies/globalPolicies)은 cast 가 raw hex 만 출력 → 문자열만 뽑기
cast call --rpc-url $RPC 0x1000000000000000000000000000000000000005 "globalPolicies()" \
  | python3 -c 'import sys,re;b=bytes.fromhex(sys.stdin.read().strip()[2:]);print(re.findall(rb"[A-Za-z0-9_]{4,}",b))'
```

`cast 4byte-decode` / `cast 4byte-calldata` 는 openchain 조회 기반이라 Maroo 전용 selector 에는 쓸 수 없다. 전체 struct 디코드는 `@maroo-chain/contracts@0.0.8` 패키지의 `precompiles/pcl/IPcl.sol`(`bun add` 로 설치; ABI JSON 은 같은 패키지의 `dist/abi/precompiles/pcl/IPcl.js`) 이 필요하다(가이드 A9) → TODO(실측: 그 `IPcl.sol` 의 struct 시그니처로 `cast abi-decode`).

---

## 5. 이벤트 topic0

| 이벤트 | topic0 | 근거 | 라벨 |
|---|---|---|---|
| `PrivacyDeposit(address indexed effectiveSender, address indexed operator, string amount, bytes noteCommitment)` | `0xe94fdc798d990ba081f57f5497bc5502379cc0db08b512c87d808678e51787c2` | 표본 receipt `0xe492ae2c…0a70` 의 `logs[0].topics[0]` 과 `cast keccak "PrivacyDeposit(address,address,string,bytes)"` 일치 (07:5x UTC). 시그니처 원문은 `@maroo-chain/contracts@0.0.8` 패키지의 `precompiles/privacy/IPrivacy.sol` (가이드 §2.2-8) | `[Live Testnet]` |
| — 같은 로그의 내용 | `topics[1] = topics[2] = 발신자` (effectiveSender == operator), `data.amount = "10000000000000000000atokrw"`, `data.noteCommitment` 32바이트 | 표본 receipt 디코드; docs contract-privacy-deposit ("Cosmos-coin-formatted value of `msg.value`") | `[Live Testnet]` (D-1) |
| `PclProxyDeployed(address indexed proxy, address indexed deployer, uint8 kind)` | `0x46d5afb38b589ecd695dcb3510bf5bfa5d5f4a1cbb80a7329f9780943c186499` | docs contract-pcl-deploy-pcl-proxy 시그니처 + `cast keccak`. 라이브 로그 미관측 | `[Docs Only]` |
| IPrivacy 나머지 이벤트 4종 | — | 가이드 §2.2-8 "이벤트 5종" — 이름·시그니처는 `@maroo-chain/contracts@0.0.8` 패키지의 `precompiles/privacy/IPrivacy.sol` 원문(`bun add` 로 설치) 필요 → TODO(실측: 그 `IPrivacy.sol` 의 이벤트 시그니처를 `cast keccak` 으로 계산) | — |

재확인 명령:

```bash
cast keccak "PrivacyDeposit(address,address,string,bytes)"
cast receipt --rpc-url $RPC 0xe492ae2ceebda2a9a48691e42aa9ac0a1df5d00d517fb31783216fc7d0770a70 --json \
  | python3 -c 'import sys,json;r=json.load(sys.stdin);l=r["logs"][0];print(l["topics"]);print(bytes.fromhex(l["data"][2:]))'
cast logs --rpc-url $RPC --address 0x100000000000000000000000000000000000000b \
  --from-block 17080168 --to-block 17080168 0xe94fdc798d990ba081f57f5497bc5502379cc0db08b512c87d808678e51787c2
```

---

## 6. 실측 상태 (2026-09-02)

### 6.1 OKRW · 수수료

| 항목 | 값 | 명령 | 라벨 |
|---|---|---|---|
| `mintDenom` | `atokrw` | `cast call --rpc-url $RPC 0x…01 "getParams()((address,string))"` | `[Live Testnet]` (D-1) |
| `minter` | `0x83cBceF68d5989a30795Ce63C9617Aa93016f63F` | 위 동일 | `[Live Testnet]` |
| 비발행자 `mint` | revert `0xec8860d9 + <caller> + 0x…83cbcef68d5989a30795ce63c9617aa93016f63f` | `cast call --rpc-url $RPC --from $ME 0x…01 "mint(address,uint256)" $ME 1` | `[Live Testnet]` |
| baseFee / priority / gasPrice | 8e12 / 1e12 / 9e12 atokrw | §1 | `[Live Testnet]` |
| `0xEeee…` 코드 | `0x` | `cast code --rpc-url $RPC 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` | `[Live Testnet]` (D-2) |

### 6.2 PCL

| 항목 | 값 | 명령 | 라벨 |
|---|---|---|---|
| `policyAdmin()` | `0x58eC1E718ff15e5f34591747D47ADf5BccDA804F` | `cast call --rpc-url $RPC 0x…05 "policyAdmin()"` | `[Live Testnet]` |
| 등록 템플릿 9개 | `DENYLIST_POLICY` `VOLUME_POLICY` `PERIODIC_VOLUME_POLICY` `EAS_POLICY` `OKRW_EAS_TRANSFER_LIMIT_POLICY` `OKRW_EAS_PERIODIC_VOLUME_LIMIT_POLICY` `AGENT_OKRW_TRANSFER_LIMIT_POLICY` (leaf 7) + `LOGICAL_POLICY` `FOR_EACH_POLICY` (composite 2) — 9개 모두 `policyTemplate(string)` 이 데이터 반환 | `for t in …; do cast call --rpc-url $RPC 0x…05 "policyTemplate(string)" "$t"; done`; 이름 원문 docs `pcl-policy-templates` | `[Live Testnet]` |
| 미등록 템플릿 | `NOPE_POLICY` → `0x6a2b23be…` `PolicyTemplateNotFound("NOPE_POLICY")` | `cast call --rpc-url $RPC 0x…05 "policyTemplate(string)" NOPE_POLICY` | `[Live Testnet]` |
| `contractPolicies(0x…0b)` | contract `0x…0b`, admin `0x58ec…804f`, 정책 2개: `EAS_POLICY` {eas `0x…07`, indexer `0x…08`, schemaUid `0x3e448d93…527d`} + `DENYLIST_POLICY` {빈 목록} | §3 명령; 문자열 추출은 §4.4-⑥ | `[Live Testnet]` |
| `pclProxy(0x…0b)` | 32바이트 전부 0 → `0x…0b` 는 PCL 프록시가 아니다(정책 인지 래퍼가 직접 강제) | `cast call --rpc-url $RPC 0x…05 "pclProxy(address)" 0x…0b` | `[Live Testnet]` |
| `globalPolicies()` | 3,776바이트, PolicySet 2개. 등장 템플릿 순서: `FOR_EACH_POLICY` `LOGICAL_POLICY` `PERIODIC_VOLUME_POLICY` (`atokrw`) `EAS_POLICY` `LOGICAL_POLICY` `VOLUME_POLICY` (`atokrw`) `EAS_POLICY` `FOR_EACH_POLICY` `EAS_POLICY`. 구조 해석은 가이드 §2.3-12 인용: 미인증 발신자 OR(VOLUME 2,000,000 tOKRW/건 \| EAS \| ForEach(Any, AgentOwners, EAS)), AgentOwners 에 PERIODIC 10,000,000/24h. 금액·기간 필드의 직접 디코드는 TODO(실측: IPcl ABI) | `cast call --rpc-url $RPC 0x…05 "globalPolicies()"` + §4.4-⑥ | `[Live Testnet]` |
| `preCall` 직접 호출 | `0x82b42900` `Unauthorized()` | `cast call --rpc-url $RPC --from $ME 0x…05 "preCall(address,address,bytes,uint256)" 0x…0b $ME 0x 0` | `[Live Testnet]` (D-6) |
| 전역 정책 적용 위치 | AnteHandler (서명 → 논스 → 수수료 → 가스 → PCL) | docs `concepts/network/maroo-transaction-lifecycle`, pcl-policy-enforcement | `[Docs Only]` |

### 6.3 EAS · KYC

| 항목 | 값 | 명령/근거 | 라벨 |
|---|---|---|---|
| `IEas.getParams()` | `(0x…06, 0x…07, 0x…08)` | `cast call --rpc-url $RPC 0x…09 "getParams()((address,address,address))"` | `[Live Testnet]` |
| KYC attester | `0xBfa4d8140b4104cA0Dd8c4E4b8cA420D551c0aE3` | 가이드 §2.4-4 | `[Live Testnet]` (가이드 인용) |
| KYC 절차 | 지갑 연결·서명 → 이름/생년월일/휴대폰 → 카카오 본인인증 → EAS attestation 발급. docs 에 절차 없음 | 가이드 §2.4-4, §5.1-⑨ | `[Live Testnet]` (가이드 인용) |

### 6.4 Privacy deposit — 관측 tx 와 가스

| 항목 | 값 | 근거 | 라벨 |
|---|---|---|---|
| 성공 표본 tx | `0xe492ae2ceebda2a9a48691e42aa9ac0a1df5d00d517fb31783216fc7d0770a70` — block 17,080,168, 2026-09-02T02:56:17Z, from `0x5164fcc0BAE866A669eF01F831493848112F44F8`, to `0x…0b`, value 10 OKRW (`10000000000000000000` atokrw), `status 0x1`, gasUsed **2,239,761**, gas limit 2,688,200, type 2, maxFee 9e12, maxPriority 1e12, effectiveGasPrice 9e12 → 수수료 ≈ 20.16 OKRW. input 868바이트, selector `0xe6eb7771` | `eth_getTransactionReceipt` / `eth_getTransactionByHash` (07:5x UTC); 가이드 A11 (잘린 해시 `0xe492ae2c…0a70` 의 전체값) | `[Live Testnet]` |
| 그 외 성공 deposit (selector `0xe6eb7771`, gasUsed) | `0x34400575e2e4e2f32de862897e9a424c8786dbc175d397c70942fa977de79bb2` 2,243,977 (09-02 07:57:33Z) · `0x34b524eebf41a4c21cf45a021c0c7ae3c5e9d464d6aa74d380d5cccc35f5dce7` 2,243,989 (09-02 07:10:16Z) · `0x0e7ae22d2afe75026556e8bf989a28826759eec5e3cd48ed351d9930e760cb4c` 2,243,761 (09-02 02:41:01Z) · `0xee9578805490194ed344104271455dbe93777b628c89620d53d992a4a9ac6c53` 2,239,521 (09-01 08:45:01Z) · `0xca354853fc40dedd07ba6901ea79762d32e08a13bc0533a5e6d99b51a33fb79f` 2,239,749 (09-01 06:23:21Z) · `0x683aa93602bbde5b1df09b68636c277a1fc147c67b12a72dbbf0640705014c00` 2,230,873 (08-19 00:11:40Z) — 이상 6건은 value 10 OKRW. **value 0 성공 1건**: `0x83a1289ef6498763f838a8d07ae6690668b488f2ba633129b29acc1e78935aaa` 2,233,231 (09-02 07:58:22Z, `amount "0atokrw"`, D-13). 표본 `0xe492…` 를 포함해 현재 selector 성공 deposit 은 8건 (목록 49건, `next_page_params` null) | `curl -s "$EXPL/addresses/0x100000000000000000000000000000000000000b/transactions"` (08:24 UTC 재조회); selector 는 각 tx 의 `eth_getTransactionByHash` input 첫 4바이트 | `[Live Testnet]` |
| 현재 selector 거부 tx (표본 외) | `0xbf0e1e7377b196eef6aa9910846dd516946d298e5a941d3908d451bc88e943f4` — 2026-08-10T08:08:23Z, selector `0xe6eb7771`, value 1 (wei), `status 0x0`, gasUsed 2,500,000 (gas limit 5,000,000), Blockscout `revert_reason` = `Error(string)` `deposit proof verification failed; the proof, amount, asset, or commitment may not match: pairing doesn't match: invalid request` | 위 목록 + `curl -s $EXPL/transactions/0xbf0e…` (08:29 UTC) | `[Live Testnet]` |
| 같은 주소의 다른 selector 성공 tx (deposit 아님) | `0xce4f349c` 3건 — `0xd0708f368a7f491fca9e6e842734d6b6f6bba4316fb501336a65bf38169f80b2` (09-02 06:00:57Z, gasUsed 2,047,476) · `0xb0c6083d5da9948a898b3860732258aa972b183ba24fd376a65e5c8aaf512eef` (06:01:56Z, 2,047,332) · `0x0ca217664bc5e3a7a8f24a499a4337bc9103b55bc2d5e712727693eeecd4b7c9` (07:11:04Z, 2,047,320), 전부 value 0·input 740바이트; `0x43fd6967` 1건 — `0x93634e772de00a8e45f25b7c4cde16f13ff5cd7cd530faa581dc04a1b061c19e` (09-02 08:04:26Z, value 0, input 3,908바이트, gasUsed 4,162,372). 두 selector 모두 `cast 4byte` 미등록 → 어느 IPrivacy 메서드인지는 TODO(실측: `@maroo-chain/contracts@0.0.8` 의 `precompiles/privacy/IPrivacy.sol` 시그니처로 `cast sig` 대조) | 위 목록 + `eth_getTransactionByHash` (08:24 UTC) | `[Live Testnet]` |
| deposit 가스 추정 | 성공 표본 기준 ≈ 2.24M gas ≈ 20 OKRW (가이드 Phase E-3). 본인 지갑의 `eth_estimateGas` 는 유효 proof + attestation 이 있어야 성공값이 나옴 → TODO(실측: 게이트 ⑥ 이후 `cast estimate --from $ME --value 10ether …`) | 위 receipt | `[Live Testnet]` (표본) |
| 거부 표본 tx | `0x3839c31d1b5625bd59b5251f6595b3e50ffb451aab93389fdbc488f30ee3899b` — block 17,097,658, 2026-09-02T07:52:40Z, from `0xCaCaB2FE2b22D8BB4A5A44552765518be8C847d0`, value 10 OKRW, `status 0x0`, gasUsed **1,750,000** (gas limit 3,500,000), 로그 0개. Blockscout `revert_reason` = `Error(string)` `no EAS attestation received for sender (index returned empty): maroo1et9t9l3tytvtkjj6g32jwe23305vs37scfk7f3` (bech32 = 위 from 주소). calldata 필드 길이 (32, 398, 164) 바이트 | `eth_getTransactionReceipt`, `curl -s $EXPL/transactions/0x3839…`, `cast decode-calldata` (07:5x UTC) | `[Live Testnet]` (D-12) |
| 거부 재생 (`eth_call`, 블록 `0x104e3b9` = 채굴 블록 − 1 및 `latest`) | 같은 from/to/value/input → `"code":3` `execution reverted: no EAS attestation received for sender …`; from 을 `0x…dEaD` 로 바꿔도 같은 문자열(bech32 만 `maroo1qqqq…ph4d4lmh8z` 로 바뀜); `eth_estimateGas` 도 동일 | §4.3 | `[Live Testnet]` |
| 구 selector tx | `0xe38734cb1e4b299b65b9135418b46baa93f8f5f5a9f7594258f6775997d78a90`, `0x7c8ddadc298c66cd36201866a8d8f40be67b22cbb40c1388244cc3685ce27d5a` — 2026-08-26, selector `0x68a36263`, revert, gasUsed 1,250,000. 반대로 2026-06-23~24 의 성공 33건(목록 상 `status ok`, gasUsed 전부 1,750,000)은 구 ABI 시절이다 — 그중 `0x12068e6265a943a8b0718ae0b47bb90860ca1f4db0a7d862c53acd4f9199c1cb` (06-24 02:55:06Z, value 1,000 OKRW, input 900바이트) 의 selector 를 `0x68a36263` 으로 확인, 나머지 32건의 selector 는 미확인 → TODO(실측: 목록의 06-23~24 tx 를 `eth_getTransactionByHash` 로 순회) | Blockscout 목록 (08:24 UTC) + `eth_getTransactionByHash`; 가이드 §5.1-③ "2026-06-24 이전 tx는 구 ABI로 성공" | `[Live Testnet]` (D-3) |
| IPrivacy view 메서드 | 없음 → 상태 확인은 receipt·이벤트·Blockscout 뿐 | docs privacy-precompile-overview ("no view methods"); §1 Cosmos REST 미노출 | `[Docs Only]` + `[Live Testnet]` |

재확인 명령:

```bash
# 성공 표본
cast receipt --rpc-url $RPC 0xe492ae2ceebda2a9a48691e42aa9ac0a1df5d00d517fb31783216fc7d0770a70 --json \
  | python3 -c 'import sys,json;r=json.load(sys.stdin);print(r["status"],int(r["gasUsed"],16),int(r["effectiveGasPrice"],16))'
cast tx --rpc-url $RPC 0xe492ae2ceebda2a9a48691e42aa9ac0a1df5d00d517fb31783216fc7d0770a70 --json \
  | python3 -c 'import sys,json;t=json.load(sys.stdin);print(t["input"][:10],len(t["input"])//2-1,int(t["value"],16))'
# 거부 표본 + 재생 (tx 전송 없음)
curl -s "$EXPL/transactions/0x3839c31d1b5625bd59b5251f6595b3e50ffb451aab93389fdbc488f30ee3899b" \
  | python3 -c 'import sys,json;t=json.load(sys.stdin);print(t["status"],t["gas_used"],t["revert_reason"])'
INP=$(cast tx --rpc-url $RPC 0x3839c31d1b5625bd59b5251f6595b3e50ffb451aab93389fdbc488f30ee3899b --json | python3 -c 'import sys,json;print(json.load(sys.stdin)["input"])')
rpc '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"from":"'$ME'","to":"0x100000000000000000000000000000000000000b","value":"0x8ac7230489e80000","data":"'$INP'"},"latest"]}'
rpc '{"jsonrpc":"2.0","id":1,"method":"eth_estimateGas","params":[{"from":"'$ME'","to":"0x100000000000000000000000000000000000000b","value":"0x8ac7230489e80000","data":"'$INP'"}]}'
#   attestation 없는 $ME → "no EAS attestation received for sender (index returned empty): maroo1…"
#   attestation 있는 $ME → "note commitment already exists" 가 아니라 0x…01 (0x3839… 의 commitment 는 트리에 없음)
# value 0 성공 deposit (D-13) + 재생 — 중복 검사가 proof 검사보다 먼저 (§4.3-8/9)
cast receipt --rpc-url $RPC 0x83a1289ef6498763f838a8d07ae6690668b488f2ba633129b29acc1e78935aaa --json \
  | python3 -c 'import sys,json;r=json.load(sys.stdin);print(r["status"],int(r["gasUsed"],16),bytes.fromhex(r["logs"][0]["data"][2:]))'
#   0x1 2233231 b'…0atokrw…'
INP0=$(cast tx --rpc-url $RPC 0x83a1289ef6498763f838a8d07ae6690668b488f2ba633129b29acc1e78935aaa --json | python3 -c 'import sys,json;t=json.load(sys.stdin);print(t["input"]);assert int(t["value"],16)==0')
for V in 0x0 0x8ac7230489e80000; do
  rpc '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"from":"0x5164fcc0bae866a669ef01f831493848112f44f8","to":"0x100000000000000000000000000000000000000b","value":"'$V'","data":"'$INP0'"},"latest"]}'
done   # 08:27 UTC: 둘 다 "note commitment already exists: invalid request"
# Blockscout 목록 전체 (49건, next_page_params null) — selector·value·gasUsed 확인
curl -s "$EXPL/addresses/0x100000000000000000000000000000000000000b/transactions" \
  | python3 -c 'import sys,json;[print(t["hash"],t["timestamp"],t["result"],t["gas_used"],t["value"]) for t in json.load(sys.stdin)["items"]]'
# 입력 검증 문자열 (가이드 C1 원문)
cast call --rpc-url $RPC --from $ME --value 0 0x100000000000000000000000000000000000000b \
  "deposit((bytes,bytes,bytes))" "(0x$(printf '00%.0s' {1..32}),0x,0x)"      # 07:5x UTC: note commitment must be non-zero
cast call --rpc-url $RPC --from $ME 0x100000000000000000000000000000000000000b 0x68a36263   # no method with id: 0x68a36263
```

### 6.5 Explorer 통계 (07:52 UTC)

`total_transactions` 16,148 · `total_addresses` 3,640 · `transactions_today` 53 · `average_block_time` 1,010 ms — `curl -s $EXPL/stats` `[Live Testnet]`.

---

## 7. Faucet 사실

| 항목 | 값 | 근거 | 라벨 |
|---|---|---|---|
| URL | `https://faucet.maroo.io` (HTTP 200) | docs testnet-access; `curl -sI` | `[Live Testnet]` |
| 요청당 | 5,000 tOKRW | 가이드 §5.5 (브라우저 번들·응답 관측) | `[Live Testnet]` (가이드 인용) |
| 빈도 | 10분당 5회 | 가이드 §5.5 | `[Live Testnet]` (가이드 인용) |
| 상한 | 잔액 10,000 tOKRW 이상이면 거부 | 가이드 §5.5 | `[Live Testnet]` (가이드 인용) |
| 인증 | RainbowKit 지갑 연결 + reCAPTCHA v3, 로그인 없음. `POST /api/sendToken` 에 captcha 없으면 400 → 스크립트 자동화 불가 | 가이드 §5.5 | `[Live Testnet]` (가이드 인용) |
| docs 서술 | getting-started: "You can get test OKRW from the faucet." — 한도·빈도·캡차 언급 없음. faucet 전용 docs 페이지(`/en/resources/network/faucet`) 는 404 | docs `guides/quickstart/getting-started`; WebFetch 404 | `[Docs Only]` (D-7) |
| 개발 잔재 | 번들 상수에 `api.maroo-pretestnet.delightlabs.sh` | 가이드 §5.5 | `[Live Testnet]` (가이드 인용) |
| 워크숍 운영 | 참가자 1인 = 2회 요청(10,000) 이 상한. deposit 표본 1건 ≈ 20 OKRW + 10 OKRW value, 거부 tx ≈ 15.75 OKRW → 5,000 으로 충분. 진행자는 사전에 백업 지갑을 브라우저로 채운다 | 위 수치 계산; 가이드 §5.5 | `[Live Testnet]` (계산) |

재확인 명령: 브라우저로만 가능(캡차). `curl -s -o /dev/null -w '%{http_code}\n' https://faucet.maroo.io` → 200.

---

## 8. D-n 각주 (SUBMISSION_NOTES › Discrepancies 와 동일 번호)

| D-n | 이 문서 위치 | 한 줄 요약 | 재현 |
|---|---|---|---|
| D-1 | §1 통화, §6.1, §5 | docs `aokrw` vs 실측 `atokrw` (`getParams`, 전역 정책 tokens, `PrivacyDeposit.amount`) | §2 재확인 첫 명령 |
| D-2 | §2, §6.1 | `0xEeee…` docs "Standard ERC20 ABIs work" vs `eth_getCode` `0x` | `cast code` |
| D-3 | §3, §4.2, §6.4 | deposit 시그니처 `(string,bytes,bytes)` `0x68a36263` → `(bytes,bytes,bytes)` `0xe6eb7771`; 구 selector 는 `no method with id` (2026-08-26 tx 2건 revert) | §3 재확인 마지막 명령 |
| D-4 | §2 IPrivacy 행 | deployed-contracts "These four precompile addresses" (IOkrw/IPcl/IEas/IAgent) vs Privacy `0x…0b` 별도 존재·동작 | `eth_call` deposit |
| D-5 | §1 `api-testnet` 행 | docs 의 `api-testnet.maroo.io` DNS 없음 | `dig +short` |
| D-6 | §3 `deployPclProxy`/`preCall` 행, §6.2 | `runOnPcl` 같은 함수 없음(docs privacy-policy-aware-precompile "with no explicit runOnPcl entrypoint"); 개발자 훅은 `deployPclProxy → preCall/postCall`; `preCall` 직접 호출은 `Unauthorized()` | `cast call … preCall` |
| D-7 | §7 | faucet 5,000/요청 · 10분당 5회 · 10,000 상한 · reCAPTCHA v3 vs docs 수치 없음 | 브라우저 |
| D-8 (가이드 §5.1-⑩) | §1 Blockscout API base 행 | Blockscout API 경로: `explorer-testnet.maroo.io/api/v2/stats` 404 vs `/blockscout/api/v2/stats` 200 | §1 재확인 `curl -sI` 2줄 |
| D-9 (가이드 C1 재실행, 본 문서 실측) | §4.2, §4.3 | docs contract-privacy-deposit 의 revert 문자열 4개 전부 미관측(`privacy deposit value is required` 는 더미 입력에서는 형식 검증에 가려지고, 유효 입력에서는 D-13 대로 강제되지 않음). 대신 미문서화 문자열 3개(`note commitment must be non-zero` / `deposit proof is required` / `encrypted note is not a canonical deposit-note envelope …`)가 먼저 나오며, 검사 순서는 형식 → PCL → 중복 → proof (§4.3-a) | §4.3 |
| D-10 (가이드 §5.1-⑥) | §4.2 `incorrect chain-id` 행, `-32000`/`code 3` 행 | RPC 오류 코드: docs estimate-gas `-32000`·send-transaction `-32602 Invalid signature` vs 실측 `eth_call`/`eth_estimateGas` revert `"code":3`, chainId 불일치 `-32000 incorrect chain-id; expected 450815, got 1`(가이드 실측) | §6.4 재생 `eth_estimateGas` |
| D-11 (가이드 §5.1-⑪) | §4.1 | 미등록 템플릿 오류: docs pcl-policy-templates `InvalidPolicyTemplate` vs 실측 `PolicyTemplateNotFound(string)` `0x6a2b23be` (pcl-get-policy-template 페이지는 실측과 일치) | `policyTemplate(NOPE_POLICY)` |
| D-12 (가이드 §5 외 신규, 본 문서 실측; `../SUBMISSION_NOTES.md` › Discrepancies 에 같은 번호로 등재됨. 관련 항목 가이드 §5.1-⑥ 오류 코드 형태) | §4.1 `EasNoAttestationReceived` 행, §4.2, §4.3, §6.4 | docs privacy-policy-aware-precompile "Anything PCL rejects surfaces as a typed PCL ReasonCode ABI-encoded into the revert data" (같은 페이지: "Non-PCL failures (invalid proof, spent nullifier, insufficient tree capacity) surface as plain string reverts from the executor.") / pcl-template-eas-policy `EasNoAttestationReceived(sender)` `0xbca5593e` vs 실측: **PCL(EAS_POLICY) 거부**가 typed 가 아니라 `Error(string)` `no EAS attestation received for sender (index returned empty): maroo1…` 로 옴 (채굴 tx `0x3839…` revert_reason + `eth_call` 재생). 범위는 EAS 거부의 revert 형태에 한정 — proof·중복 오류가 string 인 것은 docs 와 일치 | §6.4 재확인 |
| D-13 (가이드 §5 외 신규, 본 문서 실측; `../SUBMISSION_NOTES.md` › Discrepancies 에 같은 번호로 등재됨) | §4.2 `privacy deposit value is required` 행, §4.3-8·(d), §6.4 | docs contract-privacy-deposit "`msg.value == 0` → `privacy deposit value is required`" vs 실측: attestation 있는 발신자의 value 0 deposit 이 성공 — tx `0x83a1289ef6498763f838a8d07ae6690668b488f2ba633129b29acc1e78935aaa` (2026-09-02T07:58:22Z, block 17,097,995, `status 0x1`, gasUsed 2,233,231, `PrivacyDeposit.amount "0atokrw"`). 워크숍 Step 3 의 "`msg.value` 필수" 전제 재검토 대상 | §6.4 재확인 (`cast receipt 0x83a1…`) |

채번 규칙: D-1..D-7 은 리뷰 §2.5, D-8..D-11 은 `../SUBMISSION_NOTES.md` › Discrepancies (2026-09-02 08:2x UTC 시점 표) 와 같은 번호다. D-12·D-13 은 이 문서 실측에서 나온 신규 항목으로 `../SUBMISSION_NOTES.md` › Discrepancies 에 같은 번호로 등재했다(08:38 UTC `eth_call`·`eth_getTransactionReceipt` 재확인). 가이드 §5 에 있으나 이 문서가 D-n 을 붙이지 않는 항목(§5.1-④ deposit 가스(§6.4 표본으로만 인용), ⑦ 가스 위젯(§1 행, 가이드와 동일 값), ⑧ ERC-8004 인터페이스, ⑨ mock KYC, §5.2 docs 내부 불일치 13건, §5.3 Clairveil 대비 9건)은 가이드를 직접 인용한다.

도구 메모(불일치 아님): cast 1.7.1 에서 가이드 A5 의 `"getParams()(address,string)"` 은 디코드 실패 → `"getParams()((address,string))"` (§2).
