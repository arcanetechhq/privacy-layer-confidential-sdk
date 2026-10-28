# @arcanetech/privacy-sdk-automatization-client

Show a saved Plan and how far each Step has gone.

## Install

```bash
npm install @arcanetech/privacy-sdk-automatization-client
```

## Show Plan progress

Build one Deposit and one Payout.

```ts
import type { Plan } from '@arcanetech/privacy-sdk-automatization-plan';

const remainder = {
  plaintext: { amount: 8n, accumulator: 'pin-transfer' },
  commitment: 'commitment-remainder',
  nullifierHash: 'nullifier-remainder',
};

const afterTransfer = {
  plaintext: { amount: 7n, accumulator: 'pin-withdrawal' },
  commitment: 'commitment-after-transfer',
  nullifierHash: 'nullifier-after-transfer',
};

const plan: Plan = {
  rows: [
    {
      kind: 'deposit',
      amount: 10n,
      step: {
        freeTokens: 2n,
        interval: 0n,
        pinnedInputs: [],
        pinnedOutputs: [remainder],
      },
    },
    {
      kind: 'payout',
      account: 'bob-account',
      amount: 6n,
      transfer: {
        freeTokens: 1n,
        interval: 0n,
        pinnedInputs: [remainder],
        pinnedOutputs: [afterTransfer],
      },
      withdrawal: {
        freeTokens: 1n,
        interval: 0n,
        pinnedInputs: [afterTransfer],
        pinnedOutputs: [],
      },
    },
  ],
};
```

Pass that Plan and a report of which pinned nullifiers are consumed and which pinned commitments are in the pool tree.

```ts
import type { PinnedNotePresence } from '@arcanetech/privacy-sdk-automatization-plan';
import { planProgress } from '@arcanetech/privacy-sdk-automatization-client';

const presence: PinnedNotePresence = {
  consumedNullifierHashes: ['nullifier-remainder'],
  outputCommitmentsInPoolTree: ['commitment-after-transfer'],
};

const progress = planProgress(plan, presence);
```

Read the Deposit amount. Read the Payout account and public amount. Read the transfer Step's pinned notes and Free tokens. Read whether that Step is executed or blocked.

```ts
const deposit = progress.rows[0];
const payout = progress.rows[1];
if (deposit?.kind !== 'deposit' || payout?.kind !== 'payout') {
  throw new Error('expected a Deposit and a Payout');
}

const depositAmount = deposit.amount;
const account = payout.account;
const amount = payout.amount;
const pinnedInputs = payout.transfer.pinnedInputs;
const pinnedOutputs = payout.transfer.pinnedOutputs;
const freeTokens = payout.transfer.freeTokens;
const executed = payout.transfer.executed;
const blocked = payout.transfer.blocked;
```

`depositAmount` is 10. `account` is `bob-account`. `amount` is 6. `pinnedInputs` is the Remainder. `pinnedOutputs` is the next pinned note. `freeTokens` is 1. `executed` is true. That transfer's pinned input nullifier is consumed. Its pinned output commitment is in the pool tree. `blocked` is false.

## Read the progress view

Each Row stays in Plan order. A Deposit shows its public amount. A Deposit shows its Step. A Payout shows the Stellar account. A Payout shows the public amount. A Payout shows the transfer Step. A Payout shows the withdrawal Step.

Each Step shows its pinned input notes. Each Step shows its pinned output notes. Each Step shows Free tokens as an amount. A Remainder is one of those pinned notes. Executed comes from that Step's pinned nullifiers in the report you pass. Executed also requires that Step's pinned commitments in the same report. Blocked comes from that report.

The view has no Service scalar. The view has no Execution material. Fee notes are not inputs. Unspent notes are not inputs. You pass the presence report.

## Ask an automation service

`createPlanClient` sends Stellar accounts and amounts. Floor, interval, pool, asset, and the Service scalar stay on the service. Amounts you pass are `bigint`. The Plan you get back uses `bigint`. Call `coverFees` before you sign a Deposit. It raises any Step whose Fee quote is above its Free tokens.

```ts
import { createPlanClient } from '@arcanetech/privacy-sdk-automatization-client';

const client = createPlanClient({ baseUrl: automationServiceUrl });
const plan = await client.compose([
  { account: 'bob-account', amount: 30n },
  { account: 'carol-account', amount: 20n },
]);
const saved = await client.confirm(plan, sorobanAuthorization);
const loaded = await client.read(saved.id);
```

`reviseFreeTokens`, `insertDeposit`, `moveDepositAmount`, and `replaceStepInterval` return the next Plan. `initialDepositInvocation` and `depositToSign` return the root and the pinned output commitments to sign. When the service is submitting to a pool, those calls also return the Soroban auth entries to sign, and `authEntries` is present. A missing deposit-to-sign result means nothing is waiting. `authorizeDeposit` sends the signature. The client does not receive a stored authorization.

## Sign a Deposit

`createSecretDepositSigner` signs with a Stellar secret key. Replace it with your own `DepositSigner` when the page uses a wallet. `depositSigningMessage` is the text both signers cover.

```ts
import {
  createSecretDepositSigner,
  depositSigningMessage,
} from '@arcanetech/privacy-sdk-automatization-client';

const signer = createSecretDepositSigner({ secretKey });
const invocation = await client.initialDepositInvocation(plan);
const message = depositSigningMessage(invocation);
const sorobanAuthorization = await signer.sign(invocation);
```

## Read presence and the waiting Deposit

`readPinnedPresence` asks a `PoolView` which pinned nullifiers are consumed and which pinned commitments are in the tree. Pass that report to `planProgress`. `createSorobanPoolView` is one view. Tests can pass another view and open no socket.

`waitingDeposit` returns the row index of the Deposit that still needs a signature. Omit the invocation when nothing is waiting.

```ts
import {
  planProgress,
  readPinnedPresence,
  waitingDeposit,
} from '@arcanetech/privacy-sdk-automatization-client';

const presence = await readPinnedPresence(loaded, pool);
const progress = planProgress(loaded, presence);
const rowIndex = waitingDeposit(loaded, progress, await client.depositToSign(saved.id));
```

## Related docs

- [Plan package README](../plan/README.md)
- [Root README](../../../README.md)
- [Packages](../../../docs/overview/packages.mdx)
- [Offchain automatization](../../../docs/automatization/overview.mdx)
