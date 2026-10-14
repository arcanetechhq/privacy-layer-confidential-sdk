import { describe, expect, it } from 'vitest';
import type { ExecuteOptions, NetworkAdapter, PolicyAdapter } from '../src/index.js';

type Address = string;
type Asset = string;

describe('adapter contracts', () => {
  it('accepts arbitrary adapter type parameters', () => {
    const wallet = {
      getAddress: async () => 'wallet-address' as Address,
      authorizeMessage: async () => new Uint8Array([1, 2, 3]),
      authorizePayload: async (payload: { signed: boolean }) => payload,
    };

    const storage = {
      listPrivateRecords: async () => [{ id: 'record-1' }],
      savePrivateRecords: async () => undefined,
      markPrivateRecordsUsed: async () => undefined,
    };

    const network: NetworkAdapter<
      Address,
      Asset,
      bigint,
      { prepared: true },
      { receipt: true }
    > = {
      prepareDeposit: async () => ({ prepared: true }),
      prepareTransfer: async () => ({ prepared: true }),
      prepareWithdraw: async () => ({ prepared: true }),
      preparePublicWithdraw: async () => ({ prepared: true }),
      submit: async () => ({ receipt: true }),
    };

    const policy: PolicyAdapter<Address, Asset, bigint> = {
      validateDeposit: async () => [],
      validateTransfer: async () => [],
      validateWithdraw: async () => [],
      validatePublicWithdraw: async () => [],
    };

    const options: ExecuteOptions = {
      onEvent: (event) => {
        expect(event.stage).toBeTypeOf('string');
      },
    };

    expect(wallet.getAddress).toBeTypeOf('function');
    expect(storage.listPrivateRecords).toBeTypeOf('function');
    expect(network.submit).toBeTypeOf('function');
    expect(policy.validateDeposit).toBeTypeOf('function');
    expect(options.onEvent).toBeTypeOf('function');
  });
});
