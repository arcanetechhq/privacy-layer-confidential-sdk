# @arcanetech/privacy-sdk-automatization-plan

Read whether a Plan is funded, which Step is underfunded, and whether a Step is executed or blocked.

## Install

```bash
npm install @arcanetech/privacy-sdk-automatization-plan
```

## Check a Plan

Build one Deposit and one Payout. Read each pinned note's plaintext, commitment, and nullifier hash. Read Free tokens and the interval from each Step. Read the account and public amount from the Payout. Set `transactionId` only after that Step is submitted.

```ts
import {
  isBlockedStep,
  isExecutedStep,
  isFundedPlan,
  underfundedSteps,
  type PinnedNotePresence,
  type Plan,
} from '@arcanetech/privacy-sdk-automatization-plan';

const remainder = {
  plaintext: { amount: 8n, accumulator: 'pin-transfer' },
  commitment: 'commitment-remainder',
  nullifierHash: 'nullifier-remainder',
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
        transactionId: 'tx-deposit',
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
        pinnedOutputs: [
          {
            plaintext: { amount: 7n, accumulator: 'pin-withdrawal' },
            commitment: 'commitment-after-transfer',
            nullifierHash: 'nullifier-after-transfer',
          },
        ],
      },
      withdrawal: {
        freeTokens: 1n,
        interval: 0n,
        pinnedInputs: [],
        pinnedOutputs: [],
      },
    },
  ],
};

const payout = plan.rows[1];
if (payout?.kind !== 'payout') {
  throw new Error('expected a Payout');
}

const presence: PinnedNotePresence = {
  consumedNullifierHashes: ['nullifier-remainder'],
  outputCommitmentsInPoolTree: ['commitment-after-transfer'],
};

const funded = isFundedPlan(plan);
const shortfalls = underfundedSteps(plan);
const executed = isExecutedStep(payout.transfer, presence);
const blocked = isBlockedStep(payout.transfer, presence);
```

`funded` is true because the Deposit of 10 equals the Payout of 6 plus Free tokens 2, 1, and 1. `shortfalls` is empty. `executed` is true because that transfer's pinned input nullifier is consumed and its pinned output commitment is in the pool tree. `blocked` is false.

## What the document stores

Each pinned note stores its plaintext, commitment, and nullifier hash. The plaintext stores the amount and the accumulator. It does not store an owner scalar.

Each Step stores its Free tokens and its interval. Each Payout stores its account and its public amount. A Step stores `transactionId` after it is submitted. Omit `transactionId` until then.

Fee notes and Unspent notes are not stored on the Plan. They are not part of the executed check. This package does not query a chain.

## Related docs

- [Root README](../../../README.md)
- [Packages](../../../docs/overview/packages.mdx)
