import { Buffer } from 'buffer';
import type { StellarPrivateRecord } from '../../types.js';
import { decodePrivateAddress } from '../private-address/codec.js';
import { fieldElementToBytes } from './field-element.js';
import type {
  StellarPublicOutputNoteFields,
  StellarPublicOutputSubmission,
} from './types.js';

const COORDINATE_HEX_LENGTH = 64;

export function buildPublicOutputSubmission(input: {
  record: StellarPrivateRecord;
  leafIndex: number;
  to: string;
}): StellarPublicOutputSubmission {
  const note = input.record.coinNote;
  const privateAddress = input.record.privateAddress?.trim();
  if (!note || !privateAddress) {
    throw new Error('Public withdraw note is missing its opening.');
  }
  const owner = decodePrivateAddress(privateAddress);
  return {
    leafIndex: input.leafIndex,
    to: input.to,
    note: {
      value: note.value,
      secret: note.secret,
      nullifier: note.nullifier,
      ownerPubX: owner.x,
      ownerPubY: owner.y,
      ownerMode: '0',
      assetHi: note.asset_hi,
      assetLo: note.asset_lo,
      applicationId: note.application_id?.trim() || '0',
    },
  };
}

export function publicOutputNoteBuffers(note: StellarPublicOutputNoteFields) {
  return {
    value: fieldElementToBytes(note.value),
    secret: fieldElementToBytes(note.secret),
    nullifier: fieldElementToBytes(note.nullifier),
    owner_pub_x: Buffer.from(
      note.ownerPubX.padStart(COORDINATE_HEX_LENGTH, '0'),
      'hex',
    ),
    owner_pub_y: Buffer.from(
      note.ownerPubY.padStart(COORDINATE_HEX_LENGTH, '0'),
      'hex',
    ),
    owner_mode: fieldElementToBytes(note.ownerMode),
    asset_hi: fieldElementToBytes(note.assetHi),
    asset_lo: fieldElementToBytes(note.assetLo),
    application_id: fieldElementToBytes(note.applicationId),
  };
}
