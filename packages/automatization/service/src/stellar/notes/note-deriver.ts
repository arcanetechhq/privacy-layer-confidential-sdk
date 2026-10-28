import { createHash } from 'node:crypto';
import type { NotePlaintext } from '@arcanetech/privacy-sdk-automatization-plan';
import { stellarContractAddressToAssetFrDecimals } from '@arcanetech/stellar-privacy-pool-zk-sdk';
import type { NoteDeriver } from '../../ports/index.js';
import {
  FR_ORDER,
  babyJubDecimal,
  decimalToHex,
  hexToDecimal,
  randomBabyJubScalar,
  randomField,
  stripHexPrefix,
  type FieldPair,
} from '../shared/index.js';
import { loadNoteWasm, type NoteWasm } from './note-wasm.js';

export interface StellarNoteDeriverConfig {
  readonly sdkWasm: ArrayBuffer | Uint8Array;
  readonly serviceSecretSeed: string;
  readonly noteSalt: string;
  readonly assetContract: string;
  readonly applicationId: string;
}

export interface NoteOpening {
  readonly commitment: string;
  readonly nullifierHash: string;
  readonly nullifier: string;
  readonly secret: string;
  readonly ephemeralScalar: string;
  readonly ownerScalar: string;
  readonly ownerPub: FieldPair;
  readonly ownerPubHex: { readonly x: string; readonly y: string };
  readonly accumulator: string;
}

export interface StellarNoteDeriver extends NoteDeriver {
  readonly asset: FieldPair;
  readonly applicationId: string;
  readonly serviceScalar: string;
  readonly servicePublicKey: FieldPair;
  openPinned(plaintext: NotePlaintext): NoteOpening;
  openUnspent(amount: bigint, ownerScalar: string): NoteOpening;
  freshEphemeral(): string;
  freshNullifier(): string;
}

interface OwnerKey {
  readonly scalar: string;
  readonly pub: FieldPair;
  readonly pubHex: { readonly x: string; readonly y: string };
}

interface Opener {
  readonly wasm: NoteWasm;
  readonly config: StellarNoteDeriverConfig;
  readonly asset: FieldPair;
}

function sha256Hex(material: string): string {
  return createHash('sha256').update(material).digest('hex');
}

function saltedMaterial(config: StellarNoteDeriverConfig, label: string): string {
  return `${config.serviceSecretSeed}\0${config.noteSalt}\0${label}`;
}

function ownerKey(wasm: NoteWasm, scalar: string): OwnerKey {
  const point = wasm.ecdhEphemeralPublicKeyFromScalarHex(decimalToHex(scalar));
  return {
    scalar,
    pub: [hexToDecimal(point.x), hexToDecimal(point.y)],
    pubHex: { x: stripHexPrefix(point.x), y: stripHexPrefix(point.y) },
  };
}

function openWithOwner(
  opener: Opener,
  owner: OwnerKey,
  input: { amount: bigint; label: string },
): NoteOpening {
  const { wasm, config, asset } = opener;
  const ephemeralScalar = babyJubDecimal(
    sha256Hex(saltedMaterial(config, `ephemeral:${input.label}`)),
  );
  const nullifierDigest = sha256Hex(saltedMaterial(config, `nullifier:${input.label}`));
  const nullifier = (BigInt(`0x${nullifierDigest}`) % FR_ORDER).toString(10);
  const secret = wasm.poseidon1Decimal(ephemeralScalar);
  const accumulator = '0';
  const commitmentHex = wasm.commitmentChainHexWithAccumulator(
    input.amount.toString(),
    secret,
    nullifier,
    owner.pub[0],
    owner.pub[1],
    '0',
    asset[0],
    asset[1],
    config.applicationId,
    accumulator,
  );
  return {
    commitment: hexToDecimal(commitmentHex),
    nullifierHash: hexToDecimal(wasm.calculateNullifierHash(nullifier, owner.scalar)),
    nullifier,
    secret,
    ephemeralScalar,
    ownerScalar: owner.scalar,
    ownerPub: owner.pub,
    ownerPubHex: owner.pubHex,
    accumulator,
  };
}

export async function createStellarNoteDeriver(
  config: StellarNoteDeriverConfig,
): Promise<StellarNoteDeriver> {
  if (config.noteSalt.trim().length === 0) {
    throw new Error('Note derivation needs a persisted salt');
  }
  const wasm = await loadNoteWasm(config.sdkWasm);
  const opener: Opener = {
    wasm,
    config,
    asset: stellarContractAddressToAssetFrDecimals(config.assetContract),
  };
  const service = ownerKey(
    wasm,
    babyJubDecimal(sha256Hex(`${config.serviceSecretSeed}\0service-owner`)),
  );
  const openPinned = (plaintext: NotePlaintext): NoteOpening =>
    openWithOwner(opener, service, {
      amount: plaintext.amount,
      label: `pinned:${plaintext.amount.toString()}:${plaintext.accumulator}`,
    });
  return {
    asset: opener.asset,
    applicationId: config.applicationId,
    serviceScalar: service.scalar,
    servicePublicKey: service.pub,
    derive(plaintext) {
      const opened = openPinned(plaintext);
      return { commitment: opened.commitment, nullifierHash: opened.nullifierHash };
    },
    openPinned,
    openUnspent(amount, ownerScalar) {
      return openWithOwner(opener, ownerKey(wasm, ownerScalar), {
        amount,
        label: `unspent:${ownerScalar}:${amount.toString()}`,
      });
    },
    freshEphemeral: randomBabyJubScalar,
    freshNullifier: randomField,
  };
}
