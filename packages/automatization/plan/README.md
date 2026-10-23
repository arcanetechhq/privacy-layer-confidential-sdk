# @arcanetech/privacy-sdk-automatization-plan

Read whether a Plan is funded, which Step is underfunded, and whether a Step is executed or blocked.

## Install

```bash
npm install @arcanetech/privacy-sdk-automatization-plan
```

## Check a Plan

Construct the Plan from Deposit and Payout rows. Pass a presence report when you already know which pinned nullifier hashes are consumed and which pinned output commitments are in the pool tree.

```ts
import {
  isBlockedStep,
  isExecutedStep,
  isFundedPlan,
  underfundedSteps,
} from '@arcanetech/privacy-sdk-automatization-plan';

const funded = isFundedPlan(plan);
const shortfalls = underfundedSteps(plan);
const executed = isExecutedStep(step, presence);
const blocked = isBlockedStep(step, presence);
```

A funded Plan has Deposits equal to its Payouts plus the Free tokens of every Step.

An Underfunded Step has pinned outputs and Free tokens that exceed the notes earlier Steps left for it, plus the Deposit on its own Row when that Row is a Deposit.

A Step is executed only when every pinned input nullifier is consumed and every pinned output commitment is in the pool tree. A Step that is not executed while at least one pinned input nullifier is consumed is blocked.

## What the document stores

Each pinned note stores its plaintext, commitment, and nullifier hash. The plaintext stores the amount and the accumulator. It does not store an owner scalar.

Each Step stores its Free tokens and its interval. Each Payout stores its account and its public amount. A Step stores `transactionId` after it is submitted. Omit `transactionId` until then.

Fee notes and Unspent notes are not stored on the Plan. They are not part of the executed check. This package does not query a chain.

## Related docs

- [Root README](../../../README.md)
- [Packages](../../../docs/overview/packages.mdx)
