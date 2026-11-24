# Interest Deposit

Place private notes into a whitelisted reserve, and return that underlying to a private address.

## Register the records

Register Interest Deposit records on the state bridge when you create the client. Save the chain index, the G address, the Blend pool, and the reserve. Read the share balance from the Adapter when you show the underlying amount.

```ts
import {
  bindBlendInterestDeposits,
  saveInterestDeposit,
} from '@arcanetech/privacy-sdk-blend';

bindBlendInterestDeposits(client.state.bridge);

await saveInterestDeposit(client.state.bridge, {
  chainIndex: 0,
  account: 'G...',
  blendPool: 'C...',
  reserve: 'C...',
});
```

## Place one deposit

Derive the next free account for the spend scalar, the Blend pool, and the token. Prepare the pool withdrawal first. Pass its artifacts to `placementTransaction`. The relay pays the public-withdrawal fee and creates the account.

```ts
import {
  nextInterestDeposit,
  placementTransaction,
} from '@arcanetech/privacy-sdk-blend';

const next = await nextInterestDeposit({
  spendScalar,
  blendPoolContractId,
  tokenContractId,
  recorded,
});

const placement = await placementTransaction({
  spendScalar,
  blendPoolContractId,
  tokenContractId,
  chainIndex: next.chainIndex,
  amount,
  publicSignals,
  ciphertext,
  proof,
  adapterContractId,
  blendPool,
  reserve,
  poolContractId,
  relayAccount,
  networkPassphrase,
  sourceSequence,
  signatureExpirationLedger,
  kytExpirationLedger,
  kytSignature,
  applicationIdHints,
  recordedShares,
  exchangeRate,
});
```

## Return one deposit

Prepare a pool deposit whose `from` is the Adapter and whose fee follows the public-withdrawal schedule. Sign `returnTransaction` with the spend scalar that owns that chain index. The relay account is the envelope source.

```ts
import { returnTransaction } from '@arcanetech/privacy-sdk-blend';

const returned = await returnTransaction({
  legs: [{ spendScalar, chainIndex, amount }],
  blendPoolContractId,
  tokenContractId,
  publicSignals,
  ciphertext,
  proof,
  adapterContractId,
  blendPool,
  reserve,
  poolContractId,
  relayAccount,
  networkPassphrase,
  sourceSequence,
  signatureExpirationLedger,
  kytExpirationLedger,
  kytSignature,
  applicationIdHints,
});
```

## Restore

Walk every spend scalar and enabled pair. Keep a record whose share balance is zero. Stop a chain at the first index the Adapter has not recorded. `exchangeRate` is the reserve's `b_rate`.

```ts
import { restoreInterestDeposits } from '@arcanetech/privacy-sdk-blend';

const deposits = await restoreInterestDeposits({
  spendScalars,
  markets: [{ blendPoolContractId, tokenContractId, exchangeRate }],
  recorded,
  shares,
});
```
