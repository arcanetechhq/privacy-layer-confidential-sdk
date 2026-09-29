import { describe, expect, it } from 'vitest';
import { deriveEscrowRecipientFromStellarAddress } from '../src/transact/escrow/derived-escrow-recipient.js';
import { encodePrivateAddressFromHexCoordinates } from '../src/transact/private-address/codec.js';
import { reconstructEscrowNote } from '../src/transact/escrow/reconstruct-escrow-note.js';

const FIXED_G = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const DERIVED_ESCROW_FIXTURE = {
  scalarHex: '304c151b0d104df797d473cc6ee1e85769d615744d0ff7eb1bfb8d10473fc314',
  pointXHex: '1212fec80b675a524b5ffa32723fdb17e5e7923e4d9609bff8cc56a472b6e35f',
  pointYHex: '0d2002e37a3f40a3aee753a5e517b356371958198b6c735703ad2756d674d208',
} as const;

describe('deriveEscrowRecipientFromStellarAddress', () => {
  it('pins exactly one recipient by deriving the escrow key from nonce and G-address limbs', async () => {
    let seenHi: bigint | undefined;
    let seenLo: bigint | undefined;
    const derived = await deriveEscrowRecipientFromStellarAddress({
      recipientStellarAddress: FIXED_G,
      nonceDecimal: '0',
      deriveKey: async (nonce, recipientHi, recipientLo) => {
        expect(nonce).toBe(0n);
        seenHi = recipientHi;
        seenLo = recipientLo;
        return DERIVED_ESCROW_FIXTURE;
      },
    });

    expect(seenHi).toBe(BigInt(derived.recipientHi));
    expect(seenLo).toBe(BigInt(derived.recipientLo));

    expect(derived.recipientStellarAddress).toBe(FIXED_G);
    expect(derived.privateAddressStpl1).toBe(
      encodePrivateAddressFromHexCoordinates(
        DERIVED_ESCROW_FIXTURE.pointXHex,
        DERIVED_ESCROW_FIXTURE.pointYHex,
      ),
    );
    expect(derived.scalarHex).toBe(DERIVED_ESCROW_FIXTURE.scalarHex);
  });

  it('refuses a non-account recipient so the sender cannot name anyone else', async () => {
    await expect(
      deriveEscrowRecipientFromStellarAddress({
        recipientStellarAddress: 'stpl1notanaccount',
      }),
    ).rejects.toThrow(/stellar g-address/i);
  });

  it('samples a high-entropy escrow nonce that round-trips through reconstruct', async () => {
    const derived = await deriveEscrowRecipientFromStellarAddress({
      recipientStellarAddress: FIXED_G,
    });
    expect(derived.nonceDecimal.length).toBeGreaterThanOrEqual(39);
    expect(BigInt(derived.nonceDecimal) >= 1n << 127n).toBe(true);

    let decryptCommitmentMatches: boolean | undefined;
    const reconstructed = await reconstructEscrowNote({
      claimantAddress: FIXED_G,
      nonceDecimal: derived.nonceDecimal,
      seq: 0,
      events: [
        {
          outputIndex: 0,
          commitmentHashHex: 'bb'.repeat(32),
          createdEphemeralKey: ['1', '2'],
          ciphertext: ['3', '4', '5', '6', '7', '8'],
          tag: '9',
        },
      ],
      decrypt: async (input) => {
        expect(input.recipientScalarHex).toBe(derived.scalarHex);
        const decrypted = {
          value: '100',
          assetHi: '4',
          assetLo: '5',
          nullifier: '1',
          secret: '2',
          applicationId: '0',
          commitmentHex: 'cc'.repeat(32),
          commitmentMatches: true,
        };
        decryptCommitmentMatches = decrypted.commitmentMatches;
        return decrypted;
      },
    });
    expect(decryptCommitmentMatches).toBe(true);
    expect(reconstructed.nonceDecimal).toBe(derived.nonceDecimal);
    expect(reconstructed.scalarHex).toBe(derived.scalarHex);
    expect(reconstructed.coin.value).toBe('100');
  });
});
