# @arcanetech/privacy-sdk-data-layer

HTTP client for private records. You pass the schemas. The provider returns a value only after your schema accepts the payload.

## Overview

`createPrivateDataProvider` builds one provider with three methods:

- `find` — lists records for the attributes you pass.
- `createChallenge` — asks for an authorization challenge.
- `completeChallenge` — runs your authorizer, then sends the proof and returns the completion.

Pass `recordSchema` for `find`. Pass `completionSchema` when the flow has a proof. Omit `completionSchema` and both challenge methods stop before any request.

`@arcanetech/privacy-sdk-core` checks the authorization envelope before `authorize` runs. This package uses that check, so a challenge or proof that misses the envelope never becomes a request.

## Quick example

```ts
import { createPrivateDataProvider } from '@arcanetech/privacy-sdk-data-layer';
import {
  createStellarDataAuthorizer,
  STELLAR_ESCROW_INDEX_DATA_TYPE,
  stellarEscrowIndexRecordSchema,
  stellarEscrowTagCompletionSchema,
} from '@arcanetech/privacy-sdk-stellar';

const escrow = createPrivateDataProvider({
  origin: privateDataOrigin,
  dataType: STELLAR_ESCROW_INDEX_DATA_TYPE,
  recordSchema: stellarEscrowIndexRecordSchema,
  completionSchema: stellarEscrowTagCompletionSchema,
  protocol,
  authorizer: createStellarDataAuthorizer(messageSigner),
});

const notes = await escrow.find({ blindedRecipientTag: tag });
```

Pass the authorizer from `createStellarDataAuthorizer` into the provider, and set `protocol` to the protocol that authorizer returns. This package checks the proof, then sends it.

Substitute `fetch` in tests. A schema rejection fails the call, so you only receive a full list.

## Related docs

- [Root README](../../README.md)
- [Packages](../../docs/overview/packages.mdx)
