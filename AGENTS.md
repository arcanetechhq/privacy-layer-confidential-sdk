## Learned User Preferences

- Keep all repository rules and agent guidance in English.
- Do not add React or NestJS-specific ESLint rules to this repository.
- Do not bypass lint or Fallow checks by weakening config files or adding disable comments.
- Do not add ptau files to this repository. Groth16 zkey/VK regeneration belongs in `soroban-privacy-pools` using its existing `circuits/ptau/` file; never regenerate ptau.
- Public Mintlify/docs cover only `@arcanetech/privacy-sdk-*` packages; do not document `@arcanetech/stellar-privacy-pool-zk-sdk`, ZK/circuit/proving internals, or state-bridge implementation details—use adapter-library and "transaction preparation" wording instead.
- SDK Mintlify docs describe the Stellar integration (`@arcanetech/privacy-sdk-stellar`). Do not use "multi-chain", "chain-agnostic", "network-agnostic", "first shipped preset", or "future chains will ship". Describe shared packages (core, relay, state-*) by what they do. Keep "network preset" only as the name of the Stellar package.
- SDK docs use Stripe-style developer voice: open with the outcome, then the step; second person; active voice; one idea per sentence; imperative headings; code immediately after the instruction. Warn only when a mistake is expensive (fixture IDs vs a live stand, demo audit key, Node engine). Do not hedge ("learning exercise", "not a production app layout") or sell architecture ("extensibility").
- SDK docs must not name internal backend products or concrete REST endpoint paths; describe integrations generically (e.g. asset catalog sync, registry status).
- State-integration docs should lead with in-memory adapter examples and keep Redux as an optional adapter path; omit custom-adapter outline sections and do not mention `@arcanetech/privacy-sdk-testing` (not shipped).
- For internal workspace dependencies in npm workspaces, use `"*"` (not `workspace:*`, which npm does not support) so CI links local packages instead of resolving stale semver pins.
- With `exactOptionalPropertyTypes: true`, omit optional object properties instead of passing `undefined`; `StellarPreparedOperation` `kind` and `intent` are not a discriminated union—narrow with explicit casts after `kind` checks.

## Learned Workspace Facts

- `@arcanetech/privacy-sdk-stellar` owns generated pool/registry bindings under `packages/stellar/generated/`; public `.d.ts` must not export generated contract client types (`PoolTransactClient`, `RegistryContractClient`, `createPoolClient`).
- Public `StellarPrivacyClient` methods are domain-level (`checkRegistrationStatus`, `registerPrivateAddress`, `resolveTransferRecipient`, transaction confirmation/details) — not thin wrappers over raw Soroban RPC.
- Consuming apps pass domain config/adapters and `transactEnvironment.signTransaction` only; Soroban RPC, contract clients (`attachContractContext()` / `createPoolClient`), and raw RPC wrappers stay internal and must not appear in public API or app bootstrap. `transactEnvironment.zkArtifactBaseUrl` overrides the proving-artifact CDN baked into `@arcanetech/stellar-privacy-pool-zk-sdk` so local stands can serve files from disk.
- Monorepo scripts: root `typecheck:deps` builds `core` → `state-memory` → `state-redux` → stellar `bindings:build` before workspace typechecks (types from `dist/*.d.ts`); root `verify` is `lint → typecheck → build → test → fallow`; do not add per-package build hacks in stellar typecheck.
- State bridge operation registration (`stellarStateDefinitions` / `bridge.init`) runs inside SDK client initialization; consuming apps bind a state adapter but must not register bridge operations themselves.
- `StellarPrivateRecord.id` must always be the commitment hex (never a random UUID) and `owner` must always be the Stellar G-address (never a private `stpl1` address); `privateAddress` holds the stpl1 address separately. Deposit/transfer/withdraw output-record builders take an explicit `walletPublicKey` to set `owner` correctly. Withdraw's execute finalize must enrich `outputRecords` from `proof.changeCoin` (`commitmentHex`/`coinNote`) the same way transfer's `enrichTransferOutputRecords` does — otherwise change notes silently vanish from the UI because `mapPrivateRecordToCoinWithMetadata` drops records missing `coinNote`.
- SDK state reads/writes must be defensive: pool JSONPath reads (`getPoolMerkleState`) treat a missing `$.pools.*` branch as an empty cache (`undefined`) instead of throwing `JSONPath segment not found`; `upsertPrivateRecords` must be idempotent and skip the state-bridge write when the merged result is unchanged, to avoid infinite bidirectional sync loops with app-level state (e.g. a Redux coin slice that re-dispatches on every SDK write).
- Bootstrap and the transact engine must share exactly one `transactEnvironment` object instance (from `resolved.config.transactEnvironment`); never create a second copy (e.g. via `attachPoolStatePorts`) — resolvers (transfer recipient/token/wallet) registered on one copy are invisible to another and cause `"Transfer recipient resolver is not configured."`.
- Private record `amount` must be synced from the actual coin note value (`coinNote.value`), not recomputed via display-amount-to-stroops conversion; a mismatch lets prepare select a note that fails proof validation with `"Transfer amount exceeds note value"`.
- Canonical Stellar operation disclosure (validated in `packages/stellar/test/stellar-transfer-disclosure.test.ts`, aligned with Mintlify `docs/snippets/operation-disclosures.jsx`): deposit — sender/asset/amount public, recipient private; withdraw — sender may be public or private, recipient/asset/amount public; transfer to registered recipient — sender may be public or private, recipient/asset/amount private; transfer to unregistered/public-G recipient (escrow) — sender may be public or private, recipient/asset/amount **private** (documented product path; fully public G-recipient disclosure is also accepted by policy). Private sender and escrow send require Protocol Relay.
- SDK adapter method-existence checks on upstream objects (e.g. `@arcanetech/stellar-privacy-pool-zk-sdk`) must read the property from the instance/prototype chain, not `Object.hasOwn(sdk, name)` (which is `false` for prototype methods and causes false "Missing SDK method" errors); never use `Reflect`.
- `@arcanetech/privacy-sdk-stellar/transact` exports `assetLegToTokenAddress(assetHi, assetLo)` (symmetric to `tokenAddressToAssetLeg`) so callers can resolve a contract id back from hi/lo asset legs — needed because backend `/pending-claims` only returns `assetHiHex`/`assetLoHex`, not an `assetId` string.

