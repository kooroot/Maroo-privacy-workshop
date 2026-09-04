# Evidence Index

이 디렉터리는 실행 성격별 evidence를 분리한다. `[Live Testnet]`, `[Local]`, `[Simulation]`을 서로 대체하거나 합산해 더 높은 수준의 성공으로 표현하지 않는다.

## 제출 핵심 evidence

| 라벨 | 파일 | 직접 확인한 결과 | 경계 |
|---|---|---|---|
| `[Live Testnet]` | [state-change-attempt.json](live-testnet/state-change-attempt.json) | Maroo chain `450815`의 `IPrivacy.deposit`·`transfer` transaction을 실제 제출. 두 건 모두 포함 후 revert | ABI-valid invalid-proof probe이며 유효 proof, private deposit, 직원 지급 성공이 아님 |
| `[Live Testnet]` | [preflight.json](live-testnet/preflight.json) | 서로 다른 회사/직원 공개 계정, 잔액, OKRW, PCL, Privacy 상태 확인 | read-only이며 상태 변경 evidence가 아님 |
| `[Live Testnet]` | [doctor.json](live-testnet/doctor.json) | 공개 RPC chain, OKRW typed params, PCL global/Privacy policy 조회 | read-only이며 계정·잔액 준비를 증명하지 않음 |
| `[Local]` | [payroll-summary.json](local/payroll-summary.json) | Clairveil `x/privacy` 정상 3인 지급, 공개/직원 관찰, `300→301` 거부와 EMP-B→EMP-C 오지급 성공 | 75분 구현 참고 실습이며 `uclair`/Cosmos localnet·Maroo PCL/호환 증거가 아님 |

## Path B 공개 트랜잭션

| 호출 | 결과 | block | tx |
|---|---|---:|---|
| `IPrivacy.deposit` selector `0xe6eb7771`, value `1 wei` | `included-revert`; non-zero commitment 요구 | `17243931` | [0xaa3646…2c939](https://explorer-testnet.maroo.io/tx/0xaa36463028962fccb246897d45bf13e43f6ef3da3cb6522fe4d3bdc82bd2c939) |
| `IPrivacy.transfer` selector `0x43fd6967`, value `0` | `included-revert`; gas `1,000,000/1,000,000`, decoded reason 없음 | `17243934` | [0x3d3d6b…fb622](https://explorer-testnet.maroo.io/tx/0x3d3d6bbba494127e776a7014acbdc3e087b680a0190b642baf21bbdc87efb622) |

두 receipt의 `status=0`, sender, target `0x100000000000000000000000000000000000000b`, block과 calldata selector는 2026-09-04T01:21:22Z에 공개 RPC로 다시 확인했다. 정확한 UTC, 환경, signer 공개 주소, calldata 경계와 재현 명령은 aggregate JSON을 정본으로 사용한다.

## 아직 없는 evidence

- Maroo-compatible deposit proof와 성공 receipt/event.
- 1-input/3-output Maroo payroll batch 성공 receipt/event.
- EMP-A/B/C Maroo scanner report와 auditor disclosure 검증.
- 5~8분 walkthrough URL은 [video-link.md](../video-link.md)에 최종 반영한다.
