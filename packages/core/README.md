# @arcanetech/privacy-sdk-core

Network-agnostic privacy SDK core for Arcane private payment flows.

## Overview

This package defines:

- operation intents for `deposit`, `transfer`, and `withdraw`
- prepared and rejected operation results
- typed runtime errors
- progress events
- wallet, storage, network, and policy adapter contracts
- a reusable `AdapterPrivacyClient` orchestrator
- a wide authorization envelope (`protocol`, `message`, `fields`) and `authorizePrivateData`, which rejects a payload that misses that shape before the authorizer runs

The core package intentionally contains no Stellar, Soroban, ZK, KYT, or low-level SDK dependencies.

## Quick Example

```ts
import {
  AdapterPrivacyClient,
  isPreparedOperation,
  type DepositIntent,
} from '@arcanetech/privacy-sdk-core';

const client = new AdapterPrivacyClient({ network, policy, storage, wallet });
const result = await client.deposit(
  intent satisfies DepositIntent<string, string, bigint>,
);

if (!isPreparedOperation(result)) {
  console.error(result.errors);
} else {
  await result.execute({ onEvent: console.log });
}
```

## Public API Boundaries

- Use intents to describe what the user wants to do.
- Use `PreparedOperation.execute()` only after preparation succeeds.
- Use adapter contracts to integrate a concrete network preset such as `@arcanetech/privacy-sdk-stellar`.

## Error Model

Runtime constraints are returned as structured `PrivacySdkError` values, including:

- `unsupported_disclosure`
- `missing_dependency`
- `invalid_intent`
- `insufficient_state`
- `user_rejected`
- `execution_error`

## Progress Events

Execution emits stable user-facing stages:

`validation`, `stateRead`, `authorization`, `preparation`, `policyCheck`, `submission`, `confirmation`, `storageCommit`

## Related Docs

- [Root README](../../README.md)
- [Mintlify core docs](../../docs/packages/core.mdx)
