# @arcanetech/privacy-sdk-automatization-service

Compose a Plan and run its Steps. Fee quotes, proofs, inspection, and pool submission stay behind ports you pass in. Every port returns a `Promise`, except the note deriver.

## Install

```bash
npm install @arcanetech/privacy-sdk-automatization-service
```

## Compose a Plan

Pass the recipients, the Free-token floor, and the standard interval. Pass a note deriver. The result is a Plan. The floor, the interval, and the deriver stay with the caller. Mode `010` notes are created on the Initial Deposit when they fit, leaving slots for the fee note, Free tokens, and change. An intermediate Transfer is added only for the notes that do not fit. A later Deposit spends the Remainder and continues that chain.

```ts
import { compose } from '@arcanetech/privacy-sdk-automatization-service';

const plan = compose(
  {
    recipients: [
      { account: 'bob-account', amount: 30n },
      { account: 'carol-account', amount: 20n },
    ],
    freeTokenFloor: 2n,
    standardInterval: 7n,
  },
  notes,
);
```

Revise one Step with `reviseFreeTokens`. Insert a Deposit with `insertDeposit`. Move amount onto a later Deposit with `moveDepositAmount`. Change one interval with `replaceStepInterval`. Each call returns a new Plan. `coverFreeTokens` raises any Step whose Fee quote is above its Free tokens, and adds that increase to the covering Deposit.

## Confirm and run

`depositToSign` returns the Deposit invocation and the entries the depositor signs. `confirm` checks the Plan, asks the ports for a quote and a proof, and stores the Plan. `read` returns that Plan. `authorizeDeposit` stores a Deposit authorization for the Step that is due. `runDueSteps` submits each due Step. `submitNextStep` submits the next Step and ignores only its interval.

```ts
import {
  authorizeDeposit,
  confirm,
  createMemoryPlanStore,
  depositToSign,
  read,
  runDueSteps,
  submitNextStep,
} from '@arcanetech/privacy-sdk-automatization-service';

const store = createMemoryPlanStore();
const { invocation, authEntries } = await depositToSign(plan, { ...ports, store });
const id = await confirm(plan, { invocation, sorobanAuthorization }, { ...ports, store });
const saved = await read(id, store);

await authorizeDeposit(id, authorization, { ...ports, store });
await runDueSteps({ ...ports, store });
await submitNextStep(id, { ...ports, store });
```

`read` returns the Plan document. It does not return execution material or the Service scalar.

## Stores

`PlanStore` is seven role interfaces: registry, documents, step times, initial quotes, cancellation, Deposit material, and Unspent notes. Each use case takes only the roles it calls. `createMemoryPlanStore` is the in-memory store. To persist Plans, implement each role over your database and combine them with `composePlanStore`.

## Ports

| Import | Ships |
| --- | --- |
| `@arcanetech/privacy-sdk-automatization-service` | `systemClock`, `createDerivedNoteOwnership`, `createMemoryPlanStore`, `composePlanStore` |
| `@arcanetech/privacy-sdk-automatization-service/stellar` | `createStellarNoteDeriver`, `createSorobanPoolReader`, `createKytFeeQuotes`, `createStellarStepTransactions` (Node.js) |
| `@arcanetech/privacy-sdk-automatization-service/testing` | `createInMemoryPool`, `inMemoryNoteDeriver` |

`createStellarNoteDeriver` derives notes from your service secret and a note salt. Persist the salt for the life of every Plan you confirm.

## Related docs

- [Root README](../../../README.md)
- [Packages](../../../docs/overview/packages.mdx)
- [Offchain automatization](../../../docs/automatization/overview.mdx)
- [Service ports](../../../docs/automatization/reference/service-ports.mdx)
