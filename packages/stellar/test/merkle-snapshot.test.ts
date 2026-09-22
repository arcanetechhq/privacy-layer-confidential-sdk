import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CoinData, PrivacyPoolSDK } from '@arcanetech/stellar-privacy-pool-zk-sdk';
import { extendMerkleSnapshotNodes } from '../src/transact/merkle/extend-snapshot.js';
import type { LeanImtSessionApi } from '../src/transact/merkle/lean-imt-api.js';
import { merkleSnapshotToStateFile } from '../src/transact/merkle/state-file.js';
import {
  bindPoolMerkleTree,
  registerMerkleSessionSdkHost,
  withdrawMerkleWitnessFromTree,
} from '../src/transact/merkle/tree-session.js';

const ROOT_HEX = 'aa'.repeat(32);

function fakeSession(nodes = [{ level: 1, index: 0, value: '1' }]): LeanImtSessionApi {
  return {
    importLeanImtFromState: () => 7,
    insertTwoLeanImt: () => '2',
    exportLeanImt: () => ({
      depth: 20,
      root: '2',
      leaves: ['1', '2', '3', '4'],
      nodes,
    }),
    dropLeanImt: () => undefined,
    buildWithdrawMerkleWitnessFromHandle: () => ({
      withdrawnValue: '0',
      value: '0',
      nullifier: '0',
      secret: '0',
      withdrawnAsset: ['0', '0'],
      stateRoot: '2',
      stateIndex: '0',
      stateSiblings: Array.from({ length: 20 }, () => '0'),
    }),
  };
}

describe('extendMerkleSnapshotNodes', () => {
  it('inserts new pairs onto a cached snapshot and returns nodes', () => {
    const nodes = [{ level: 1, index: 0, value: '1' }];
    const result = extendMerkleSnapshotNodes({
      sdk: fakeSession([...nodes, { level: 1, index: 1, value: '2' }]),
      cachedState: {
        commitments: ['1', '2'],
        updatedAt: 1,
        merkleRootHex: ROOT_HEX,
        nodes,
      },
      commitments: ['1', '2', '3', '4'],
      merkleRootHex: 'bb'.repeat(32),
    });
    expect(result.handle).toBe(7);
    expect(result.nodes).toEqual([
      { level: 1, index: 0, value: '1' },
      { level: 1, index: 1, value: '2' },
    ]);
  });

  it('rejects an odd leaf count', () => {
    expect(
      extendMerkleSnapshotNodes({
        sdk: fakeSession(),
        commitments: ['1'],
        merkleRootHex: ROOT_HEX,
      }),
    ).toEqual({});
  });
});

describe('merkleSnapshotToStateFile', () => {
  it('omits nodes unless a 32-byte hex root is present', () => {
    expect(
      merkleSnapshotToStateFile({
        commitments: ['1', '2'],
        merkleRootHex: 'root-a',
        nodes: [{ level: 1, index: 0, value: '1' }],
      }),
    ).toEqual({ commitments: ['1', '2'] });
    expect(
      merkleSnapshotToStateFile({
        commitments: ['1', '2'],
        merkleRootHex: ROOT_HEX,
        nodes: [{ level: 1, index: 0, value: '1' }],
      }).nodes,
    ).toHaveLength(1);
  });
});

describe('withdrawMerkleWitnessFromTree', () => {
  afterEach(() => {
    registerMerkleSessionSdkHost(undefined);
  });

  it('prefers a bound session handle over rebuilding from leaves', async () => {
    const session = fakeSession();
    const fromHandle = vi.fn(session.buildWithdrawMerkleWitnessFromHandle);
    session.buildWithdrawMerkleWitnessFromHandle = fromHandle;
    const rebuild = vi.fn(session.buildWithdrawMerkleWitnessFromHandle);
    registerMerkleSessionSdkHost({
      getInitializedSdk: async () => session,
    });
    await bindPoolMerkleTree({
      poolContract: 'C-POOL',
      commitments: ['1', '2'],
      commitmentCount: 2,
      merkleRootHex: ROOT_HEX,
      updatedAt: 1,
    });
    const sdk = {
      ...session,
      buildWithdrawMerkleWitness: rebuild,
    } as unknown as PrivacyPoolSDK;
    const coin = {
      value: '1',
      nullifier: '1',
      secret: '1',
      commitment: '1',
      asset_hi: '0',
      asset_lo: '0',
    } satisfies CoinData;
    withdrawMerkleWitnessFromTree({
      sdk,
      coin,
      state: merkleSnapshotToStateFile({
        commitments: ['1', '2'],
        merkleRootHex: ROOT_HEX,
      }),
    });
    expect(fromHandle).toHaveBeenCalledOnce();
    expect(rebuild).not.toHaveBeenCalled();
  });
});
