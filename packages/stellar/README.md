# @arcanetech/privacy-sdk-stellar

Stellar preset for the Arcane privacy SDK.

## Overview

This package provides:

- `createStellarPrivacyClient()` for browser usage (preloaded `ArrayBuffer` assets)
- `@arcanetech/privacy-sdk-stellar/node` for Node.js filesystem asset loading
- `@arcanetech/privacy-sdk-stellar/testing` for fake transact engines in unit tests
- Stellar wallet, storage, and policy adapter contracts
- disclosure validation for currently supported Stellar routes
- `publicWithdraw()` spends one private note and pays its full value to the connected wallet. Sender, recipient, asset, and amount are public. `listPublicWithdrawNotes()` lists unspent notes from local state
- `assessIncomingNote()` reports whether a decrypted incoming note is spendable, still pending, or dead before you credit the balance
- orchestration over `@arcanetech/stellar-privacy-pool-zk-sdk`
- `requiredSubmissionMethod()` (`@arcanetech/privacy-sdk-stellar/transact`) — chooses Direct Submission vs Protocol Relay from a prepared operation; escrow sends require relay and refuse a positive public deposit; escrow sweeps use Direct Submission (wallet-signed)
- `buildBlindedRecipientTagChallengeMessage()` (`@arcanetech/privacy-sdk-stellar/transact`) — builds the wallet-signed challenge used to issue blinded recipient tags so a recipient can discover escrow notes after they register
- `fetchEscrowOutputNoteEvents({ transactEnvironment, txId, poolAddress })` — loads escrow output-note ciphertexts for a claim using the environment's network configuration
- `unsignedEscrowAuthorizationForSweep({ prepared, transactEnvironment, relayerPublicKey })` — simulates the relayer invocation and returns the unsigned claimant authorization entry to sign offline
- Protocol fee: deposit, transfer, and withdraw quote Required Fee and attach a private Fee Output (2×2 for deposit/withdraw, 6×6 for transfer with change). Escrow sweep does not attach a Fee Output.

## Browser Example

```ts
import {
  createStellarPrivacyClient,
  isStellarPrivacyClient,
} from '@arcanetech/privacy-sdk-stellar';

const clientOrRejected = await createStellarPrivacyClient({
  network,
  wallet,
  storage,
  assets: {
    sdkWasm,
  },
});

if (!isStellarPrivacyClient(clientOrRejected)) {
  throw new Error('Client creation failed');
}

const operation = await clientOrRejected.deposit(intent);
if (operation.status === 'prepared') {
  await operation.execute({ onEvent: console.log });
}
```

## Node Example

```ts
import { createStellarPrivacyClientFromNodeConfig } from '@arcanetech/privacy-sdk-stellar/node';

const clientOrRejected = await createStellarPrivacyClientFromNodeConfig({
  network,
  wallet,
  storage,
  assets: {
    sdkWasmPath: './assets/client_sdk_wasm_bg.wasm',
  },
});
```

## Required Assets

The Stellar preset loads proving artifacts from the CDN baked into `@arcanetech/stellar-privacy-pool-zk-sdk`. Pass `sdkWasm` (browser) or `sdkWasmPath` (Node). Override `transactEnvironment.zkArtifactBaseUrl` for local files. The browser bundle stores those proving files in Cache Storage (keyed by zk-sdk version) so a later visit or a second `init` in the same origin reuses the download. Node still reads files from disk or HTTP without Cache Storage. Custom circuit URLs are only for development. Do not regenerate `ptau` or Groth16 zkey files inside this repository.

## Related Docs

- [Root README](../../README.md)
- [Public withdraw](../../docs/application-development/how-to/public-withdraw.mdx)
- [State methods](../../docs/integration/data-sources.mdx)
