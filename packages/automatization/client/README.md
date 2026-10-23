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

`depositAmount` is 10. `account` is `bob-account`. `amount` is 6. `pinnedInputs` is the Remainder. `pinnedOutputs` is the next pinned note. `freeTokens` is 1. `executed` is true because that transfer's pinned input nullifier is consumed and its pinned output commitment is in the pool tree. `blocked` is false.

## What the view shows

Each Row stays in Plan order. A Deposit shows its public amount and its Step. A Payout shows the Stellar account, the public amount, the transfer Step, and the withdrawal Step.

Each Step shows its pinned input notes, its pinned output notes, and Free tokens as an amount. A Remainder is one of those pinned notes. Executed and blocked come from that Step's pinned nullifiers and pinned commitments in the report you pass.

The view has no Service scalar and no Execution material. Fee notes and Unspent notes are not inputs. You pass the presence report.

## Related docs

- [Plan package README](../plan/README.md)
- [Root README](../../../README.md)
- [Packages](../../../docs/overview/packages.mdx)
