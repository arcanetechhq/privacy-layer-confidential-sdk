import { describe, expect, it } from 'vitest';
import { createInMemoryStateAdapter } from '@arcanetech/privacy-sdk-state-memory';
import type { StateBridgeCall } from '@arcanetech/privacy-sdk-core/state';
import { createRecord, createTestClient } from './stellar-client.test-helpers.js';
import type { StellarAsset, StellarIncomingDelivery } from '../src/types.js';

const sampleAsset: StellarAsset = {
  id: 1,
  assetId: 'USDC',
  name: 'USD Coin',
  logoUrl: '',
  issuerAddress: 'G-ISSUER',
  clientContract: 'C-TOKEN',
  poolContracts: ['C-POOL'],
  poolContract: 'C-POOL',
  mintable: false,
  mintAmount: '',
  decimals: 7,
};

describe('StellarPrivacyClient asset catalog state', () => {
  it('stores and reads asset catalog', async () => {
    const { client } = await createTestClient();
    await client.replaceAssets([sampleAsset]);

    await expect(client.getAsset('USDC')).resolves.toMatchObject({
      assetId: 'USDC',
      clientContract: 'C-TOKEN',
    });
    await expect(client.getAssetsForPool('C-POOL')).resolves.toHaveLength(1);
    await client.upsertAssets([
      {
        ...sampleAsset,
        name: 'USD Coin Updated',
      },
    ]);
    await expect(client.getAsset('USDC')).resolves.toMatchObject({
      name: 'USD Coin Updated',
    });
  });
});

describe('StellarPrivacyClient balances and registry state', () => {
  it('stores public balances and registry lookups', async () => {
    const { client } = await createTestClient();
    await client.setPublicBalances({
      owner: 'G-OWNER',
      balances: [
        {
          owner: 'G-OWNER',
          asset: 'USDC',
          balance: '100.0',
          trustlineStatus: 'active',
        },
      ],
    });

    await expect(
      client.getPublicBalance({ owner: 'G-OWNER', asset: 'USDC' }),
    ).resolves.toMatchObject({
      balance: '100.0',
      trustlineStatus: 'active',
    });

    await client.saveRegistryLookup({
      owner: 'G-RECIPIENT',
      status: 'registered',
      privateAddressStpl1: 'stpl1recipient',
      publicKeyXHex: 'aa'.repeat(32),
      publicKeyYHex: 'bb'.repeat(32),
      cachedAt: '2026-01-01T00:00:00.000Z',
    });

    await expect(client.getRegistryLookup('G-RECIPIENT')).resolves.toMatchObject({
      status: 'registered',
      privateAddressStpl1: 'stpl1recipient',
    });
    expect(await client.isStellarAddressRegistered('G-RECIPIENT')).toBe(true);
    expect(await client.getCachedPrivateAddress('G-RECIPIENT')).toBe('stpl1recipient');
  });
});

