import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  RELAY_SIGNAL_INDEX_ESCROW_RECIPIENT_HI,
  RELAY_SIGNAL_INDEX_ESCROW_RECIPIENT_LO,
  RELAY_SIGNAL_INDEX_NULLIFIER_0,
  RELAY_SIGNAL_INDEX_NULLIFIER_1,
  RELAY_SIGNAL_INDEX_PUBLIC_DEPOSIT,
  RELAY_SIGNAL_INDEX_PUBLIC_DEPOSIT_ASSET_HI,
  RELAY_SIGNAL_INDEX_PUBLIC_DEPOSIT_ASSET_LO,
  RELAY_SIGNAL_INDEX_PUBLIC_WITHDRAWAL,
  RELAY_SIGNAL_INDEX_PUBLIC_WITHDRAWAL_ASSET_HI,
  RELAY_SIGNAL_INDEX_PUBLIC_WITHDRAWAL_ASSET_LO,
  RELAY_SIGNAL_INDEX_STATE_ROOT,
  RELAY_SIGNAL_INDEX_WITHDRAW_ADDRESS_HI,
  RELAY_SIGNAL_INDEX_WITHDRAW_ADDRESS_LO,
  RELAY_TRANSACT_FIELD_BYTES,
  RELAY_TRANSACT_PACKAGE_VERSION_V1,
  RELAY_TRANSACT_SIGNAL_PREFIX_BYTES,
  RELAY_TRANSACT_SUPPORTED_SIGNAL_COUNT,
} from '../src/transact/relay/constants.js';
import {
  prepareRelayTransactPackage,
  readRelayTransactSupportedProfile,
} from '../src/transact/index.js';
import { relayLayoutProfileForNonce } from '../src/transact/relay/layout-profile.js';

type SignalLayoutVector = {
  packageVersion: number;
  signalCount: number;
  fieldBytes: number;
  prefixBytes: number;
  unsupportedSignalCount: number;
  indices: {
    nullifier0: number;
    nullifier1: number;
    stateRoot: number;
    withdrawAddressHi: number;
    withdrawAddressLo: number;
    escrowRecipientHi: number;
    escrowRecipientLo: number;
    publicWithdrawalAssetHi: number;
    publicWithdrawalAssetLo: number;
    publicDepositAssetHi: number;
    publicDepositAssetLo: number;
    publicDeposit: number;
    publicWithdrawal: number;
  };
  packedPublicSignals: string;
  expectedProfile: {
    orderedNullifiers: [string, string];
    publicLegContext: Record<string, string>;
  };
};

const RELAY_SIGNAL_LAYOUT_VECTOR = createRequire(import.meta.url)(
  './vectors/relay-signal-layout.json',
) as SignalLayoutVector;

function packZeroSignals(signalCount: number, fieldBytes: number): string {
  return '00'.repeat(signalCount * fieldBytes);
}

