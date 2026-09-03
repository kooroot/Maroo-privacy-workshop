# 진행자 가이드 — 75분 시간표 정본

참가자 절차·명령·success criteria 의 정본은 [participant-guide.md](participant-guide.md) 다. 이 문서는 참가자 단계를 **번호로만** 참조하고 절차를 재기술하지 않는다. 장애 대응의 정본은 [troubleshooting.md#fallback](troubleshooting.md#fallback) 이며 여기서는 링크만 건다(리뷰 §1.3 S4).

라벨은 `[Live Testnet]` `[Local]` `[Simulation]` `[Docs Only]` 네 가지만 쓴다(과제 L158). 진행 언어는 한국어, 명령·식별자는 영어 그대로(과제 L239-241).

---

## 1. 진행 전 체크 (전날 ~ 시작 30분 전)

| # | 항목 | 확인 방법 | 상태 |
|---|---|---|---|
| P1 | [../README.md](../README.md) Quick Start 를 진행자 머신에서 통과 | participant-guide §0 의 확인 명령 3개가 기대 출력과 일치 (`0x6e0ff` / `rpc_modules` 6개 / `atokrw`) | TODO(실측: 당일 UTC 기록) |
| P2 | faucet 잔액 | faucet `https://faucet.maroo.io`(docs testnet-access; 2026-09-02T07:54Z HTTP 200). 규칙 `[Live Testnet]` **D-7**: 요청당 5,000 tOKRW · 10분당 5회 · 잔액 10,000 이상이면 거부 · RainbowKit 지갑 연결 + reCAPTCHA v3 필수(스크립트 자동화 불가) (가이드 §5.5). 진행자는 **백업 지갑을 브라우저로 미리** 채운다(가이드 §5.5). 필요량 산식: Step 1 = 1 + 0.189 OKRW; Step 3 분기 A = deposit 금액 + ≈20 OKRW(2.24M gas × 9e12); 분기 B 를 온체인으로 보낼 경우 ≈15.75 OKRW(표본 1,750,000 gas × 9e12) | 백업 지갑 잔액 TODO(실측: `cast balance --ether`) |
| P3 | KYC 여부 결정 = 게이트 ⑥ (가이드 §6) | `https://kyc-testnet.maroo.io` 는 실명·생년월일·휴대폰 + 카카오 본인인증을 요구하고 절차 문서가 없다(가이드 §5.1-⑨, §2.4-4). 진행자 지갑 1개만 KYC 할지, 참가자 전원 분기 B 로 갈지 결정. 외국인·비카카오 참가자는 분기 A 불가. 유효 proof 생성 수단이 미확정이면 분기 A 는 **성립하지 않는다**(participant-guide Step 3 "입력 생성") | 이번 회차 분기: TODO(실측: A/B) |
| P4 | 보조 주소 준비 | 참가자 수만큼 `cast wallet new` 로 만든 **주소만** 목록화(개인키는 보관하지 않거나 즉시 폐기). 참가자가 직접 만들어도 됨 | TODO(실측: 당일 주소 목록) |
| P5 | 시연용 터미널 2개 | T1 = 명령 실행(participant-guide §0 의 공통 환경 블록 — `cd demo` → `source .env` → `$RPC`…`$ME` — 준비 완료; bun 1.4.0 + foundry 1.7.1 `cast`/`forge` 설치는 [../README.md](../README.md) Quick Start), T2 = `cast receipt`/`curl` 확인 + explorer 브라우저. 브라우저는 **새 프로필**(과제 L169; 리뷰 §1.2 M6) | |
| P6 | prover(분기 A 일 때만) | `clairveil-proverd` 는 Bearer 토큰이 비면 무인증(가이드 §3.4-4, §8). 기동·호환은 TODO(실측: 가이드 §4 Phase E). | TODO(실측: 분기 A 확정 시) |
| P7 | `PROVER_BEARER_TOKEN` 은 당일 별도 채널로 배포하고 워크숍 종료 후 폐기한다. 리포·evidence·영상에 넣지 않는다(과제 L169). | | |
| P8 | 성공 표본과 거부 표본 링크를 T2 에 미리 열어 둔다 | 성공 `https://explorer-testnet.maroo.io/tx/0xe492ae2ceebda2a9a48691e42aa9ac0a1df5d00d517fb31783216fc7d0770a70` `[Live Testnet] (2026-09-02)` · 거부(문자열 revert) `…/tx/0x3839c31d1b5625bd59b5251f6595b3e50ffb451aab93389fdbc488f30ee3899b` · 구 selector 실패 `…/tx/0xe38734cb1e4b299b65b9135418b46baa93f8f5f5a9f7594258f6775997d78a90` (전부 participant-guide Step 2·3 에 출처) | |
| P9 | 로컬 대체 경로 준비 상태 | 이 머신은 `~/.clairveil` 없음(`make init` 미실행, 2026-09-02). 장애 대비로 미리 돌려 두려면 [troubleshooting.md#fallback](troubleshooting.md#fallback) 의 절차. 소요 시간 TODO(실측) | TODO(실측: make init 실행 여부) |

---

## 2. 75분 시간표 (정본)

| 구간 | Step | 진행자 행동 | 참가자 산출물 | 라벨 | 장애 시 링크 |
|---|---|---|---|---|---|
| 00–10 | 0 준비 확인 | T1 에서 `eth_chainId`·`rpc_modules`·잔액·`getParams()` 4개를 시연. `atokrw` 가 나오는 순간 D-1(docs `aokrw`) 을 짚는다. 잔액 0 인 참가자를 P2 백업 지갑에서 즉시 채운다 | S0-1~S0-4 통과 확인(구두 체크) | `[Live Testnet]` | [troubleshooting.md#fallback](troubleshooting.md#fallback) (RPC 무응답 판정), [#faucet-limit](troubleshooting.md#faucet-limit) |
| 10–25 | 1 OKRW 네이티브 전송 | T1 에서 `cast send … --value 1ether` 1건 시연 → T2 에서 `cast receipt … status` = `true` 와 explorer 페이지. 수수료(8e12+1e12) 를 왜 명시했는지 한 문장. 참가자 전송 동안 순회 | receipt JSON + explorer 링크 + UTC/환경 (S1-1~S1-3, 실패 시 S1-4) = **Track B 결과물 #2** (과제 L363) | `[Live Testnet]` | [#fee-gas](troubleshooting.md#fee-gas), explorer 지연 → [#fallback](troubleshooting.md#fallback) |
| 25–40 | 2 PCL 읽기 + 거부 재현 | (a) `contractPolicies(0x…0b)` → `EAS_POLICY`·`DENYLIST_POLICY`·admin `0x58eC…804F`; (b) `globalPolicies()`; (c) `cast estimate` 로 거부 → `data` 첫 4바이트를 selector 표로 해독하는 것을 T1 에서 시연; (d) `preCall` 직접 호출 `Unauthorized()` 로 D-6 마무리 | estimateGas 오류 원문 + selector 이름 + UTC (S2-1~S2-4) | `[Live Testnet]` | [#estimategas-reverted](troubleshooting.md#estimategas-reverted), [#policy-template-not-found](troubleshooting.md#policy-template-not-found) |
| 40–60 | 3 Privacy deposit | P3 에서 정한 분기를 선언. **분기 A**: 진행자 KYC 지갑 + proof 로 `cast send` 1건 → receipt `status 0x1` + `PrivacyDeposit` topic0. **분기 B**: 참가자 각자 `cast estimate --from $ME` 로 결정적 거부를 기록. 어느 분기든 P8 의 성공 표본 tx 를 T2 에서 열어 "실제 성공은 이렇게 생겼다" 를 보여 준다 | S3-A1/A2 또는 S3-B1/B2 + S3-C | `[Live Testnet]` | [#no-method-with-id](troubleshooting.md#no-method-with-id), [#deposit-value-required](troubleshooting.md#deposit-value-required), [#fee-gas](troubleshooting.md#fee-gas), 대체 → [#fallback](troubleshooting.md#fallback) |
| 60–75 | 4 정리·토론·다음 단계 | §3 의 토론 질문(Step 별 1~2개) 중 시간에 맞게 선택. evidence 정리·비밀정보 grep 을 함께 실행. 종료 후 결정 사항 3개(participant-guide 마지막 절) 를 읽어 준다 | S4-1~S4-3 (구두) + evidence 디렉터리 정리 완료 | 토론: 라벨 없음 / 대체 경로 사용 시 `[Local]`·`[Simulation]` | [#fallback](troubleshooting.md#fallback) 의 참가자 안내 문구 |

---

## 3. Step 별 토론 질문 · 기대 답 · 흔한 오답 패턴

근거는 docs 문장(WebFetch 2026-09-02) 또는 탐색 가이드 실측으로 한정했다.

### Step 0

**Q0-1. chainId 를 `.env` 에 적어 두고 있는데 왜 굳이 `eth_chainId` 로 다시 확인하나?**
- 기대 답: 서명에 들어가는 chainId 가 틀리면 브로드캐스트에서 거절된다. 라이브 문자열은 `incorrect chain-id; expected 450815, got 1`(-32000) 이고, docs `send-transaction` 은 이를 `-32602 Invalid signature` 로 적고 있어 문서만 보면 원인을 못 찾는다(가이드 §5.1-⑥). docs `maroo-network-parameters` 도 하드코딩을 말린다(가이드 §2.1-12).
- 흔한 오답: "지갑(MetaMask)이 알아서 맞춘다" — 스크립트·cast 경로에는 지갑이 없다.

**Q0-2. `getParams()` 가 `atokrw` 를 돌려주는데 docs 는 `aokrw` 다. 코드에는 뭘 쓰나?**
- 기대 답: 체인이 돌려주는 값을 읽어 쓰고(하드코딩 금지), 차이는 재현 명령과 함께 D-1 로 기록한다(과제 L140-142). 이벤트 `PrivacyDeposit.amount` 문자열과 전역 정책 tokens 도 `atokrw` 다(가이드 §5.1-①).
- 흔한 오답: "Docs 가 정본이니 `aokrw` 를 써야 한다" — 과제 L138 의 '기준' 은 인터페이스·ABI·주소이고, L140-141 은 차이를 숨기지 말고 기록하라는 뜻이다.

### Step 1

**Q1-1. explorer 첫 화면의 가스 위젯은 7,000 gwei 상당인데 그 값으로 보내면?**
- 기대 답: baseFee 가 8e12(8,000 gwei 상당) 이므로 maxFee < baseFee 가 되어 포함되지 않는다. RPC `eth_feeHistory`/`cast base-fee` 로 읽은 값을 쓴다(가이드 §5.1-⑦, §2.1-8 EIP-1559 유효가격 = min(maxFee, base+priority)).
- 흔한 오답: "explorer 값이 최신이다" — Blockscout `gas_prices` 는 7,000 으로 고정 표시됐다(2026-09-02T07:52Z `stats` 재확인).

**Q1-2. receipt `status 0x1` 이면 끝인가, 확인 블록을 더 기다려야 하나?**
- 기대 답: docs `maroo-transaction-lifecycle` — "검증자의 과반수(2/3 이상)가 동의하면 블록은 블록체인에 커밋됩니다. 이 시점에서 트랜잭션은 최종 확정된 것으로 간주되며" (WebFetch 2026-09-02). 즉시 finality 라 재조직을 기다릴 필요가 없다.
- 흔한 오답: "12 confirmations" — 이더리움 PoW/PoS 관행을 그대로 옮긴 것.

### Step 2

**Q2-1. `0x…0b` 에 걸린 EAS_POLICY·DENYLIST_POLICY 는 누가 바꿀 수 있고, 참가자는 어디까지 할 수 있나?**
- 기대 답: admin 이 policyAdmin `0x58eC1E718ff15e5f34591747D47ADf5BccDA804F` 라 참가자는 못 바꾼다(가이드 §2.3-2, §4 A9). 참가자는 자기 컨트랙트에 `deployPclProxy → changeContractPolicies` 로 컨트랙트 범위 정책만 붙일 수 있다(가이드 §2.3-8). 전역 정책은 PolicyAdmin(체인 파라미터) 만.
- 흔한 오답: "`runOnPcl` 을 호출해 정책을 적용/우회한다" — 그런 함수는 없다(**D-6**). 라이브에서 `preCall` 직접 호출은 `Unauthorized()` `0x82b42900` (가이드 §4 C6).

**Q2-2. estimateGas 오류 `data` 의 첫 4바이트가 `0x08c379a0` 이면 PCL 거부인가?**
- 기대 답: 아니다. `0x08c379a0` = `Error(string)`, 즉 비-PCL 문자열 revert(입력 검증·증명 실패 등). docs `privacy-policy-aware-precompile` 은 PCL 거부를 "typed PCL ReasonCode … ABI encoded", executor 실패를 "plain string revert" 로 구분한다(WebFetch 2026-09-02). PCL selector 는 [troubleshooting.md#estimategas-reverted](troubleshooting.md#estimategas-reverted) 표.
- 흔한 오답: "revert 면 다 컴플라이언스 거부" — 더미 입력으로는 PCL 단계까지 못 간다(가이드 §4 C5; 2026-09-02T07:53Z 재확인 문자열 `encrypted note is not a canonical deposit-note envelope …`).
- 주의(진행자만): 2026-09-02T07:52:40Z 관측된 타인 tx `0x3839c3…899b` 는 EAS 미인증 거부가 **문자열** `no EAS attestation received for sender (index returned empty): maroo1…` 로 왔다. docs 와 다른 형태다(**D-12**; 같은 calldata 의 `eth_call` 재생으로 재현됨, `../docs/testnet-reference.md` §4.3). 참가자 본인 주소 재현 전까지는 "표본 + 재생" 으로만 말한다(participant-guide Step 2 (c)).

### Step 3

**Q3-1. 거부가 '결정적(deterministic)' 이라는 게 왜 증거가 되나?**
- 기대 답: 같은 입력·같은 상태에서 누구나 재현되므로 오류 원문·UTC·환경·재현 절차만 있으면 과제 L365 의 요구를 충족한다. docs `pcl-template-eas-policy` 는 "새 attestation이 온체인에 도달하면 동일 트랜잭션이 성공합니다" 라고 해서 거부가 상태에만 의존함을 명시한다(WebFetch 2026-09-02).
- 흔한 오답: "실패했으니 제출 못 한다" — 과제 L364-366 은 실패 기록과 대체 경로를 허용한다.

**Q3-2. ZK 로 익명인데 감사(audit)는 어떻게 가능한가? disclosure 는 어디 있나?**
- 기대 답: 온체인은 증명의 유효성만 검증하고 소유권은 오프체인이다(리뷰 §2.3). 감사 disclosure 는 파일이 아니라 transfer 메시지의 필드로, 감사 master pubkey 가 없으면 transfer 가 거부된다(`proto/clairveil/privacy/v1/tx.proto:87-89`, `x/privacy/keeper/msg_server.go:250-253`; 가이드 §3.3-2). 이 부분은 Maroo 테스트넷에서 실측하지 않았으므로 `[Local]` 코드 근거로만 말한다.
- 흔한 오답: "`disclosure.json` 을 만들어 제출한다" — 리포의 `*-disclosure.json` 은 공개키 출력일 뿐(리뷰 §2.2).

### Step 4

**Q4-1. 전역 정책과 컨트랙트 정책은 언제, 어디서 평가되나?**
- 기대 답: 전역 = AnteHandler, EVM 실행 **전**. docs `maroo-transaction-lifecycle` 순서: "서명 검증 → 논스 검사 → 수수료 차감 → 가스 한도 검증 → PCL 평가", "어느 한 단계라도 실패하면 … 표준 SDK 오류 (서명/논스/수수료)이거나 PCL ReasonCode (컴플라이언스)" (WebFetch 2026-09-02). 컨트랙트 정책 = PCL 프록시 `preCall/postCall`(가이드 §2.3-3). Privacy 프리컴파일은 정책 인지 래퍼가 호출당 PolicyOperation **정확히 1개**를 만들어 사전→실행→사후→기록 순으로 평가한다(가이드 §2.2-2; docs "exactly one `ContractPolicyOperation()`").
- 흔한 오답: "CheckTx 단계 PCL 인터셉터" — docs 에 없는 용어(리뷰 §2.2 L33 판정).

**Q4-2. Clairveil `make privacy-e2e-smoke` 가 통과하면 오늘 흐름이 로컬에서 검증된 것인가?**
- 기대 답: 아니다. Clairveil 로컬넷에는 EVM·OKRW·PCL 이 없다(`ls x/` → privacy 하나, `go.mod` 에 evm 없음; 리뷰 §2.1). e2e-smoke 는 Privacy 코어(deposit→transfer→withdraw, `uclair`, Cosmos Msg) 만 `[Local]` 로 검증하고, PCL 연동 래퍼는 비공개 Maroo 바이너리에 있다(가이드 §5.3-①②). 따라서 OKRW→PCL→Privacy 한 tx 흐름은 로컬에서 `[Simulation]`/`[Docs Only]` 다.
- 흔한 오답: "같은 x/privacy 코드니까 동일" — Docs 의 revert 문자열·가스·nullifier 개수도 Clairveil 과 다르다(가이드 §5.3-③④⑤).

---

## 4. 밀렸을 때 생략 순서

위에서부터 순서대로 뺀다. 빠진 항목은 라벨을 `[Docs Only]` 로 강등하고 참가자에게 그렇게 말한다.

1. Step 2 (b) `globalPolicies()` 필드 해석 → 가이드 §2.3-12 의 트리 요약을 슬라이드로 읽어 준다 `[Docs Only]` (호출 자체는 1초라 남긴다).
2. Step 2 (d) `preCall` 직접 호출 시연 → D-6 는 말로만 `[Docs Only]`.
3. Step 3 분기 A(성공 전송) → 분기 B(estimateGas 거부) 만 실행하고, 성공은 P8 표본 tx 로 대체(`[Live Testnet]` 관측이지 참가자 실행이 아님을 명시).
4. Step 4 토론 → Step 별 질문 2개 중 1개만(Q0-2, Q2-2, Q4-1 우선).
5. Step 3 전체 → 참가자 실행 없이 표본 tx 2개(성공·거부) explorer 열람 `[Live Testnet] (관측)` + 다음 단계 읽기. 이 경우 SUBMISSION_NOTES Known Limitations 에 기록.

**절대 빼지 않는 것**: Step 0, Step 1(참가자 본인 tx = 결과물 #2). Step 1 을 못 돌면 그 순간 [troubleshooting.md#fallback](troubleshooting.md#fallback) 으로 전환한다.

---

## 5. 종료 체크리스트

- [ ] `evidence/live-testnet/` 파일명이 `<UTC>_<step>_<hash8>.json` / `.png` 규칙과 일치(정본 [../README.md](../README.md)). 예: `20260902T075240Z_step3_3839c31d.json`.
- [ ] 각 evidence 에 UTC, 명령 원문, 환경(OS/bun/forge·cast 버전), 결과(성공/실패) 가 있다(과제 L365).
- [ ] 비밀정보 점검: `grep -ril "PRIVATE_KEY\|mnemonic\|bearer" evidence/` 결과 없음. 스크린샷에 개인키·니모닉·bearer 토큰·카카오 인증 화면·실명 없음(과제 L169; 가이드 §8).
- [ ] `PROVER_BEARER_TOKEN` 폐기(P7).
- [ ] 이번 회차 분기(A/B) 와 실측 TODO 항목을 SUBMISSION_NOTES Validation 표에 UTC 와 함께 기록.
- [ ] 라이브 장애가 있었다면 전환 시각·판단 근거·대체 경로 결과를 같은 표에 기록하고 라벨을 `[Local]`/`[Simulation]` 으로.
- [ ] 참가자별 S0~S4 통과 여부 메모(구두 체크 결과).
