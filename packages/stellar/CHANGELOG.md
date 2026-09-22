# Changelog

## [0.6.0](https://github.com/arcanetechhq/privacy-layer-confidential-sdk/compare/privacy-sdk-stellar-v0.5.4...privacy-sdk-stellar-v0.6.0) (2026-09-22)


### Features

* merkle tree state manegement methods ([c59111f](https://github.com/arcanetechhq/privacy-layer-confidential-sdk/commit/c59111f656c11943173713b84fc04f2b28274d8e))

## [0.5.4](https://github.com/arcanetechhq/privacy-layer-confidential-sdk/compare/privacy-sdk-stellar-v0.5.3...privacy-sdk-stellar-v0.5.4) (2026-09-18)


### Bug Fixes

* new repo refs ([56238e3](https://github.com/arcanetechhq/privacy-layer-confidential-sdk/commit/56238e326c97a1fb8dba0d74cd1a3bca860df0f4))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @arcanetech/privacy-sdk-core bumped from 0.3.0 to 0.3.1
  * devDependencies
    * @arcanetech/privacy-sdk-state-memory bumped from 0.2.2 to 0.2.3
    * @arcanetech/privacy-sdk-state-redux bumped from 0.2.2 to 0.2.3

## [0.5.3](https://github.com/arcanetechhq/privacy-layer-confidential-sdk/compare/privacy-sdk-stellar-v0.5.2...privacy-sdk-stellar-v0.5.3) (2026-09-18)


### Bug Fixes

* document protocol Fee Output on Stellar deposit, transfer, and withdraw ([ccc7cdc](https://github.com/arcanetechhq/privacy-layer-confidential-sdk/commit/ccc7cdc540cd29680f14ad0ed66eaa1fd39d3b9c))

## [0.5.2](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/compare/privacy-sdk-stellar-v0.5.1...privacy-sdk-stellar-v0.5.2) (2026-09-16)


### Bug Fixes

* budget safe commitments sync methods ([1f7f2e2](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/1f7f2e2257d8441aff3ae226642bbf3fa0ee2acf))

## [0.5.1](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/compare/privacy-sdk-stellar-v0.5.0...privacy-sdk-stellar-v0.5.1) (2026-09-14)


### Bug Fixes

* stellar zk sdk version bump ([a077b59](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/a077b5900410869572649f573f26f7747dd0f06f))

## [0.5.0](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/compare/privacy-sdk-stellar-v0.4.1...privacy-sdk-stellar-v0.5.0) (2026-09-14)


### Features

* implement browser caching for ZK artifacts in Stellar SDK ([1d1b29d](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/1d1b29d89f14b905afc28eab06c69f4311b8704c))


### Bug Fixes

* deadcode guard ([e48d9f5](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/e48d9f580e25afe8529914d3d32099aee2eef420))

## [0.4.1](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/compare/privacy-sdk-stellar-v0.4.0...privacy-sdk-stellar-v0.4.1) (2026-09-11)


### Bug Fixes

* format stellar imports so release verify can pass ([725c90d](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/725c90d3eb92f9a9b2cb473bc5719bf60ef49ca1))
* satisfy exactOptionalPropertyTypes in relay and stellar tests ([1e55ab6](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/1e55ab6205ba1fc4545a359f553eb0d04862c108))

## [0.4.0](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/compare/privacy-sdk-stellar-v0.3.0...privacy-sdk-stellar-v0.4.0) (2026-09-10)


### Features

* expose signer-independent Relay Transact Package V1 ([ccc7d95](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/ccc7d95ed3301413a0dba99e24e48b35c3ed8868))
* **stellar:** cut over transact to owner-bound notes and escrow recipient ([2b5a552](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/2b5a552b858bd944428013b6c086a5f834c32bf5))
* **stellar:** refuse transfers to unregistered recipients ([b072391](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/b072391a2aec7ac4fbf55e87e8002b80f290ae6b))
* Update Stellar SDK references and enhance documentation for artifact handling ([0ff2d29](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/0ff2d292721ad8ffed218833e60073aac54cf06a))


### Bug Fixes

* **stellar:** always pass escrow_recipient on pool transact ([821e6e9](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/821e6e98725419795da536430794df6302a0280c))
* **stellar:** reduce spend scalars into the BabyJub subgroup order ([150605a](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/150605a7e4066c27f2e95535463af21797932b73))
* **stellar:** resolve spend scalar when checking owner-bound nullifiers ([57c159b](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/57c159b124ac068cd93971822ffa792a10f9eb42))

## [0.3.0](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/compare/privacy-sdk-stellar-v0.2.3...privacy-sdk-stellar-v0.3.0) (2026-07-13)


### Features

* updated pool contract signature ([752cb04](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/752cb0427f440a2603caa92fdb7ca2e0ffc34942))


### Bug Fixes

* ci linter issues ([4e6f635](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/4e6f6359c48138684444466ea407cc41f6fc5194))
* **release:** add repository metadata for npm provenance ([d07fdeb](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/d07fdebd28d5bd6868d10651147023c85e1da02b))
* wire dual-note withdraw like transfer ([d731bf8](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/d731bf837f2dc021ff82a6e57d2ddc395aa04ead))
* wire dual-note withdraw like transfer ([5db1ba9](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/5db1ba9309763804be867950ef3f4bdca03a8964))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @arcanetech/privacy-sdk-core bumped from * to 0.3.0
  * devDependencies
    * @arcanetech/privacy-sdk-state-memory bumped from 0.2.1 to 0.2.2
    * @arcanetech/privacy-sdk-state-redux bumped from 0.2.1 to 0.2.2

## [0.2.3](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/compare/privacy-sdk-stellar-v0.2.2...privacy-sdk-stellar-v0.2.3) (2026-07-08)


### Bug Fixes

* verify script sequence change ([61af505](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/61af505ede320fd0225e7916aaf3508ad93c7e48))

## [0.2.2](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/compare/privacy-sdk-stellar-v0.2.1...privacy-sdk-stellar-v0.2.2) (2026-07-08)


### Bug Fixes

* type issues resolve ([8b90cca](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/8b90ccac669892b3657e8b71353e148b0fcc4094))

## [0.2.1](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/compare/privacy-sdk-stellar-v0.2.0...privacy-sdk-stellar-v0.2.1) (2026-07-08)


### Bug Fixes

* internal deps versions resolve ([d2a8a08](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/d2a8a080d5d826a7caaa537e5de1a68baa6ae6be))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @arcanetech/privacy-sdk-state-memory bumped from * to 0.2.1
    * @arcanetech/privacy-sdk-state-redux bumped from * to 0.2.1

## [0.2.0](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/compare/privacy-sdk-stellar-v0.1.0...privacy-sdk-stellar-v0.2.0) (2026-07-07)


### Features

* init commit ([4facb76](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/4facb764b599538e645453f164688b1bc8cdb7fd))
* init version ([ea94962](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/ea9496258209b465992f000088f422b781173b98))


### Bug Fixes

* rename packages organization ([5b55673](https://github.com/Polynom-Labs/privacy-layer-confidential-sdk/commit/5b556730bc87eba59ab8935470508ddd5ffe3d52))
