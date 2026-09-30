# Privacy Layer SDK

English-language monorepo for the Arcane high-level privacy SDK.

## Table of Contents

- [Packages](#packages)
- [Requirements](#requirements)
- [Getting Started](#getting-started)
- [Repository Commands](#repository-commands)
- [Documentation](#documentation)
- [Release Process](#release-process)
- [Package READMEs](#package-readmes)

## Packages

| Package                                                           | Description                                                                                   |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [`@arcanetech/privacy-sdk-core`](./packages/core/README.md)       | Network-agnostic intents, prepared operations, errors, progress events, and adapter contracts |
| [`@arcanetech/privacy-sdk-relay`](./packages/relay/README.md)     | Chain-agnostic protocol relay runtime (admission, polling, retry, fallback) over caller-supplied ports |
| [`@arcanetech/privacy-sdk-stellar`](./packages/stellar/README.md) | Stellar preset with browser and Node entrypoints                                              |

## Requirements

- Node.js `>=20.10`
- npm workspaces

## Getting Started

```bash
npm install
npm run verify
```

Example browser usage:

```ts
import {
  createStellarPrivacyClient,
  isStellarPrivacyClient,
} from '@arcanetech/privacy-sdk-stellar';
import { isPreparedOperation } from '@arcanetech/privacy-sdk-core';

const clientOrRejected = await createStellarPrivacyClient({
  network: {
    id: 'testnet',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
    poolContract: 'C-POOL',
    registryContract: 'C-REGISTRY',
    applicationId: '101',
  },
  wallet,
  storage,
  assets: {
    sdkWasm: await fetch('/assets/client_sdk_wasm_bg.wasm').then((r) =>
      r.arrayBuffer(),
    ),
  },
});

if (!isStellarPrivacyClient(clientOrRejected)) {
  throw new Error(clientOrRejected.errors.map((error) => error.message).join('; '));
}

const operation = await clientOrRejected.deposit(intent);

if (!isPreparedOperation(operation)) {
  throw new Error(operation.errors.map((error) => error.message).join('; '));
}

await operation.execute();
```

## Repository Commands

| Command                    | Purpose                                         |
| -------------------------- | ----------------------------------------------- |
| `npm run build`            | Build all workspace packages                    |
| `npm run test`             | Run unit and type tests                         |
| `npm run typecheck`        | Run TypeScript project references               |
| `npm run lint`             | Run ESLint                                      |
| `npm run fallow:dead-code` | Run dead-code scan                              |
| `npm run fallow:dupes`     | Run duplication scan                            |
| `npm run verify`           | Lint, typecheck, test, build, and Fallow checks |

## Documentation

Mintlify docs live under [`docs/`](./docs). Start at [Introduction](./docs/overview/introduction.mdx). Run the local preview from the `docs` directory:

```bash
cd docs
mint dev
```

Site configuration is in [`docs/docs.json`](./docs/docs.json). The repository root [`docs.json`](./docs.json) mirrors navigation paths for hosted deployment.

## Release Process

- Conventional Commits drive version, dist-tag, and publish selection through `scripts/release-dry-run.sh`.
- Pull requests against `development` or `v1` rehearse that script in dry-run mode (no registry write).
- Pushes to `development` or `v1` (and manual v1 promotion) publish through the same script via `.github/workflows/release.yml`.

## Package READMEs

- [Core package README](./packages/core/README.md)
- [Relay package README](./packages/relay/README.md)
- [Stellar package README](./packages/stellar/README.md)
