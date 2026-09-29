import { describe, expect, it, vi } from 'vitest';
import {
  assessIncomingNote,
  type AssessIncomingNotePorts,
  type IncomingNoteFields,
} from '../src/client/assess-incoming-note.js';
import { createTestClient } from './stellar-client.test-helpers.js';

const MATCHING_COMMITMENT_HEX =
  'aa901161e699ab3d4ca43cd15e575408441197eba93de07e5da6a2826d2e82d9';
const MATCHING_COMMITMENT_DECIMAL = BigInt(`0x${MATCHING_COMMITMENT_HEX}`).toString();
const NOTE: IncomingNoteFields = {
  value: '10000000',
  nullifier: '11',
  secret: '22',
  commitment: MATCHING_COMMITMENT_DECIMAL,
  asset_hi: '1',
  asset_lo: '2',
  application_id: '101',
};

function ports(
  overrides: Partial<AssessIncomingNotePorts> = {},
): AssessIncomingNotePorts {
  return {
    recomputeCommitmentHex: vi.fn(async () => MATCHING_COMMITMENT_HEX),
    hasCommitmentLeaf: vi.fn(async () => true),
    calculateNullifierHash: vi.fn(async () => 'deadbeef'.repeat(8)),
    isNullifierConsumed: vi.fn(async () => false),
    ...overrides,
  };
}

describe('assessIncomingNote', () => {
  it('is exposed on the privacy client entry point', async () => {
    const { client } = await createTestClient();
    expect(typeof client.assessIncomingNote).toBe('function');
  });

  it('returns dead/commitment_mismatch without contacting chain ports', async () => {
    const chainPorts = ports({
      recomputeCommitmentHex: async () => 'ff'.repeat(32),
    });
    const verdict = await assessIncomingNote({
      note: NOTE,
      commitmentHex: MATCHING_COMMITMENT_HEX,
      privKeyScalarHex: 'ab'.repeat(32),
      ports: chainPorts,
    });
    expect(verdict).toEqual({
      kind: 'dead',
      reason: 'commitment_mismatch',
    });
    expect(chainPorts.hasCommitmentLeaf).not.toHaveBeenCalled();
    expect(chainPorts.calculateNullifierHash).not.toHaveBeenCalled();
    expect(chainPorts.isNullifierConsumed).not.toHaveBeenCalled();
  });

  it('returns dead/commitment_mismatch when note commitment disagrees with hex', async () => {
    const chainPorts = ports();
    await expect(
      assessIncomingNote({
        note: { ...NOTE, commitment: '1' },
        commitmentHex: MATCHING_COMMITMENT_HEX,
        privKeyScalarHex: 'ab'.repeat(32),
        ports: chainPorts,
      }),
    ).resolves.toEqual({
      kind: 'dead',
      reason: 'commitment_mismatch',
    });
    expect(chainPorts.hasCommitmentLeaf).not.toHaveBeenCalled();
  });

  it('returns pending when the commitment is consistent but no leaf exists', async () => {
    const chainPorts = ports({
      hasCommitmentLeaf: vi.fn(async () => false),
    });
    await expect(
      assessIncomingNote({
        note: NOTE,
        commitmentHex: MATCHING_COMMITMENT_HEX,
        privKeyScalarHex: 'ab'.repeat(32),
        ports: chainPorts,
      }),
    ).resolves.toEqual({ kind: 'pending' });
    expect(chainPorts.hasCommitmentLeaf).toHaveBeenCalledWith(
      MATCHING_COMMITMENT_DECIMAL,
    );
    expect(chainPorts.isNullifierConsumed).not.toHaveBeenCalled();
  });

  it('returns dead/nullifier_consumed when the leaf exists and the nullifier is spent', async () => {
    const chainPorts = ports({
      isNullifierConsumed: vi.fn(async () => true),
    });
    await expect(
      assessIncomingNote({
        note: NOTE,
        commitmentHex: MATCHING_COMMITMENT_HEX,
        privKeyScalarHex: 'ab'.repeat(32),
        ports: chainPorts,
      }),
    ).resolves.toEqual({
      kind: 'dead',
      reason: 'nullifier_consumed',
    });
  });

  it('returns spendable when the leaf exists and the nullifier is unconsumed', async () => {
    await expect(
      assessIncomingNote({
        note: NOTE,
        commitmentHex: `0x${MATCHING_COMMITMENT_HEX}`,
        privKeyScalarHex: 'ab'.repeat(32),
        ports: ports(),
      }),
    ).resolves.toEqual({ kind: 'spendable' });
  });
});
