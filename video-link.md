# Walkthrough Video — 5~8분

| 항목 | 값 |
|---|---|
| URL | https://youtu.be/iTRQt5_Vc-Y |
| 길이 | 492초 (8분 12초) |
| 언어 | 한국어 |
| 공개 설정 | unlisted |
| 녹화 commit | eab5a4120cdde4e5809853554ceaa514da9fe42a |

> 2차 초안 확인 결과: 영상은 정상 재생되고 링크 접근도 가능하지만, 과제 상한 480초를 12초 초과한다. 최종 제출 전 12초 이상 편집한 뒤 YouTube 영상을 교체하고 실제 길이로 이 표를 갱신한다.

실행하지 않은 기능을 동작하는 것처럼 연출하지 않는다. Maroo Testnet을 중심에 두고, 실제 Maroo Path B 두 건은 `[Live Testnet]` 포함 후 revert, 참가자가 직접 수행하는 Clairveil `x/privacy`는 구현 참고용 `[Local]`로 표시한다. 유효 Maroo proof·직원 지급·감사 검증이 빠졌다는 경계를 화면에 고정한다.

## 권장 타임라인

| 시간 | 화면 | 확인할 메시지 |
|---|---|---|
| 00:00–00:35 | persona와 300=100+120+80 plan | Maroo Testnet 정본 목표와 company signer/employee scanner 역할 |
| 00:35–01:05 | 공통 환경 readiness | Bun·Go·Git·Foundry 전체와 Clairveil SHA가 준비됐다는 marker; Anvil 실습이 아님 |
| 01:05–01:40 | Maroo read-only preflight | chain/balance/PCL raw state; state change 아님 |
| 01:40–02:50 | Clairveil 정상 급여 | actual `x/privacy` 300uclair deposit·one-proof EMP-A/B/C 100/120/80uclair batch·distinct scan |
| 02:50–03:35 | 공개/직원 관찰과 실패 control | public event vs employee scan, `300→301` proof 전 거부, EMP-B→EMP-C `120` tx 성공·급여 실패 |
| 03:35–04:35 | Maroo Path B evidence와 explorer | deposit→transfer 두 tx의 `status=0`, block, target; 유효 proof 성공 아님 |
| 04:35–05:15 | receipt·직원 delivery 경계 | Clairveil scan은 성공했지만 Path B에서는 Maroo note가 생기지 않음; Maroo scanner 미검증 |
| 05:15–06:05 | 구현 대응 관계 | PCL/Privacy/application 경계와 employee-address registry·plan/output binding 해결책 |
| 06:05–07:00 | exit ticket·4~8주 | prover/VK, PCL/EAS, custody, scanner owner와 production gaps |

## 녹화 전 체크

- 새 브라우저 프로필과 새 터미널을 쓴다.
- `.env`, private key, mnemonic, witness, employee/auditor private material, KYC 개인정보가 화면에 나오지 않는다.
- `grep -RInE 'COMPANY_PRIVATE_KEY=|PRIVATE_KEY=|mnemonic|seed phrase|Authorization: Bearer' evidence/` 결과를 확인한다.
- 영상 tx hash와 [README testnet evidence](README.md#7-testnet-transactionevidence), [Validation 기록](SUBMISSION_NOTES.md#23-실행-기록)이 같다.
- Clairveil local 정상 급여·두 control, Maroo 포함 후 revert, Maroo scanner 미검증을 별도 장면으로 보여 주고 full Maroo delivery로 합치지 않는다.
- 실패 화면에는 UTC, 환경, 원문 오류, 재현 명령이 보인다.

## 제출 전 링크 검증

현재 URL·공개 범위·녹화 기준 commit은 반영됐다. 영상을 300~480초로 편집한 뒤 길이 값을 바꾸고 다음 검사를 실행한다.

```bash
bun run demo/scripts/check-submission.ts --final
```

허용 길이는 300~480초다. 최종 검사는 이 문서의 값, README 영상 URL, actual Path B evidence, SUBMISSION_NOTES, git history와 현재 파일의 비밀 패턴을 함께 확인한다. `FINAL SUBMISSION CHECK PASSED`가 나오기 전에는 제출 완료로 표시하지 않는다.