describe('StellarPrivacyClient pool state', () => {
  it('treats missing pool merkle state as empty cache', async () => {
    const { client } = await createTestClient();

    await expect(client.getPoolMerkleState('C-POOL')).resolves.toBeUndefined();
    await client.appendPoolCommitments({
      poolContract: 'C-POOL',
      commitments: ['1'],
      merkleRootHex: 'root-a',
    });

    await expect(client.getPoolMerkleState('C-POOL')).resolves.toMatchObject({
      commitments: ['1'],
      merkleRootHex: 'root-a',
    });
  });

  it('stores pool merkle state and leaf ephemeral keys', async () => {
    const { client } = await createTestClient();
    await client.setPoolMerkleState({
      poolContract: 'C-POOL',
      commitments: ['1', '2'],
      commitmentCount: 2,
      merkleRootHex: 'root-a',
      updatedAt: 1,
    });
    await client.appendPoolCommitments({
      poolContract: 'C-POOL',
      commitments: ['3'],
      merkleRootHex: 'root-b',
    });

    await expect(client.getPoolMerkleState('C-POOL')).resolves.toMatchObject({
      commitments: ['1', '2', '3'],
      merkleRootHex: 'root-b',
    });

    await client.setLeafEphemeral({
      poolContract: 'C-POOL',
      leafIndex: 0,
      xHex: '11'.repeat(32),
      yHex: '22'.repeat(32),
    });
    await expect(
      client.getLeafEphemeral({ poolContract: 'C-POOL', leafIndex: 0 }),
    ).resolves.toMatchObject({
      xHex: '11'.repeat(32),
    });
  });

  it('persists sparse merkle nodes on append and hydrateState', async () => {
    const { client } = await createTestClient();
    const nodes = [{ level: 1, index: 0, value: '9' }];
    await client.setPoolMerkleState({
      poolContract: 'C-POOL',
      commitments: ['1', '2'],
      commitmentCount: 2,
      merkleRootHex: 'root-a',
      updatedAt: 1,
      nodes,
    });
    await client.appendPoolCommitments({
      poolContract: 'C-POOL',
      commitments: ['3', '4'],
      merkleRootHex: 'root-b',
      nodes: [...nodes, { level: 1, index: 1, value: '8' }],
    });
    await expect(client.getPoolMerkleState('C-POOL')).resolves.toMatchObject({
      commitments: ['1', '2', '3', '4'],
      merkleRootHex: 'root-b',
      nodes: [...nodes, { level: 1, index: 1, value: '8' }],
    });

    const { client: hydrated } = await createTestClient();
    await hydrated.hydrateState({
      poolMerkleStates: [
        {
          poolContract: 'C-POOL',
          commitments: ['1', '2'],
          commitmentCount: 2,
          merkleRootHex: 'root-a',
          updatedAt: 1,
          nodes,
        },
      ],
      privateRecords: [createRecord('G-OWNER', 'USDC', 1n, 'note-1')],
      walletPrivateAddressRecords: [
        {
          owner: 'G-OWNER',
          nonce: '0',
          privateAddress: 'stpl1owner',
          createdAt: 1,
        },
      ],
      walletPrivateAddressScalars: [
        {
          owner: 'G-OWNER',
          nonce: '0',
          scalarHex: 'aa'.repeat(32),
        },
      ],
      walletDefaultPrivateAddressNonces: [{ owner: 'G-OWNER', nonce: '0' }],
      assets: [sampleAsset],
    });
    await expect(hydrated.getPoolMerkleState('C-POOL')).resolves.toMatchObject({
      commitments: ['1', '2'],
      nodes,
    });
    await expect(hydrated.getPrivateRecords()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'note-1' })]),
    );
    await expect(
      hydrated.getWalletPrivateAddressRecord({ owner: 'G-OWNER', nonce: '0' }),
    ).resolves.toMatchObject({ privateAddress: 'stpl1owner' });
    await expect(hydrated.getAsset('USDC')).resolves.toMatchObject({
      assetId: 'USDC',
    });
  });
});

