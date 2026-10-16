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

Pass the Zod schemas, data type, and protocol for your records.

```ts
import type { DataAuthorizer } from '@arcanetech/privacy-sdk-core';
import { createPrivateDataProvider } from '@arcanetech/privacy-sdk-data-layer';
import { z } from 'zod';

const privateDataOrigin = 'https://private-data.example';
const accountId = 'acct-1';

const recordSchema = z.object({
  id: z.string(),
});

const completionSchema = z.object({
  tags: z.array(z.object({ epoch: z.number(), tag: z.string() })),
});

const authorizer: DataAuthorizer = {
  async authorize(challenge) {
    const signature = await wallet.signMessage(challenge.message);
    return {
      protocol: challenge.protocol,
      fields: { signature },
    };
  },
};

const records = createPrivateDataProvider({
  origin: privateDataOrigin,
  dataType: 'example.record',
  recordSchema,
  completionSchema,
  protocol: 'example.protocol',
  authorizer,
});

const notes = await records.find({ account: accountId });
```

`wallet.signMessage` stands in for the signer that proves `challenge.message`. Set `protocol` to the protocol that signer returns. This package checks the proof, then sends it.

Substitute `fetch` in tests. A schema rejection fails the call, so you only receive a full list.

## Related docs

- [Root README](../../README.md)
- [Packages](../../docs/overview/packages.mdx)
