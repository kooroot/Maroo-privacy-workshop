# Prover·scanner·auditor adapter 계약

이 문서는 `IPrivacy`용 proof를 이 저장소가 임의로 만들지 않으면서도 외부 wallet/prover/scanner를 워크숍 도구에 안전하게 연결하기 위한 최소 계약이다. Maroo 테스트넷과 호환되는 VK·회로·암호화 포맷은 해당 adapter 제공자가 입증해야 한다. 이 계약을 만족하는 JSON만으로 그 호환성이 증명되지는 않는다.

## 1. 공통 원칙

- 모든 금액은 18 decimals의 base-unit 십진 문자열이다. JavaScript number를 쓰지 않는다.
- 모든 binary는 `0x` 접두사가 있는 짝수 길이 hex다.
- `calldata`는 adapter가 `@maroo-chain/contracts@0.0.8`의 정확한 ABI로 인코딩한다.
- witness, note plaintext, spending key, viewing private key, 개인키, bearer token은 JSON에 넣지 않는다.
- `planDigest`는 [payroll-plan.json](fixtures/payroll-plan.json)을 key-sorted JSON으로 직렬화해 SHA-256 한 `sha256:<hex>`다. 계산은 `shared/contracts.ts`가 담당한다.
- adapter가 실제 Maroo 호환성을 확인하기 전에는 `label="[Simulation]"`, `broadcastable=false`로 낸다.

계획 digest는 다음 명령으로 확인할 수 있다.

```bash
bun run demo/scripts/plan-digest.ts --plan demo/fixtures/payroll-plan.json
```

## 2. prepared transaction

공통 envelope:

```json
{
  "schema": "maroo-workshop/prepared-transaction@1",
  "label": "[Live Testnet]",
  "kind": "deposit",
  "generatedBy": "wallet-adapter-name@version+commit",
  "broadcastable": true,
  "chainId": 450815,
  "to": "0x100000000000000000000000000000000000000b",
  "valueWei": "300000000000000000000",
  "calldata": "0x...",
  "planDigest": "sha256:...",
  "public": {}
}
```

### 2.1 deposit bundle

- `kind`: `deposit`
- `valueWei`: 계획 총액과 정확히 같아야 한다.
- `calldata` selector: `0xe6eb7771`, 즉 `deposit((bytes,bytes,bytes))`.
- `public`: `noteCommitment`(32 bytes), `encryptedNoteDigest`(32 bytes), `proofDigest`(32 bytes).

```json
{
  "public": {
    "noteCommitment": "0x...32 bytes...",
    "encryptedNoteDigest": "0x...32 bytes...",
    "proofDigest": "0x...32 bytes..."
  }
}
```

### 2.2 payroll batch bundle

- `kind`: `payroll-batch`
- `valueWei`: `"0"`.
- `calldata` selector: `0x3bbb329b`, 즉 `singleProofBatchTransfer((bytes,bytes,bytes[],(bytes,bytes,bytes,uint32,uint8,bytes,bytes,bytes,bytes,bytes,bytes)[],string,uint64,bytes,uint64))`.
- `expiresAtUnix`: 검증 시각보다 60초 넘게 남아야 한다.
- `public.inputCount`: 1~16, `public.outputCount`: 정확히 3.
- `public.outputs`: EMP-A/B/C와 index 0/1/2가 일대일로 연결돼야 한다.
- digest 필드는 원문 ciphertext/proof/audit payload를 공개하지 않고 결합 여부를 확인하기 위한 값이다.
- 각 `profileRef`는 실행 시점의 승인된 employee↔shielded-address registry entry를 가리켜야 한다. adapter는 해당 entry의 shielded spend/view key가 실제 output note와 결속됐음을 확인한 뒤에만 `broadcastable=true`를 낸다.
- 이 저장소의 validator는 plan과 adapter가 보고한 `profileRef` 일치를 검사하지만 encrypted output 내부의 recipient를 독립 복호화할 수 없다. 따라서 adapter version/commit, registry version과 scanner 재검증이 Maroo live 준비 게이트다.

```json
{
  "expiresAtUnix": 2000003600,
  "public": {
    "root": "0x...32 bytes...",
    "inputCount": 1,
    "outputCount": 3,
    "nullifierDigests": ["0x...32 bytes..."],
    "outputs": [
      {
        "index": 0,
        "employeeId": "EMP-A",
        "profileRef": "workshop-profile://company-01/emp-a",
        "amountBaseUnits": "100000000000000000000",
        "commitment": "0x...32 bytes...",
        "ciphertextDigest": "0x...32 bytes..."
      }
    ],
    "auditKeyId": "workshop-auditor",
    "auditKeyEpoch": 1,
    "auditPayloadDigest": "0x...32 bytes..."
  }
}
```

## 3. employee scan report

직원마다 별도 scanner profile로 report 한 개를 만든다. 세 report가 같은 파일이거나 같은 `profileRef`를 쓰면 통과로 보지 않는다.

```json
{
  "schema": "maroo-workshop/employee-scan@1",
  "label": "[Live Testnet]",
  "employeeId": "EMP-A",
  "profileRef": "workshop-profile://company-01/emp-a",
  "planDigest": "sha256:...",
  "txHash": "0x...32 bytes...",
  "status": "owned",
  "outputIndex": 0,
  "amountBaseUnits": "100000000000000000000",
  "commitment": "0x...32 bytes..."
}
```

scanner는 view tag만 믿지 않고 decrypt한 NoteV1 commitment를 재계산해 on-chain output과 맞춰야 한다. 이 검증이 없으면 `status="owned"`를 내지 않는다.

## 4. audit report

```json
{
  "schema": "maroo-workshop/audit-report@1",
  "label": "[Live Testnet]",
  "status": "verified",
  "planDigest": "sha256:...",
  "txHash": "0x...32 bytes...",
  "employeeIds": ["EMP-A", "EMP-B", "EMP-C"],
  "totalBaseUnits": "300000000000000000000",
  "auditKeyId": "workshop-auditor",
  "auditKeyEpoch": 1,
  "disclosureDigest": "0x...32 bytes..."
}
```

감사 도구는 payload decrypt 성공뿐 아니라 plaintext에서 disclosure digest와 총액을 다시 계산한 뒤 `verified`를 낸다. 키 ID/epoch 불일치는 실패다.

## 5. 소비자 명령과 fail-closed 규칙

```bash
bun run demo/scripts/validate-request.ts \
  --plan demo/fixtures/payroll-plan.json \
  --bundle evidence/live-testnet/deposit-bundle.json --live

bun run demo/scripts/run.ts --target maroo-testnet --action submit \
  --plan demo/fixtures/payroll-plan.json \
  --bundle evidence/live-testnet/deposit-bundle.json \
  --env demo/.env
```

두 번째 명령은 기본적으로 `eth_estimateGas`만 한다. `--broadcast`를 명시해야 상태를 변경한다. 다음 중 하나라도 있으면 제출 전에 종료한다.

- selector, chain id, target, `msg.value` 불일치
- plan digest 불일치
- EMP-A/B/C 중복·누락 또는 `outputCount != 3`
- 승인된 plan의 `profileRef`와 registry에서 resolve한 실제 shielded recipient 불일치
- 만료 또는 60초 이하 여유
- `[Simulation]` bundle 또는 `broadcastable=false`

라이브 tx 이후에는 [demo runbook](README.md#6-증거-대사)의 명령으로 receipt, 직원 scan report 3개, audit report를 한 번에 대사한다.