## Repository Tooling

| Area            | Tooling                                                                        |
| --------------- | ------------------------------------------------------------------------------ |
| Workspace       | npm workspaces under `packages/*`                                              |
| Language        | TypeScript only for source, tests, and executable config                       |
| Build           | `tsup` per package                                                             |
| Tests           | Vitest unit tests and type tests                                               |
| Lint            | ESLint flat config in `eslint.config.mjs`                                      |
| Static analysis | Fallow dead-code and duplication scans via `fallow:dead-code` / `fallow:dupes` |
| Git hooks       | Lefthook pre-commit runs lint and Fallow checks                                |
| Docs            | English README files plus Mintlify docs in `docs/`                             |
| Releases        | Changesets on `main` (`latest`), `release/v0` (`v0`), and `release/v1` (`v1`). Developer steps are in `README.md`; branch cuts are in `RELEASING.md`. `.github/workflows/release.yml` publishes. |

## Package Boundaries

- `@arcanetech/privacy-sdk-core` must not depend on Stellar, Soroban, ZK, or `@arcanetech/stellar-privacy-pool-zk-sdk`. It is browser-first and must not import Node built-ins.
- `@arcanetech/privacy-sdk-stellar` main entry (`@arcanetech/privacy-sdk-stellar`) is browser-first: callers supply circuit artifacts as `ArrayBuffer`. Node filesystem loading lives only in `@arcanetech/privacy-sdk-stellar/node`. Test doubles live in `@arcanetech/privacy-sdk-stellar/testing`.
- `@arcanetech/stellar-privacy-pool-zk-sdk` is a browser-capable dependency when callers pass preloaded WASM/zkey buffers; do not rely on its Node filesystem fallbacks in browser integrations.
- `@arcanetech/privacy-sdk-testing` is planned but intentionally not shipped in this phase.

## Common Commands

```bash
npm install
npm run verify
npm run build
npm run test
npm run lint
npm run fallow:dead-code
npm run fallow:dupes
```

## Design Patterns Available In This Repository

Use these patterns when they match the integration boundary you are implementing:

| Pattern          | Prefer When                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| Composition      | Building clients from wallet, storage, network, and policy adapters without deep inheritance trees                    |
| Observer         | Emitting stable progress events through `ExecuteOptions.onEvent` during operation execution                           |
| Visitor          | Applying operation-specific validation or transformation without switching on `OperationKind` throughout the codebase |
| Factory          | Creating configured clients such as `createStellarPrivacyClient()` from environment-specific inputs                   |
| Abstract Factory | Providing browser and Node client factories that share orchestration but use different asset loaders                  |

See `.cursor/rules/design-patterns.mdc` for concise TypeScript examples and trigger guidance.

## Agent Guidelines

- Respect ESLint and Fallow checks.
- Keep core public API free of network-specific terminology.
- Keep private audit decoding keys out of public types, docs, and tests.
- Add English README and Mintlify docs updates when public API changes.
