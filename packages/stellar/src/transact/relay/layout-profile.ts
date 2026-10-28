import {
  BINDING_ZK_NONCE,
  COMMITMENT_V2_ZK_NONCE,
  SIX_BY_SIX_BINDING_ZK_NONCE,
  SIX_BY_SIX_ZK_NONCE,
  STANDARD_ZK_CONFIG_NONCE,
} from '../environment/zk-config-nonce.js';

type ZkLayoutShape = {
  nIns: number;
  nOuts: number;
  publicNInputs: number;
  publicNOutputs: number;
  nAuditSlots: number;
  noteAuditLen: number;
  noteOutputLen: number;
};

export type RelayLayoutProfile = {
  nonce: bigint;
  signalCount: number;
  fieldBytes: number;
  prefixBytes: number;
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
};

const FIELD_BYTES = 32;
const PREFIX_BYTES = 4;
const LEGACY_PUBLIC_INPUT_PREFIX_LEN = 5;
const V2_PUBLIC_INPUT_PREFIX_LEN = 7;
const EPHEMERAL_COORDINATE_COUNT = 2;
const STANDARD_SHAPE: ZkLayoutShape = {
  nIns: 2,
  nOuts: 2,
  publicNInputs: 1,
  publicNOutputs: 1,
  nAuditSlots: 4,
  noteAuditLen: 12,
  noteOutputLen: 6,
};
const SIX_BY_SIX_SHAPE: ZkLayoutShape = {
  nIns: 6,
  nOuts: 6,
  publicNInputs: 1,
  publicNOutputs: 1,
  nAuditSlots: 12,
  noteAuditLen: 12,
  noteOutputLen: 6,
};

function profileFromShape(
  nonce: bigint,
  shape: ZkLayoutShape,
  publicInputPrefixLength: number,
  ciphertextsInPublicSignals: boolean,
): RelayLayoutProfile {
  const auditOffset =
    shape.nIns + shape.nOuts + shape.nOuts * EPHEMERAL_COORDINATE_COUNT;
  const outputNoteOffset = ciphertextsInPublicSignals
    ? auditOffset +
      shape.nAuditSlots * EPHEMERAL_COORDINATE_COUNT +
      shape.nAuditSlots * shape.noteAuditLen +
      shape.nAuditSlots
    : auditOffset + EPHEMERAL_COORDINATE_COUNT + shape.nAuditSlots;
  const publicOutputsLength = ciphertextsInPublicSignals
    ? outputNoteOffset + shape.nOuts * shape.noteOutputLen + shape.nOuts
    : outputNoteOffset + shape.nOuts;
  const signalCount =
    publicOutputsLength +
    publicInputPrefixLength +
    EPHEMERAL_COORDINATE_COUNT * shape.publicNInputs +
    EPHEMERAL_COORDINATE_COUNT * shape.publicNOutputs +
    shape.publicNInputs +
    shape.publicNOutputs +
    (ciphertextsInPublicSignals ? 0 : shape.publicNInputs);
  const stateRoot = publicOutputsLength;
  return {
    nonce,
    signalCount,
    fieldBytes: FIELD_BYTES,
    prefixBytes: PREFIX_BYTES,
    indices: {
      nullifier0: 0,
      nullifier1: 1,
      stateRoot,
      withdrawAddressHi: stateRoot + 1,
      withdrawAddressLo: stateRoot + 2,
      escrowRecipientHi: stateRoot + 3,
      escrowRecipientLo: stateRoot + 4,
      publicWithdrawalAssetHi: stateRoot + publicInputPrefixLength,
      publicWithdrawalAssetLo: stateRoot + publicInputPrefixLength + 1,
      publicDepositAssetHi: stateRoot + publicInputPrefixLength + 2,
      publicDepositAssetLo: stateRoot + publicInputPrefixLength + 3,
      publicDeposit: stateRoot + publicInputPrefixLength + 4,
      publicWithdrawal: stateRoot + publicInputPrefixLength + 5,
    },
  };
}

export function relayLayoutProfileForNonce(nonce: bigint): RelayLayoutProfile {
  if (nonce === STANDARD_ZK_CONFIG_NONCE) {
    return profileFromShape(
      nonce,
      STANDARD_SHAPE,
      LEGACY_PUBLIC_INPUT_PREFIX_LEN,
      true,
    );
  }
  if (nonce === COMMITMENT_V2_ZK_NONCE) {
    return profileFromShape(nonce, STANDARD_SHAPE, V2_PUBLIC_INPUT_PREFIX_LEN, true);
  }
  if (nonce === BINDING_ZK_NONCE) {
    return profileFromShape(nonce, STANDARD_SHAPE, V2_PUBLIC_INPUT_PREFIX_LEN, false);
  }
  if (nonce === SIX_BY_SIX_ZK_NONCE) {
    return profileFromShape(nonce, SIX_BY_SIX_SHAPE, V2_PUBLIC_INPUT_PREFIX_LEN, true);
  }
  if (nonce === SIX_BY_SIX_BINDING_ZK_NONCE) {
    return profileFromShape(nonce, SIX_BY_SIX_SHAPE, V2_PUBLIC_INPUT_PREFIX_LEN, false);
  }
  throw new Error(`Unknown ZK config nonce ${nonce.toString()}`);
}
