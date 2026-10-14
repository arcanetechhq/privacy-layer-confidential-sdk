import { describe, expect, it } from 'vitest';
import { reuseCachedCommitments } from '../src/transact/merkle/reuse-cached-commitments.js';

const ROOT_A = 'aa'.repeat(32);
const ROOT_B = 'bb'.repeat(32);

describe('reuseCachedCommitments', () => {
  it('returns nothing when the cache is empty', () => {
    expect(
      reuseCachedCommitments({
        onChainCount: 4,
        merkleRootHex: ROOT_A,
        cachedState: undefined,
      }),
    ).toEqual([]);
  });

  it('reuses a matching complete cache', () => {
    expect(
      reuseCachedCommitments({
        onChainCount: 2,
        merkleRootHex: ROOT_A,
        cachedState: {
          commitments: ['1', '2'],
          updatedAt: 1,
          merkleRootHex: ROOT_A,
        },
      }),
    ).toEqual(['1', '2']);
  });

  it('drops a complete cache that has no recorded root', () => {
    expect(
      reuseCachedCommitments({
        onChainCount: 2,
        merkleRootHex: ROOT_A,
        cachedState: {
          commitments: ['1', '2'],
          updatedAt: 1,
          merkleRootHex: '',
        },
      }),
    ).toEqual([]);
  });

  it('drops a complete cache when the on-chain root changed', () => {
    expect(
      reuseCachedCommitments({
        onChainCount: 2,
        merkleRootHex: ROOT_B,
        cachedState: {
          commitments: ['1', '2'],
          updatedAt: 1,
          merkleRootHex: ROOT_A,
        },
      }),
    ).toEqual([]);
  });

  it('keeps an append-only prefix when the tree grew', () => {
    expect(
      reuseCachedCommitments({
        onChainCount: 4,
        merkleRootHex: ROOT_B,
        cachedState: {
          commitments: ['1', '2'],
          updatedAt: 1,
          merkleRootHex: ROOT_A,
        },
      }),
    ).toEqual(['1', '2']);
  });

  it('drops a cache that is longer than the on-chain tree', () => {
    expect(
      reuseCachedCommitments({
        onChainCount: 1,
        merkleRootHex: ROOT_A,
        cachedState: {
          commitments: ['1', '2'],
          updatedAt: 1,
          merkleRootHex: ROOT_A,
        },
      }),
    ).toEqual([]);
  });
});
