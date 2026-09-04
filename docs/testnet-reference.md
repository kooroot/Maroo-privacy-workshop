# Maroo testnet reference

워크숍이 사용하는 network/address/ABI/error의 정본이다. 문서 값은 `[Docs Only]`, 실제 RPC 결과는 `evidence/live-testnet/`에 `[Live Testnet]`으로 기록한다. Docs와 체인 값이 다르면 체인 값을 임의 수정해 맞추지 말고 [SUBMISSION_NOTES](../SUBMISSION_NOTES.md#14-discrepancies)에 차이와 재현 명령을 남긴다.

## 1. Network

출처: [Testnet Access](https://docs.maroo.io/resources/network/testnet-access), [Maroo network parameters](https://docs.maroo.io/concepts/network/maroo-network-parameters) `[Docs Only]`.

| 항목 | 문서 값 | 확인 |
|---|---|---|
| JSON-RPC | `https://rpc-testnet.maroo.io` | `eth_chainId` |
| chain id | `450815` (`0x6e0ff`) | `cast chain-id` |
| explorer | `https://explorer-testnet.maroo.io` | `/tx/<hash>` |
| indexer | `https://explorer-testnet.maroo.io/blockscout/api/v2` | `/stats` |
| faucet | `https://faucet.maroo.io` | browser |
| mock KYC | `https://kyc-testnet.maroo.io` | browser |
| native test asset | `tOKRW`, 18 decimals | balance + `IOkrw.getParams()` |

```bash
set -a; source demo/.env; set +a
cast chain-id --rpc-url "$MAROO_RPC_URL"
cast balance --rpc-url "$MAROO_RPC_URL" "$COMPANY_ACCOUNT"
cast call --rpc-url "$MAROO_RPC_URL" "$MAROO_OKRW_PRECOMPILE" 'getParams()((address,string))'
```

denom 문자열은 문서에서 복사해 proof에 넣지 않고 `getParams()` 실제 응답과 adapter 규칙을 확인한다.

## 2. Precompile addresses

출처: [Deployed contracts](https://docs.maroo.io/resources/contracts/deployed-contracts), [Privacy precompile overview](https://docs.maroo.io/concepts/privacy/privacy-precompile-overview), `@maroo-chain/contracts@0.0.8` `[Docs Only]`.

| Interface | Address |
|---|---|
| `IOkrw` | `0x1000000000000000000000000000000000000001` |
| `IPcl` | `0x1000000000000000000000000000000000000005` |
| `IEas` | `0x1000000000000000000000000000000000000009` |
| `IAgent` | `0x100000000000000000000000000000000000000A` |
| `IPrivacy` | `0x100000000000000000000000000000000000000b` |

프리컴파일은 `eth_getCode`가 비어 있어도 동작할 수 있으므로 code length만으로 존재를 판정하지 않는다.

## 3. Privacy ABI

출처 파일: `@maroo-chain/contracts@0.0.8/precompiles/privacy/IPrivacy.sol` `[Docs Only]`.

### Deposit

```solidity
struct PrivacyDepositRequest {
  bytes noteCommitment;
  bytes encryptedNote;
  bytes proof;
}

function deposit(PrivacyDepositRequest calldata request)
  external payable returns (bool success);
```

- canonical tuple signature: `deposit((bytes,bytes,bytes))`.
- selector: `0xe6eb7771`.
- event: `PrivacyDeposit(address indexed effectiveSender,address indexed operator,string amount,bytes noteCommitment)`.
- event topic0: `0xe94fdc798d990ba081f57f5497bc5502379cc0db08b512c87d808678e51787c2`.
- amount는 `msg.value`의 Cosmos coin string이다([Privacy deposit](https://docs.maroo.io/apis/contract/contract-privacy-deposit)).

### Single-proof batch transfer

```solidity
struct PrivacySingleProofBatchTransferOutput {
  bytes commitment;
  bytes ciphertext;
  bytes viewTag;
  uint32 userPrivacyPolicy;
  uint8 userDisclosureMode;
  bytes userDisclosureDigest;
  bytes userDisclosureTargetPubkey;
  bytes userDisclosurePayload;
  bytes fullDisclosureDigest;
  bytes auditDisclosurePayload;
  bytes selfViewDisclosurePayload;
}

struct PrivacySingleProofBatchTransferRequest {
  bytes proof;
  bytes root;
  bytes[] nullifiers;
  PrivacySingleProofBatchTransferOutput[] outputs;
  string auditKeyId;
  uint64 auditKeyEpoch;
  bytes auditDisclosureTargetPubkey;
  uint64 expiresAtUnix;
}
```

- selector: `0x3bbb329b`.
- event: `PrivacySingleProofBatchTransfer(address indexed effectiveSender,address indexed operator,bytes32 indexed requestHash,bytes root,uint8 inputCount,uint8 outputCount)`.
- event topic0: `0x6d05fa8aae795dcf34d91bd04ddbba7216fd2c617658871a5bd696edf53e3c35`.
- 한 proof가 1..N input과 1..N output을 처리한다([single-proof batch transfer](https://docs.maroo.io/apis/contract/contract-privacy-single-proof-batch-transfer)).

selector/topic 재계산:

```bash
cast sig 'deposit((bytes,bytes,bytes))'
cast sig 'singleProofBatchTransfer((bytes,bytes,bytes[],(bytes,bytes,bytes,uint32,uint8,bytes,bytes,bytes,bytes,bytes,bytes)[],string,uint64,bytes,uint64))'
cast keccak 'PrivacyDeposit(address,address,string,bytes)'
cast keccak 'PrivacySingleProofBatchTransfer(address,address,bytes32,bytes,uint8,uint8)'
```

## 4. OKRW와 PCL read calls

| Call | selector | 의미 |
|---|---|---|
| `IOkrw.getParams()` | `0x5e615a6b` | minter, mint denom |
| `IPcl.policyAdmin()` | `0x58e51896` | global policy admin |
| `IPcl.globalPolicies()` | `0x9af4d161` | global policy config |
| `IPcl.contractPolicies(address)` | `0xd24d98d8` | target contract policy config |
| `IPcl.pclProxy(address)` | `0x777b5e8f` | proxy registration state |

```bash
cast call --rpc-url "$MAROO_RPC_URL" "$MAROO_PCL_PRECOMPILE" 'policyAdmin()(address)'
cast call --rpc-url "$MAROO_RPC_URL" "$MAROO_PCL_PRECOMPILE" 'globalPolicies()'
cast call --rpc-url "$MAROO_RPC_URL" "$MAROO_PCL_PRECOMPILE" \
  'contractPolicies(address)' "$MAROO_PRIVACY_PRECOMPILE"
```

struct return을 정확히 decode할 ABI가 없으면 raw hex를 evidence로 보존한다. 사람이 읽을 수 있는 문자열 조각만 보고 policy tree 전체를 단정하지 않는다.

<a id="pcl-reasons"></a>

## 5. PCL reason selectors

출처: [PCL reason codes](https://docs.maroo.io/concepts/compliance/pcl-reason-codes), `@maroo-chain/contracts@0.0.8/precompiles/pcl/IPcl.sol` `[Docs Only]`.

| selector | signature | 계층 |
|---|---|---|
| `0x08c379a0` | `Error(string)` | PCL typed reason이 아님; 실행기 문자열 오류 가능 |
| `0x1a152487` | `EasAttestationRequired(address)` | EAS policy |
| `0xbca5593e` | `EasNoAttestationReceived(address)` | EAS policy |
| `0x30d7cfd1` | `AnyOfRejected(bytes[])` | logical OR policy |
| `0x0201b218` | `InDenylist(address)` | denylist policy |
| `0x82b42900` | `Unauthorized()` | policy/admin operation |
| `0x6a2b23be` | `PolicyTemplateNotFound(string)` | policy configuration |

```bash
cast sig 'EasAttestationRequired(address)'
cast sig 'EasNoAttestationReceived(address)'
cast sig 'AnyOfRejected(bytes[])'
cast sig 'InDenylist(address)'
cast sig 'Unauthorized()'
```

실제 거부가 어느 selector를 반환하는지는 적용 policy와 입력 상태에 달렸다. dummy Privacy input은 policy보다 먼저 prepare 단계에서 실패할 수 있다.

### Private transfer의 PCL 판정 한계

- 모든 변경성 Privacy 호출은 policy-aware wrapper를 통해 PCL 평가를 받는다.
- 공개 deposit은 `msg.value`가 PolicyOperation의 실제 value가 되므로 활성 volume policy의 입력이 될 수 있다.
- private transfer의 숨겨진 금액은 PolicyOperation에서 `value=0`으로 모델링되므로 일반 volume policy로 직원별 비공개 금액 한도를 검증했다고 주장하지 않는다.
- `PrivacyTransferRequest`와 `PrivacySingleProofBatchTransferOutput`에는 공개 직원 EVM `recipient`가 없다. 정책상 허용되는 잘못된 shielded profile을 EMP-B 대신 넣는 업무 오류는 employee-address registry와 plan/output binding으로 제출 전에 차단하고 scanner reconciliation으로 사후 확인한다.
- 별도 recipient attestation/policy를 구현했다면 실제 contract policy 설정과 typed PCL rejection을 확인한 경우에만 그 차단을 PCL 성과로 기록한다.

근거는 [Privacy precompile overview](https://docs.maroo.io/concepts/privacy/privacy-precompile-overview), [policy-aware wrapper](https://docs.maroo.io/concepts/privacy/privacy-policy-aware-precompile), 설치된 `@maroo-chain/contracts`의 `IPrivacy.sol`이다. `[Docs Only]`

## 6. Receipt success criteria

### Deposit

- transaction `to` = Privacy precompile.
- transaction `input` = reviewed deposit bundle calldata.
- transaction `value` = `300000000000000000000`.
- receipt `status=0x1`.
- `PrivacyDeposit` event amount/commitment = bundle 값.

### Payroll batch

- transaction `to`와 exact input = reviewed payroll bundle.
- transaction value = 0.
- receipt `status=0x1`.
- `PrivacySingleProofBatchTransfer` root/inputCount = bundle 값.
- event `outputCount=3`.

receipt 성공은 employee delivery와 audit 완료를 뜻하지 않는다. [adapter report](../demo/adapter-contract.md#3-employee-scan-report)와 evidence reconciliation이 뒤따라야 한다.

## 7. Evidence 최소 필드

| 종류 | 필수 |
|---|---|
| preflight | label, UTC, chain id, company/employee public account, company balance, raw OKRW/PCL responses |
| submit | mode, selector, gas estimate, tx hash |
| receipt | exact kind/plan digest/tx/status/block/gas/event |
| employee scan | employee ID, output index, amount, commitment, tx/plan digest |
| audit | employee IDs, total, key ID/epoch, disclosure digest, tx/plan digest |
| failure | command, UTC, OS/tool version, exit status, raw error/data, recovery decision |

비밀정보 취급은 [SUBMISSION_NOTES Validation](../SUBMISSION_NOTES.md#2-validation)이 정본이다.