describe('StellarPrivacyClient deliveries state', () => {
  it('treats missing delivery state as empty', async () => {
    const { client } = await createTestClient();

    await expect(client.markDeliveryProcessed(42)).resolves.toBeUndefined();
    await expect(
      client.getIncomingDeliveries({
        privateAddress: 'stpl1owner',
        asset: 'USDC',
      }),
    ).resolves.toEqual([]);
  });

  it('tracks incoming deliveries and sync metadata', async () => {
    const { client } = await createTestClient();
    const delivery: StellarIncomingDelivery = {
      id: 42,
      privateAddress: 'stpl1owner',
      asset: 'USDC',
      ciphertextBase64: 'cipher',
      ephemeralKey: 'ephemeral',
      tagBase64: 'tag',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    await client.upsertIncomingDeliveries([delivery]);
    await client.setDeliverySyncState({
      privateAddress: 'stpl1owner',
      asset: 'USDC',
      bloomM: 1024,
      bloomK: 7,
      lastPage: 1,
      lastPolledAt: '2026-01-01T00:00:00.000Z',
    });

    await expect(
      client.getIncomingDeliveries({
        privateAddress: 'stpl1owner',
        asset: 'USDC',
      }),
    ).resolves.toHaveLength(1);

    await client.markDeliveryProcessed(42);
    await expect(
      client.getIncomingDeliveries({
        privateAddress: 'stpl1owner',
        asset: 'USDC',
      }),
    ).resolves.toHaveLength(0);
    await expect(
      client.getDeliverySyncState({
        privateAddress: 'stpl1owner',
        asset: 'USDC',
      }),
    ).resolves.toMatchObject({ bloomM: 1024, lastPage: 1 });
  });
});

describe('StellarPrivacyClient private records and transactions state', () => {
  it('restores private address from legacy stpl owner records', async () => {
    const record = createRecord('stpl1-sender', 'USDC', 10n, 'record-a');
    record.commitmentHex = 'commitment-a';
    record.coinNote = {
      value: '10',
      nullifier: 'nullifier',
      secret: 'secret',
      commitment: 'commitment-a',
      asset_hi: '0',
      asset_lo: '1',
    };
    const { client } = await createTestClient({ records: [record] });

    await expect(client.getPrivateRecords()).resolves.toEqual([
      expect.objectContaining({
        id: 'record-a',
        privateAddress: 'stpl1-sender',
      }),
    ]);
  });

  it('deduplicates private records by commitment when reading state', async () => {
    const commitment =
      '02aed456479826752890fbfb823228383029d43f06a6a56b84232c88a0f03dbb';
    const legacyRecord = createRecord('private-sender', 'USDC', 10n, 'uuid-record');
    legacyRecord.commitmentHex = `0x${commitment}`;
    legacyRecord.status = 'pending';
    legacyRecord.coinNote = {
      value: '10',
      nullifier: 'nullifier',
      secret: 'secret',
      commitment,
      asset_hi: '0',
      asset_lo: '1',
    };
    const stableRecord = {
      ...legacyRecord,
      id: commitment,
      status: 'finalized' as const,
    };
    const { client } = await createTestClient({
      records: [legacyRecord, stableRecord],
    });

    await expect(client.getPrivateRecords()).resolves.toEqual([
      expect.objectContaining({ id: commitment, status: 'finalized' }),
    ]);
  });

  it('skips duplicate private record upsert writes', async () => {
    const baseState = createInMemoryStateAdapter();
    const writeTypes: string[] = [];
    const state = {
      ...baseState,
      async write(call: StateBridgeCall) {
        writeTypes.push(call.type);
        return baseState.write(call);
      },
    };
    const record = createRecord('private-sender', 'USDC', 10n, 'record-a');
    const { client } = await createTestClient({ state });

    await client.upsertPrivateRecords([record]);
    await client.upsertPrivateRecords([{ ...record }]);
    await client.upsertPrivateRecords([{ ...record, status: 'finalized' }]);

    expect(writeTypes).toEqual(['upsertPrivateRecords', 'upsertPrivateRecords']);
    await expect(client.getPrivateRecords()).resolves.toEqual([
      expect.objectContaining({ id: 'record-a', status: 'finalized' }),
    ]);
  });

  it('aggregates private asset rows and tracks transaction status', async () => {
    const recordA = createRecord('private-sender', 'USDC', 10n, 'a');
    recordA.poolContract = 'C-POOL';
    recordA.amountDisplay = 10;
    recordA.status = 'finalized';
    const recordB = createRecord('private-sender', 'USDC', 20n, 'b');
    recordB.poolContract = 'C-POOL';
    recordB.amountDisplay = 20;
    recordB.status = 'finalized';

    const { client } = await createTestClient({ records: [recordA, recordB] });
    await expect(
      client.getPrivateBalance({
        owner: 'private-sender',
        asset: 'USDC',
      }),
    ).resolves.toBe(30n);
    await expect(client.getPrivateAssetRows('private-sender')).resolves.toEqual([
      expect.objectContaining({
        assetId: 'USDC',
        totalAmount: 30n,
        totalAmountDisplay: 30,
      }),
    ]);

    await client.setTransactionStatus({
      txHash: 'tx-hash',
      status: 'success',
      ledger: 123,
    });
    await expect(client.getTransactionStatus('tx-hash')).resolves.toMatchObject({
      status: 'success',
      ledger: 123,
    });
    await client.clearTransactionStatus('tx-hash');
    expect(await client.getTransactionStatus('tx-hash')).toBeUndefined();
  });
});
