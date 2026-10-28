# @arcanetech/privacy-sdk-automatization-plan

## 0.0.1

### Patch Changes

- 585ce3e: Share the Deposit invocation shape, bigint Plan JSON, and the pinned-output amount so the client and the automation service describe the same values.
- 6e69254: Share a Plan document a caller can read to see whether it is funded, which Step is underfunded, and whether a Step is executed or blocked. A Payout's transfer Step is present only when an intermediate Transfer is required.
