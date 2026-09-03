# Walkthrough Video (Track B 결과물 #6)

과제 요구: 5~8분, 참가자가 무엇을 만들고 어느 순간에 성공을 확인하는지 보여줄 것(과제 L384-387). 한국어 진행 기본(과제 L240). 공개 또는 unlisted(과제 L232). 실행하지 않은 기능을 동작하는 것처럼 연출하지 않는다(과제 L235). 실패가 중요한 발견이면 실패 화면과 진단 과정도 증거가 된다(과제 L234).

| 항목 | 값 | 설명 |
|---|---|---|
| 링크 | TODO(영상: 업로드 후 URL) | YouTube 등 공개 플랫폼. README §5에서 이 파일로 링크 |
| 길이 | TODO(영상: mm:ss) | 5:00~8:00 안이어야 함(과제 L385) |
| 언어 | TODO(영상: 한국어 / 한국어+영문 자막) | 기본 한국어(과제 L240). 영문 자막은 선택(과제 L242) |
| 공개 설정 | TODO(영상: 공개 / unlisted) | 과제 L232. 제출 후에도 링크가 유지되도록 삭제·비공개 전환 금지 |
| 녹화 환경 | TODO(영상: OS·터미널·cast/forge·bun 버전, 새 브라우저 프로필 여부) | SUBMISSION_NOTES §2 실행 환경 행과 일치시킨다 |
| 녹화 UTC | TODO(영상: YYYY-MM-DDTHH:MM:SSZ) | evidence 파일의 UTC와 대조 가능해야 함 |

## 성공 확인 타임스탬프 (3~5개)

각 타임스탬프는 참가자 가이드의 Step 번호와 success criteria에 대응한다. 값은 영상 편집 후 채운다.

| # | mm:ss | Step | 화면에서 보여야 하는 것 | 대응 증거 |
|---|---|---|---|---|
| T-1 | TODO(영상) | Step 0 준비 확인 | `cast chain-id` → `450815`, `getParams()` → `"atokrw"` (Docs `aokrw`와 첫 불일치 D-1을 말로 짚음) | SUBMISSION_NOTES §2 07:54–07:55 UTC 행 |
| T-2 | TODO(영상) | Step 1 OKRW 네이티브 전송 | `cast send` → receipt `status 0x1` → `https://explorer-testnet.maroo.io/tx/<hash>` 열림. 결과물 #2의 순간 | `evidence/live-testnet/<UTC>_step1_<hash8>.json` (TODO(실측)) |
| T-3 | TODO(영상) | Step 2 PCL 읽기·거부 재현 | `contractPolicies(0x…0b)` 응답, `preCall` 직접 호출 → `0x82b42900` `Unauthorized()`, 더미 deposit `eth_estimateGas` revert 문자열을 selector 표로 해독 | SUBMISSION_NOTES D-6, D-9 |
| T-4 | TODO(영상) | Step 3 Privacy deposit | 분기 A: `deposit` 성공 tx + explorer / 분기 B: 결정적 거부 원문·UTC·환경. 어느 분기인지는 TODO(실측) | `evidence/live-testnet/<UTC>_step3_*` (TODO(실측)) |
| T-5 (선택) | TODO(영상) | Step 4 대체 진행 | Clairveil `make privacy-e2e-smoke` → `privacy e2e smoke passed` (`[Local]`) — 실행했을 때만 넣는다 | TODO(실측: `[Local]` 로그 경로 — 패키지 트리에는 `evidence/live-testnet/`만 있으므로 실행 전 트리 정본에 경로를 추가한 뒤 참조) |

## 녹화 전 체크

- 새 브라우저 프로필·새 터미널 세션. `.env`·개인키·`PROVER_BEARER_TOKEN`·KYC 화면(카카오 인증, 실명)이 화면에 나오지 않는다(과제 L169, L700; SUBMISSION_NOTES §2 규칙 2·5).
- 터미널에 `PRIVATE_KEY` 값을 echo 하지 않는다. `cd demo && set -a; source .env; set +a` 까지만.
- 영상의 tx 해시가 README §6·SUBMISSION_NOTES §2 표의 값과 같은지 확인한다.
