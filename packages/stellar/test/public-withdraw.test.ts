import { describe, expect, it } from 'vitest';
import { insufficientStateError } from '@arcanetech/privacy-sdk-core';
import { createStellarNetworkAdapter } from '../src/adapters/network.js';
import { createFakeTransactEngine } from '../src/testing/fake-transact-engine.js';
import { validateStellarDisclosure } from '../src/policy/disclosure.js';
import { findCommitmentLeafIndex } from '../src/transact/public-withdraw/field-element.js';
import { listPublicWithdrawNotes } from '../src/transact/public-withdraw/list-notes.js';
import { PublicWithdrawNoteError } from '../src/transact/public-withdraw/note-error.js';
import { selectPublicWithdrawNote } from '../src/transact/public-withdraw/select-note.js';
import { submitPublicOutput } from '../src/transact/submit/public-output.js';
import type { PoolTransactClient } from '../src/transact/pool/types.js';
import type { StellarPrivateRecord } from '../src/types.js';

const PUBLIC_DISCLOSURE = {
  senderAddress: 'public',
  recipientAddress: 'public',
  assetAddress: 'public',
  amount: 'public',
} as const;

function note(id: string, amount: string, asset = 'usdc'): StellarPrivateRecord {
  return {
    id,
    owner: 'G-ALICE',
    privateAddress: 'stpl1alice',
    asset,
    amount: BigInt(amount),
    consumed: false,
    coinNote: {
      value: amount,
      secret: '3',
      nullifier: '4',
      commitment: id,
      asset_hi: '5',
      asset_lo: '6',
      application_id: '7',
    },
  };
}

describe('public withdraw note selection', () => {
  it('uses the only unspent note with the requested asset and amount', () => {
    const selected = selectPublicWithdrawNote({
      records: [note('10', '100'), note('11', '40')],
      asset: 'usdc',
      amount: 100n,
    });
    expect(selected.id).toBe('10');
  });

  it('throws when no unspent note matches', () => {
    expect(() =>
      selectPublicWithdrawNote({
        records: [note('10', '40')],
        asset: 'usdc',
        amount: 100n,
      }),
    ).toThrow(PublicWithdrawNoteError);
  });

  it('throws when several notes match and noteId is omitted', () => {
    expect(() =>
      selectPublicWithdrawNote({
        records: [note('10', '100'), note('11', '100')],
        asset: 'usdc',
        amount: 100n,
      }),
    ).toThrow(PublicWithdrawNoteError);
  });

  it('throws when noteId points at a spent note', () => {
    expect(() =>
      selectPublicWithdrawNote({
        records: [{ ...note('10', '100'), status: 'spent' }],
        asset: 'usdc',
        amount: 100n,
        noteId: '10',
      }),
    ).toThrow(PublicWithdrawNoteError);
  });

  it('throws when noteId points at a different amount', () => {
    expect(() =>
      selectPublicWithdrawNote({
        records: [note('10', '40')],
        asset: 'usdc',
        amount: 100n,
        noteId: '10',
      }),
    ).toThrow(PublicWithdrawNoteError);
  });

  it('selects the requested note id', () => {
    const selected = selectPublicWithdrawNote({
      records: [note('10', '100'), note('11', '100')],
      asset: 'usdc',
      amount: 100n,
      noteId: '11',
    });
    expect(selected.id).toBe('11');
  });
});

describe('listPublicWithdrawNotes', () => {
  it('returns a page of unspent notes', () => {
    const spent = { ...note('1', '5'), consumed: true };
    const page = listPublicWithdrawNotes({
      records: [spent, note('20', '7', 'eur'), note('2', '9')],
      page: 1,
      pageSize: 1,
      asset: 'usdc',
    });
    expect(page.notes).toEqual([
      {
        id: '2',
        asset: 'usdc',
        amount: 9n,
        privateAddress: 'stpl1alice',
      },
    ]);
    expect(page.pagination).toEqual({
      total: 1,
      page: 1,
      pageSize: 1,
      hasMore: false,
    });
  });
});

describe('public withdraw disclosure', () => {
  it('rejects a private field', () => {
    const errors = validateStellarDisclosure('publicWithdraw', {
      from: 'stpl1alice',
      to: 'G-ALICE',
      asset: 'usdc',
      amount: 1n,
      disclosure: {
        ...PUBLIC_DISCLOSURE,
        senderAddress: 'private',
      },
    } as never);
    expect(errors.map((error) => error.code)).toEqual(['unsupported_disclosure']);
  });
});

describe('prepare public withdraw', () => {
  it('rejects a missing leaf', async () => {
    const adapter = createStellarNetworkAdapter({
      storage: {
        listPrivateRecords: async () => [note('10', '100')],
        savePrivateRecords: async () => undefined,
        markPrivateRecordsUsed: async () => undefined,
      },
      wallet: {
        getAddress: async () => 'G-ALICE',
        authorizeMessage: async () => new Uint8Array(),
        signTransactionPayload: async (payload) => payload,
      },
      engine: createFakeTransactEngine(),
      poolContract: 'CPOOL',
      getPoolMerkleState: async () => undefined,
    });
    await expect(
      adapter.preparePublicWithdraw({
        from: 'stpl1alice',
        to: 'G-ALICE',
        asset: 'usdc',
        amount: 100n,
        disclosure: PUBLIC_DISCLOSURE,
      }),
    ).rejects.toMatchObject({ code: 'insufficient_state' });
  });
});

describe('submitPublicOutput', () => {
  it('calls public_output and does not call transact', async () => {
    let publicOutputCalled = false;
    let transactCalled = false;
    const contractClient: PoolTransactClient = {
      get_merkle_root: async () => ({ result: Buffer.alloc(32) }),
      get_commitment_count: async () => ({ result: 1 }),
      get_leaf_ephemeral: async () => ({
        result: { x: Buffer.alloc(32), y: Buffer.alloc(32) },
      }),
      is_nulifier_hash_consumed: async () => ({ result: false }),
      transact: async () => {
        transactCalled = true;
        return {
          signAndSend: async () => ({ sendTransactionResponse: { hash: 'nope' } }),
        };
      },
      public_output: async (parameters) => {
        publicOutputCalled = true;
        expect(parameters.leaf_index).toBe(4);
        expect(parameters.to).toBe('G-ALICE');
        expect(parameters.note.value).toEqual(
          Buffer.from('64'.padStart(64, '0'), 'hex'),
        );
        return {
          signAndSend: async () => ({ sendTransactionResponse: { hash: 'tx-hash' } }),
        };
      },
    };
    const hash = await submitPublicOutput({
      contractClient,
      leafIndex: 4,
      to: 'G-ALICE',
      note: {
        value: '100',
        secret: '3',
        nullifier: '4',
        ownerPubX: 'aa',
        ownerPubY: 'bb',
        ownerMode: '0',
        assetHi: '5',
        assetLo: '6',
        applicationId: '7',
      },
    });
    expect(hash).toBe('tx-hash');
    expect(publicOutputCalled).toBe(true);
    expect(transactCalled).toBe(false);
    expect(findCommitmentLeafIndex(['99', '100'], '100')).toBe(1);
    expect(insufficientStateError('missing_merkle_leaf', 'missing').code).toBe(
      'insufficient_state',
    );
  });
});
