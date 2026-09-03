# Maroo Privacy Workshop — OKRW → PCL → Privacy (Track B)

| 과제 요구 항목 | 절 |
|---|---|
| 선택한 Primary Track | §1 |
| 결과물 개요와 대상 독자 | §2 |
| 가장 먼저 확인해야 하는 문서·디렉터리·데모 | §3 |
| 실행 방법과 사전 요구 사항 | §4 |
| 영상 링크 | §5 |
| 테스트넷 트랜잭션 또는 배포 링크 | §6 |
| 사용한 Clairveil 커밋 SHA | §7 |
| 알려진 한계 (known limitations) | §8 |

## 1. 선택한 Primary Track

**Track B (Enable)** — 60~75분 워크숍 패키지 + 실행 가능한 데모 + 라이브 테스트넷 증거.

## 2. 결과물 개요와 대상 독자

### 2.1 대상 독자와 의사결정 맥락

### 2.2 결과물 개요 — Track B 필수 결과물 6개

| # | 결과물 | 위치 | 상태 |
|---|---|---|---|
| 1 | Runnable Demo | [demo/README.md](demo/README.md) | |
| 2 | Live Testnet Evidence | `evidence/live-testnet/` + [SUBMISSION_NOTES.md › Validation](SUBMISSION_NOTES.md#2-validation) | |
| 3 | 60~75분 Workshop Package | [workshop/participant-guide.md](workshop/participant-guide.md) · [workshop/facilitator-guide.md](workshop/facilitator-guide.md) | |
| 4 | Troubleshooting Guide | [workshop/troubleshooting.md](workshop/troubleshooting.md) | |
| 5 | Validation | [demo/README.md › Validation](demo/README.md#3-validation-과제-l380-383) | |
| 6 | Walkthrough Video (5~8분) | [video-link.md](video-link.md) | |

## 3. 가장 먼저 확인해야 하는 문서·디렉터리·데모

1. 이 파일 §4 Quick Start
2. [SUBMISSION_NOTES.md › Validation](SUBMISSION_NOTES.md#2-validation) 실행 기록 → `evidence/live-testnet/`
3. [workshop/participant-guide.md](workshop/participant-guide.md) Step 0~4
4. [docs/testnet-reference.md](docs/testnet-reference.md) · [docs/architecture.md](docs/architecture.md)

## 4. 실행 방법과 사전 요구 사항

### 사전 요구

| 항목 | 값 | 확인 명령 |
|---|---|---|
| OS | | `sw_vers` / `uname -srm` |
| foundry `cast` / `forge` | | `cast --version`, `forge --version` |
| bun | | `bun --version` |
| Go (선택, Clairveil 로컬 대안에만) | | `go version` |
| 테스트넷 지갑 | 테스트넷 전용 키 1개 + 보조 수신 주소 1개. `PRIVATE_KEY` 는 `demo/.env`(gitignore)에만 | `cast wallet new` |
| Faucet | `MAROO_FAUCET_URL` | 브라우저 |
| KYC (선택, Step 3 성공 경로에만) | `MAROO_KYC_URL`. 실명 정보는 제출물에 넣지 않는다 | 브라우저 |

### 환경 변수

`demo/.env.example` 을 복사해 `demo/.env` 를 만든다. 키 14개 = `MAROO_RPC_URL` `MAROO_WS_URL` `MAROO_CHAIN_ID` `MAROO_NETWORK` `MAROO_EXPLORER_URL` `MAROO_FAUCET_URL` `MAROO_INDEXER_URL` `MAROO_KYC_URL` `MAROO_OKRW_PRECOMPILE` `MAROO_PCL_PRECOMPILE` `MAROO_EAS_PRECOMPILE` `MAROO_PRIVACY_PRECOMPILE` + 비밀 2개 `PRIVATE_KEY` `PROVER_BEARER_TOKEN`. 예시 값만 커밋한다.

### Quick Start (읽기 전용)

```bash
cd demo
cp .env.example .env           # PRIVATE_KEY 만 테스트넷 전용 새 키로 채운다. 값을 echo/커밋하지 않는다
set -a; source .env; set +a
export RPC="$MAROO_RPC_URL"; export EXPL="$MAROO_INDEXER_URL"
export OKRW="$MAROO_OKRW_PRECOMPILE"; export PCL="$MAROO_PCL_PRECOMPILE"
export EAS="$MAROO_EAS_PRECOMPILE";   export PRIV="$MAROO_PRIVACY_PRECOMPILE"
export ME="$(cast wallet address --private-key "$PRIVATE_KEY")"

cast chain-id --rpc-url $RPC
cast call --rpc-url $RPC $OKRW "getParams()((address,string))"
cast balance --rpc-url $RPC $ME
```

기대 출력은 [workshop/participant-guide.md](workshop/participant-guide.md) §0. 상태 변경 명령(Step 1 `cast send`)은 같은 문서 Step 1 에만 둔다.

### 데모 실행

```bash
cd demo && bun install --frozen-lockfile
bun run doctor          # 사전 요구 확인
bun run step:0          # … step:4
bun run smoke           # 검증
bun run reset           # 정리
```

## 5. 영상 링크

[video-link.md](video-link.md)

## 6. 테스트넷 트랜잭션 또는 배포 링크

| 항목 | tx hash | explorer | evidence |
|---|---|---|---|
| Step 1 — OKRW 네이티브 전송 (첫 상태 변경 tx) | | | |
| Step 3 — `IPrivacy.deposit` 성공 tx 또는 결정적 거부 원문 | | | |
| 배포 링크 | 해당 없음 — 프리컴파일만 호출하고 자체 컨트랙트를 배포하지 않는다 | | |

## 7. 사용한 Clairveil 커밋 SHA

- SHA:
- 원격:
- 라이선스:
- 역할: 구현 참고 자료. 외부 호출 방식·주소·ABI·API 는 docs.maroo.io 기준이며 Clairveil 에서 유추하지 않는다.

## 8. 알려진 한계 (Known Limitations)

정본: [SUBMISSION_NOTES.md › Known Limitations](SUBMISSION_NOTES.md#5-known-limitations).

## 9. 출처·라이선스·변경 범위

| 원본 경로@SHA | 사용 범위 | 라이선스 | 변경 요약 |
|---|---|---|---|
| | | | |

- 복사·수정한 외부 코드가 생기면 위 표에 행을 추가하고 루트에 `LICENSE`·`NOTICE` 를 넣는다.
- Clairveil 예제의 공개 dev 니모닉은 어떤 경우에도 가져오지 않는다.
- bun 의존성은 `demo/package.json`·`demo/bun.lock` 에 기록한다. 문서 인용은 URL 또는 `path:line` 으로 문장 옆에 붙인다.

## 부록 A. 디렉터리 트리

```
maroo-privacy-workshop/
├── README.md                      이 파일
├── SUBMISSION_NOTES.md            5개 필수 섹션 (Assumptions/Discrepancies · Validation · AI Usage · DX Feedback · Known Limitations)
├── video-link.md                  영상 링크·길이·언어·공개 설정·타임스탬프
├── .gitignore                     .env / 키 파일 / forge out·cache 제외. demo/broadcast/ · bun.lock · *.log 는 커밋(증거)
├── demo/
│   ├── README.md                  단계표(Step 0~4) + Validation + 변경 범위
│   ├── .env.example               예시 값만 (키 14개)
│   ├── foundry.toml               (예정)
│   ├── remappings.txt             (예정)
│   ├── package.json · bun.lock    (예정) scripts doctor / step:0..4 / smoke / reset
│   ├── src/                       (예정) bun TS 실행기 — cast/forge 호출, 결과를 evidence 로 저장
│   ├── script/                    (예정) forge script — Step 3 deposit
│   └── broadcast/                 forge script --broadcast 의 tx 기록 (커밋)
├── docs/
│   ├── testnet-reference.md       주소·selector·오류·정책 상태 표
│   └── architecture.md            OKRW→PCL→Privacy 흐름도 + 신뢰 경계 + FAQ
├── workshop/
│   ├── participant-guide.md       학습 목표 → 준비 확인 → Step 0~4 + success criteria → 다음 단계
│   ├── facilitator-guide.md       진행 절차 + 75분 시간표 + 토론 질문 + 장애 시 대체
│   └── troubleshooting.md         오류 5개+ (원인·증상·확인·해결) + 라이브 장애 시 대체 진행
├── evidence/
│   └── live-testnet/              receipt JSON · explorer 캡처 · 오류 원문
└── scripts/                       예약
```

## 부록 B. 증거 라벨과 evidence 파일 규칙

- `[Live Testnet]` 테스트넷에서 직접 실행 · `[Local]` 이 머신에서 Clairveil 실행 · `[Simulation]` 체인·증명 없이 실행 · `[Docs Only]` 문서에서만 확인.
- 파일명 `evidence/live-testnet/<UTC>_<step>_<hash8>.<json|log|png>`. 각 파일 첫 줄에 UTC · 명령 원문 · 실행 환경을 남긴다.
- 허용·금지 항목은 [SUBMISSION_NOTES.md › Validation](SUBMISSION_NOTES.md#2-validation) 첫머리가 정본.
