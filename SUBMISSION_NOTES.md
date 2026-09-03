# SUBMISSION_NOTES — Track B (Enable)

라벨은 `[Live Testnet]` `[Local]` `[Simulation]` `[Docs Only]` 네 가지만 쓴다. 불일치 번호 `D-n` 은 [docs/testnet-reference.md](docs/testnet-reference.md) 와 같은 번호를 쓴다.

---

## 1. Assumptions / Discrepancies

### 1.1 대상 audience 가정

| # | 가정 | 근거 |
|---|---|---|
| A-1 | | |

### 1.2 실제 구현 vs 제안·mock 구분

| 항목 | 상태 | 라벨 |
|---|---|---|
| | | |

### 1.3 의도적으로 제외한 범위

### 1.4 Discrepancies (Docs ↔ Clairveil ↔ 테스트넷)

| ID | 항목 | Docs 값 (페이지 URL) | 실제 값 | 재현 명령 | 라벨 | evidence 파일 |
|---|---|---|---|---|---|---|
| D-1 | | | | | | |

---

## 2. Validation

### 2.1 증거 취급 규칙

1. 허용: 주소, tx hash, explorer URL, attestation UID, 오류 문자열·revert data, receipt JSON, 실행 로그(`*.log` 는 gitignore 대상이 아님).
2. 금지: 니모닉, 개인키, `PROVER_BEARER_TOKEN` 등 bearer token, KYC 입력값(실명·생년월일·휴대폰·인증 화면), 키 파일(`*-key.json`, `keyring-*/`).
3. `PRIVATE_KEY` 는 `demo/.env`(gitignore)에만 두고 문서·로그·영상에는 `.env` 참조로만 쓴다. 로그를 붙이기 전 `grep -iE "PRIVATE_KEY|mnemonic|bearer"` 로 확인한다.
4. 파일명 `evidence/live-testnet/<UTC>_<step>_<hash8>.<json|log|png>`. 각 파일 첫 줄에 UTC · 명령 원문 · 실행 환경(§2.2 행 인용)을 남긴다.
5. 영상·스크린샷은 새 브라우저 프로필에서 찍는다. 실행하지 않은 기능을 동작하는 것처럼 연출하지 않는다.

### 2.2 실행 환경

| 항목 | 값 | 확인 명령 |
|---|---|---|
| OS | | `sw_vers` / `uname -srm` |
| foundry cast / forge | | `cast --version`, `forge --version` |
| bun | | `bun --version` |
| Go (Clairveil 로컬에만) | | `go version` |
| curl | | `curl --version` |
| Clairveil | | `git rev-parse HEAD`, `git describe --tags` |
| Maroo 테스트넷 | | `cast chain-id --rpc-url $RPC` |

### 2.3 실행 기록

| UTC | 명령 | 환경 | 결과 | 라벨 | evidence |
|---|---|---|---|---|---|
| | | | | | |

### 2.4 직접 검증한 것과 문서에서만 확인한 것

- 직접 검증 `[Live Testnet]` / `[Local]`:
- 문서에서만 확인 `[Docs Only]`:

---

## 3. AI Usage

사용 도구:

| # | 구분 | 사례 | 검증·수정 | 최종 판단(사람) |
|---|---|---|---|---|
| S-1 | 속도 | | | |
| S-2 | 속도 | | | |
| E-1 | AI 오류 | | | |

사람이 직접 판단한 부분:

---

## 4. DX Feedback

| ID | 문제 | 재현 절차·근거 | 영향 사용자 | 심각도 + 이유 | 제안 개선 | owner |
|---|---|---|---|---|---|---|
| DX-1 | | | | | | |
| DX-2 | | | | | | |
| DX-3 | | | | | | |

---

## 5. Known Limitations

### 완료하지 못한 부분

### mock 또는 simulation 으로 처리한 부분

### production 적용 전에 필요한 추가 작업
