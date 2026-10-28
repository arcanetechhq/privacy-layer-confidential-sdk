import type {
  DepositAuthorization,
  PreparedDeposit,
  StepPlace,
  StoredUnspentNote,
  UnspentNoteShape,
} from '../../ports/index.js';

export function samePlace(left: StepPlace, right: StepPlace): boolean {
  return left.rowIndex === right.rowIndex && left.role === right.role;
}

function copyPlace(place: StepPlace): StepPlace {
  return { rowIndex: place.rowIndex, role: place.role };
}

function copyUnspentShape(note: UnspentNoteShape): UnspentNoteShape {
  return { amount: note.amount, accumulator: note.accumulator, scalar: note.scalar };
}

export function copyAuthorization(
  authorization: DepositAuthorization,
): DepositAuthorization {
  return {
    invocation: {
      root: authorization.invocation.root,
      pinnedOutputCommitments: [...authorization.invocation.pinnedOutputCommitments],
    },
    sorobanAuthorization: authorization.sorobanAuthorization,
  };
}

export function copyPreparedDeposit(prepared: PreparedDeposit): PreparedDeposit {
  return {
    step: copyPlace(prepared.step),
    quote: { amount: prepared.quote.amount, collector: prepared.quote.collector },
    invocation: {
      root: prepared.invocation.root,
      pinnedOutputCommitments: [...prepared.invocation.pinnedOutputCommitments],
    },
    ...(prepared.unspentNote === undefined
      ? {}
      : { unspentNote: copyUnspentShape(prepared.unspentNote) }),
  };
}

export function copyUnspentNote(note: StoredUnspentNote): StoredUnspentNote {
  return { planId: note.planId, step: copyPlace(note.step), ...copyUnspentShape(note) };
}