describe('relay signal-layout vectors', () => {
  const vector = RELAY_SIGNAL_LAYOUT_VECTOR;

  it('keeps owner-bound layout constants aligned with the vector', () => {
    expect(RELAY_TRANSACT_PACKAGE_VERSION_V1).toBe(vector.packageVersion);
    expect(RELAY_TRANSACT_SUPPORTED_SIGNAL_COUNT).toBe(vector.signalCount);
    expect(RELAY_TRANSACT_FIELD_BYTES).toBe(vector.fieldBytes);
    expect(RELAY_TRANSACT_SIGNAL_PREFIX_BYTES).toBe(vector.prefixBytes);
    expect(RELAY_SIGNAL_INDEX_NULLIFIER_0).toBe(vector.indices.nullifier0);
    expect(RELAY_SIGNAL_INDEX_NULLIFIER_1).toBe(vector.indices.nullifier1);
    expect(RELAY_SIGNAL_INDEX_STATE_ROOT).toBe(vector.indices.stateRoot);
    expect(RELAY_SIGNAL_INDEX_WITHDRAW_ADDRESS_HI).toBe(
      vector.indices.withdrawAddressHi,
    );
    expect(RELAY_SIGNAL_INDEX_WITHDRAW_ADDRESS_LO).toBe(
      vector.indices.withdrawAddressLo,
    );
    expect(RELAY_SIGNAL_INDEX_ESCROW_RECIPIENT_HI).toBe(
      vector.indices.escrowRecipientHi,
    );
    expect(RELAY_SIGNAL_INDEX_ESCROW_RECIPIENT_LO).toBe(
      vector.indices.escrowRecipientLo,
    );
    expect(RELAY_SIGNAL_INDEX_PUBLIC_WITHDRAWAL_ASSET_HI).toBe(
      vector.indices.publicWithdrawalAssetHi,
    );
    expect(RELAY_SIGNAL_INDEX_PUBLIC_WITHDRAWAL_ASSET_LO).toBe(
      vector.indices.publicWithdrawalAssetLo,
    );
    expect(RELAY_SIGNAL_INDEX_PUBLIC_DEPOSIT_ASSET_HI).toBe(
      vector.indices.publicDepositAssetHi,
    );
    expect(RELAY_SIGNAL_INDEX_PUBLIC_DEPOSIT_ASSET_LO).toBe(
      vector.indices.publicDepositAssetLo,
    );
    expect(RELAY_SIGNAL_INDEX_PUBLIC_DEPOSIT).toBe(vector.indices.publicDeposit);
    expect(RELAY_SIGNAL_INDEX_PUBLIC_WITHDRAWAL).toBe(vector.indices.publicWithdrawal);
  });

  it('fails when a layout copy diverges from the vector', () => {
    expect(vector.signalCount).not.toBe(vector.unsupportedSignalCount);
    expect(RELAY_TRANSACT_SUPPORTED_SIGNAL_COUNT).not.toBe(
      vector.unsupportedSignalCount,
    );
  });

  it('reads the vector public-leg profile from packed 93-signal bytes', () => {
    const prepared = prepareRelayTransactPackage({
      poolSelector: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      zkConfigNonce: 0n,
      proofBytes: 'aabb',
      publicSignals: vector.packedPublicSignals,
      applicationIdHints: ['101', '101', '0', '0'],
    });
    expect(readRelayTransactSupportedProfile(prepared)).toEqual(vector.expectedProfile);
  });

  it('rejects the unsupported 79-signal layout from the vector', () => {
    expect(() =>
      prepareRelayTransactPackage({
        poolSelector: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        zkConfigNonce: 0n,
        proofBytes: 'aabb',
        publicSignals: packZeroSignals(
          vector.unsupportedSignalCount,
          vector.fieldBytes,
        ),
        applicationIdHints: ['101', '101', '0', '0'],
      }),
    ).toThrow(/exactly 93 packed public signals/i);
  });

  it('derives the nonce-0 profile from the circuit shape', () => {
    const profile = relayLayoutProfileForNonce(0n);
    expect(profile.signalCount).toBe(vector.signalCount);
    expect(profile.indices.stateRoot).toBe(vector.indices.stateRoot);
    expect(profile.indices.publicWithdrawal).toBe(vector.indices.publicWithdrawal);
  });

  it('derives the nonce-6 259-signal 6x6 profile', () => {
    const profile = relayLayoutProfileForNonce(6n);
    expect(profile.signalCount).toBe(259);
    expect(profile.indices.stateRoot).toBe(246);
  });

  it('derives the nonce-3 30-signal binding profile', () => {
    const profile = relayLayoutProfileForNonce(3n);
    expect(profile.signalCount).toBe(30);
    expect(profile.indices.stateRoot).toBe(16);
  });

  it('derives the nonce-7 58-signal 6x6 binding profile', () => {
    const profile = relayLayoutProfileForNonce(7n);
    expect(profile.signalCount).toBe(58);
    expect(profile.indices.stateRoot).toBe(44);
  });

  it('fails closed for an unknown ZK nonce', () => {
    expect(() => relayLayoutProfileForNonce(1n)).toThrow(/unknown zk config nonce/i);
  });

  it('derives the nonce-2 95-signal Commitment V2 profile', () => {
    const profile = relayLayoutProfileForNonce(2n);
    expect(profile.signalCount).toBe(95);
    expect(profile.indices.stateRoot).toBe(vector.indices.stateRoot);
  });

  it('fails closed when nonce 2 is paired with the 93-signal count', () => {
    expect(() =>
      prepareRelayTransactPackage({
        poolSelector: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        zkConfigNonce: 2n,
        proofBytes: 'aabb',
        publicSignals: packZeroSignals(vector.signalCount, vector.fieldBytes),
        applicationIdHints: ['101', '101', '0', '0'],
      }),
    ).toThrow(/exactly 95 packed public signals/i);
  });

  it('fails closed when nonce 0 is paired with the 95-signal count', () => {
    expect(() =>
      prepareRelayTransactPackage({
        poolSelector: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        zkConfigNonce: 0n,
        proofBytes: 'aabb',
        publicSignals: packZeroSignals(95, vector.fieldBytes),
        applicationIdHints: ['101', '101', '0', '0'],
      }),
    ).toThrow(/exactly 93 packed public signals/i);
  });

  it('accepts nonce 2 with 95 packed public signals', () => {
    const prepared = prepareRelayTransactPackage({
      poolSelector: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      zkConfigNonce: 2n,
      proofBytes: 'aabb',
      publicSignals: packZeroSignals(95, vector.fieldBytes),
      applicationIdHints: ['101', '101', '0', '0'],
    });
    expect(prepared.zkConfigNonce).toBe(2n);
  });

  it('defaults an omitted nonce to binding 30-signal layout', () => {
    const poolSelector = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
    const applicationIdHints = ['101', '101', '0', '0'] as const;
    expect(() =>
      prepareRelayTransactPackage({
        poolSelector,
        proofBytes: 'aabb',
        publicSignals: packZeroSignals(vector.signalCount, vector.fieldBytes),
        applicationIdHints: [...applicationIdHints],
      }),
    ).toThrow(/exactly 30 packed public signals/i);
    const prepared = prepareRelayTransactPackage({
      poolSelector,
      proofBytes: 'aabb',
      publicSignals: packZeroSignals(30, vector.fieldBytes),
      applicationIdHints: [...applicationIdHints],
    });
    expect(prepared.zkConfigNonce).toBe(3n);
  });
});
