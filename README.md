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

Publish from a pull request into the branch that owns the line. You do not edit `package.json` versions and you do not run `npm publish`.

| Branch | Dist-tag | What you can release |
| --- | --- | --- |
| `release/v0` | `v0` | Patch and minor fixes for major 0. The Stellar dependency on `@arcanetech/stellar-privacy-pool-zk-sdk` must stay inside major 0 (`>=0.11.0 <1.0.0`). |
| `release/v1` | `v1` | Patch and minor fixes for major 1. A `major` changeset is rejected. |
| `main` | `latest` | The current major. A major bump applies to every public package. |

1. Branch from `release/v0`, `release/v1`, or `main`.
2. Change the code, then run `npm exec changeset`. Choose `patch` or `minor`. On `release/v0` and `release/v1`, do not choose `major`.
3. Open a pull request into that same branch. CI checks package majors, that a changeset exists for package changes, and `npm run verify`.
4. After the pull request merges, review and merge the generated "Version Packages" pull request. That merge publishes to npm. The dist-tag comes from the branch name.

One publish does not ship every workspace package and does not give them the same version. Changesets bumps only the packages named in the changeset. A package that depends on a bumped package gets a patch bump, and its dependency pin is updated. Other packages stay on their current versions and are skipped, because those versions are already on npm. Minor and patch may differ across packages in that commit. Every public package on one branch still shares the same major.

Do not reuse a changeset file on another branch. A backport is a separate pull request with its own changeset.

Maintainer steps for cutting a new `release/vN`, the `1.0.0` / `1.1.0` split, and GitHub rulesets are in [RELEASING.md](./RELEASING.md).

## Package READMEs

- [Core package README](./packages/core/README.md)
- [Relay package README](./packages/relay/README.md)
- [Stellar package README](./packages/stellar/README.md)
