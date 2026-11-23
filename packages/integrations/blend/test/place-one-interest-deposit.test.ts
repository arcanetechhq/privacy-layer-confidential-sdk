import { createInMemoryStateBridge } from '@arcanetech/privacy-sdk-state-memory';
import { SIX_BY_SIX_BINDING_ZK_NONCE } from '@arcanetech/privacy-sdk-stellar/transact';
import { describe, expect, it } from 'vitest';
import {
  blendInterestDepositDefinitions,
  deriveInterestDepositSeed,
  interestDepositAccount,
  listInterestDeposits,
  placementAuthorization,
  saveInterestDeposit,
  underlyingFromShares,
} from '../src/index.js';

const SPEND_SCALAR = new Uint8Array(32).fill(1);
const BLEND_POOL = new Uint8Array(32).fill(2);
const TOKEN = new Uint8Array(32).fill(3);

describe('one Interest Deposit placement', () => {
  it('derives the chain address from the spend scalar, pool, token, and index', async () => {
    const seed = await deriveInterestDepositSeed({
      spendScalar: SPEND_SCALAR,
      blendPoolContractId: BLEND_POOL,
      tokenContractId: TOKEN,
      chainIndex: 4,
    });

    expect(Buffer.from(seed).toString('hex')).toBe(
      '0d468e5932b9e25cef6fb00e193f694aefd089e5feb0fc17461b351039978669',
    );
  });

  it('keeps the G signature and the KYT signal hash when only stateRoot changes', async () => {
    const older = await placementAuthorization({
      publicSignals: [field(1), field(9), field(4)],
      stateRootIndex: 1,
      ciphertext: field(8),
    });
    const newer = await placementAuthorization({
      publicSignals: [field(1), field(2), field(4)],
      stateRootIndex: 1,
      ciphertext: field(8),
    });

    expect(older.zkConfigNonce).toBe(SIX_BY_SIX_BINDING_ZK_NONCE);
    expect(newer).toEqual(older);
    expect(Buffer.from(older.kytSignalHash).toString('hex')).toBe(
      'b8f667fb68087479dd70fbb5757bad68ea9ca5d3e227404736b35110e0d1edd5',
    );
    expect('proof' in older).toBe(false);

    const changedAmount = await placementAuthorization({
      publicSignals: [field(1), field(9), field(5)],
      stateRootIndex: 1,
      ciphertext: field(8),
    });
    expect(changedAmount.kytSignalHash).not.toEqual(older.kytSignalHash);
  });

  it('records one Interest Deposit without a share balance and shows underlying', async () => {
    const { bridge } = createInMemoryStateBridge();
    bridge.init(blendInterestDepositDefinitions);
    const account = interestDepositAccount(SPEND_SCALAR);
    await saveInterestDeposit(bridge, {
      chainIndex: 0,
      account,
      blendPool: 'CBLEND',
      reserve: 'CTOKEN',
    });

    expect(await listInterestDeposits(bridge)).toEqual([
      {
        chainIndex: 0,
        account,
        blendPool: 'CBLEND',
        reserve: 'CTOKEN',
      },
    ]);
    expect(underlyingFromShares(42n, 2_000_000_000_000n)).toBe(84n);
  });
});

function field(value: number): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes[31] = value;
  return bytes;
}
