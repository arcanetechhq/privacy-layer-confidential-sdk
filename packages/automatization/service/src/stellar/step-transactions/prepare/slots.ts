import type { PinnedNote } from '@arcanetech/privacy-sdk-automatization-plan';
import {
  recipientPublicKeysDecimalFromStealthAddress,
  withdrawObjectFromMerkleWitness,
  type DepositObject,
  type PrivacyPoolSDK,
  type WithdrawObject,
  type ZkLayoutParams,
} from '@arcanetech/stellar-privacy-pool-zk-sdk';
import type { NoteOpening, StellarNoteDeriver } from '../../notes/index.js';

type AccumulatorDeposit = DepositObject & { readonly accumulator: string };
type AccumulatorWithdraw = WithdrawObject & {
  readonly accumulator: string;
  readonly inclusionMask: string[];
};

export interface SlotContext {
  readonly sdk: PrivacyPoolSDK;
  readonly layout: ZkLayoutParams;
  readonly notes: StellarNoteDeriver;
}

export function depositFrom(
  context: SlotContext,
  opened: NoteOpening,
  amount: bigint,
): AccumulatorDeposit {
  return {
    value: amount.toString(),
    nullifier: opened.nullifier,
    ephemeralKeyScalar: opened.ephemeralScalar,
    asset: context.notes.asset,
    applicationId: context.notes.applicationId,
    recipientPublicKeys: opened.ownerPub,
    accumulator: opened.accumulator,
  };
}

export function feeDeposit(
  context: SlotContext,
  collector: string,
  amount: bigint,
): AccumulatorDeposit {
  return {
    value: amount.toString(),
    nullifier: context.notes.freshNullifier(),
    ephemeralKeyScalar: context.notes.freshEphemeral(),
    asset: context.notes.asset,
    applicationId: context.notes.applicationId,
    recipientPublicKeys: recipientPublicKeysDecimalFromStealthAddress(collector),
    accumulator: '0',
  };
}

export function pinnedOutputDeposits(
  context: SlotContext,
  outputs: readonly PinnedNote[],
): AccumulatorDeposit[] {
  return outputs.map((note) => {
    const opened = context.notes.openPinned(note.plaintext);
    if (opened.commitment !== note.commitment) {
      throw new Error('Pinned output does not match the service opening');
    }
    return depositFrom(context, opened, note.plaintext.amount);
  });
}

export function pinnedInputWithdraws(
  context: SlotContext,
  input: {
    readonly inputs: readonly PinnedNote[];
    readonly outputCount: number;
    readonly leaves: readonly string[];
    readonly root: string;
  },
): AccumulatorWithdraw[] {
  const inclusionMask = Array.from(
    { length: context.layout.nOuts },
    (_unused, index) => (index < input.outputCount ? '1' : '0'),
  );
  return input.inputs.map((note) => {
    const opened = context.notes.openPinned(note.plaintext);
    if (
      opened.commitment !== note.commitment ||
      opened.nullifierHash !== note.nullifierHash
    ) {
      throw new Error('Pinned input does not match the service opening');
    }
    const witness = context.sdk.buildWithdrawMerkleWitness(
      {
        value: note.plaintext.amount.toString(),
        nullifier: opened.nullifier,
        secret: opened.secret,
        commitment: opened.commitment,
        asset_hi: context.notes.asset[0],
        asset_lo: context.notes.asset[1],
        application_id: context.notes.applicationId,
      },
      { commitments: [...input.leaves] },
    );
    if (BigInt(witness.stateRoot) !== BigInt(input.root)) {
      throw new Error('Rebuilt Merkle root does not match the pool');
    }
    return {
      ...withdrawObjectFromMerkleWitness(
        witness,
        opened.ownerPubHex,
        context.notes.applicationId,
        context.notes.serviceScalar,
      ),
      accumulator: opened.accumulator,
      inclusionMask,
    };
  });
}

export function applicationIdHints(
  context: SlotContext,
  activeInputs: number,
  activeOutputs: number,
): string[] {
  const hint = (active: number) => (_unused: unknown, index: number) =>
    index < active ? context.notes.applicationId : '0';
  return [
    ...Array.from({ length: context.layout.nIns }, hint(activeInputs)),
    ...Array.from({ length: context.layout.nOuts }, hint(activeOutputs)),
  ];
}
