# Changelog

## 1.0.0

### Major Changes

- Raise every public package to the next major version.

## Unreleased

### Features

- require an explicit relay origin to enable Protocol Relay; unset origin Direct-submits and never calls the relayer
- bound settlement polling with backoff and a `settlement_timed_out` outcome

## [0.2.3](https://github.com/arcanetechhq/privacy-layer-confidential-sdk/compare/privacy-sdk-relay-v0.2.2...privacy-sdk-relay-v0.2.3) (2026-09-18)

### Bug Fixes

- new repo refs ([56238e3](https://github.com/arcanetechhq/privacy-layer-confidential-sdk/commit/56238e326c97a1fb8dba0d74cd1a3bca860df0f4))

## [0.2.2](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/compare/privacy-sdk-relay-v0.2.1...privacy-sdk-relay-v0.2.2) (2026-09-15)

### Bug Fixes

- enhance relay API URL handling and documentation ([e09a010](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/e09a0100694e817398f9ea9dd55328714602915b))

## [0.2.1](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/compare/privacy-sdk-relay-v0.2.0...privacy-sdk-relay-v0.2.1) (2026-09-11)

### Bug Fixes

- satisfy exactOptionalPropertyTypes in relay and stellar tests ([1e55ab6](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/1e55ab6205ba1fc4545a359f553eb0d04862c108))

## [0.2.0](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/compare/privacy-sdk-relay-v0.1.0...privacy-sdk-relay-v0.2.0) (2026-09-10)

### Features

- add chain-agnostic @arcanetech/privacy-sdk-relay package ([b83e635](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/b83e635313aec75d0ca7ae34bc89e0c140e0d2c5))

## [0.1.0](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/releases/tag/privacy-sdk-relay-v0.1.0) (2026-09-02)

### Features

- lift chain-agnostic protocol relay runtime into `@arcanetech/privacy-sdk-relay`
