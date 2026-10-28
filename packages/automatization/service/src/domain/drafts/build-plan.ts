import {
  pinnedOutputAmount,
  type NotePlaintext,
  type PinnedNote,
  type Plan,
  type Row,
  type Step,
} from '@arcanetech/privacy-sdk-automatization-plan';
import { mode001Accumulator, mode010Accumulator } from '../notes/index.js';
import {
  batchSizes,
  segmentsOf,
  type CreatorBuild,
  type ExitDraft,
  type PayoutDraft,
  type RowDraft,
  type SegmentDraft,
} from './plan-drafts.js';
import type { NoteDeriver } from '../../ports/index.js';

function pin(plaintext: NotePlaintext, deriver: NoteDeriver): PinnedNote {
  const derived = deriver.derive(plaintext);
  return {
    plaintext,
    commitment: derived.commitment,
    nullifierHash: derived.nullifierHash,
  };
}

function noteTotal(notes: readonly PinnedNote[]): bigint {
  return pinnedOutputAmount({ pinnedOutputs: notes });
}

function deriveExit(exit: ExitDraft, deriver: NoteDeriver): PinnedNote {
  return pin(
    {
      amount: exit.noteAmount,
      accumulator: mode010Accumulator(exit.account, exit.payoutAmount),
    },
    deriver,
  );
}

function creatorsFor(
  segment: SegmentDraft,
  forwards: boolean,
  deriver: NoteDeriver,
): CreatorBuild[] {
  const sizes = batchSizes(segment.exits.length, forwards);
  const creators: CreatorBuild[] = [];
  let cursor = 0;
  for (const [batch, take] of sizes.entries()) {
    const slice = segment.exits.slice(cursor, cursor + take);
    cursor += take;
    if (batch === 0) {
      creators.push({
        kind: 'deposit',
        draftIndex: segment.depositIndex,
        freeTokens: segment.deposit.freeTokens,
        interval: segment.deposit.interval,
        publicDeposit: segment.deposit.amount,
        exits: slice.map((exit) => deriveExit(exit, deriver)),
      });
      continue;
    }
    const owner = slice[0];
    if (!owner) {
      throw new Error('Missing Payout for an intermediate Transfer');
    }
    creators.push({
      kind: 'transfer',
      draftIndex: owner.draftIndex,
      freeTokens: owner.transferFreeTokens,
      interval: owner.transferInterval,
      publicDeposit: 0n,
      exits: slice.map((exit) => deriveExit(exit, deriver)),
    });
  }
  return creators;
}

function outputsPinnedByRemainder(creator: CreatorBuild): PinnedNote[] {
  return creator.remainder === undefined
    ? [...creator.exits]
    : [...creator.exits, creator.remainder];
}

function linkRemainders(creators: readonly CreatorBuild[], deriver: NoteDeriver): void {
  for (let index = creators.length - 1; index >= 1; index -= 1) {
    const spender = creators[index];
    const creator = creators[index - 1];
    if (!spender || !creator) {
      throw new Error('Missing Step while building a Remainder');
    }
    const needed =
      noteTotal(outputsPinnedByRemainder(spender)) +
      spender.freeTokens -
      spender.publicDeposit;
    if (needed <= 0n) {
      continue;
    }
    const remainder = pin(
      {
        amount: needed,
        accumulator: mode001Accumulator(outputsPinnedByRemainder(spender)),
      },
      deriver,
    );
    creator.remainder = remainder;
    spender.incoming = remainder;
  }
}

function addChange(creators: readonly CreatorBuild[], deriver: NoteDeriver): void {
  for (const creator of creators) {
    if (creator.incoming !== undefined) {
      continue;
    }
    const covered = creator.publicDeposit;
    const used =
      noteTotal(creator.exits) +
      (creator.remainder?.plaintext.amount ?? 0n) +
      creator.freeTokens;
    if (covered <= used) {
      continue;
    }
    creator.change = pin({ amount: covered - used, accumulator: '' }, deriver);
  }
}

function freeze(creator: CreatorBuild): Step {
  return {
    freeTokens: creator.freeTokens,
    interval: creator.interval,
    pinnedInputs: creator.incoming === undefined ? [] : [creator.incoming],
    pinnedOutputs: [
      ...creator.exits,
      ...(creator.remainder === undefined ? [] : [creator.remainder]),
      ...(creator.change === undefined ? [] : [creator.change]),
    ],
  };
}

function withdrawalFor(exit: ExitDraft, note: PinnedNote): Step {
  return {
    freeTokens: exit.withdrawalFreeTokens,
    interval: exit.withdrawalInterval,
    pinnedInputs: [note],
    pinnedOutputs: [],
  };
}

function incomingNeed(segment: SegmentDraft, outgoing: bigint): bigint {
  const sizes = batchSizes(segment.exits.length, outgoing > 0n);
  let transferFree = 0n;
  let cursor = sizes[0] ?? 0;
  for (let batch = 1; batch < sizes.length; batch += 1) {
    const owner = segment.exits[cursor];
    if (!owner) {
      throw new Error('Missing Payout for an intermediate Transfer');
    }
    transferFree += owner.transferFreeTokens;
    cursor += sizes[batch] ?? 0;
  }
  let exits = 0n;
  for (const exit of segment.exits) {
    exits += exit.noteAmount;
  }
  const needed =
    exits +
    segment.deposit.freeTokens +
    transferFree +
    outgoing -
    segment.deposit.amount;
  return needed > 0n ? needed : 0n;
}

function buildCreators(
  segments: readonly SegmentDraft[],
  deriver: NoteDeriver,
): CreatorBuild[] {
  const creators: CreatorBuild[] = [];
  let outgoing = 0n;
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (!segment) {
      throw new Error('Missing Deposit while building a Plan');
    }
    creators.unshift(...creatorsFor(segment, outgoing > 0n, deriver));
    outgoing = incomingNeed(segment, outgoing);
  }
  linkRemainders(creators, deriver);
  addChange(creators, deriver);
  return creators;
}

interface BuiltSteps {
  readonly deposits: Map<number, Step>;
  readonly transfers: Map<number, Step>;
  readonly withdrawals: Map<number, Step>;
}

function builtSteps(
  creators: readonly CreatorBuild[],
  segments: readonly SegmentDraft[],
): BuiltSteps {
  const built: BuiltSteps = {
    deposits: new Map(),
    transfers: new Map(),
    withdrawals: new Map(),
  };
  const exits = segments.flatMap((segment) => [...segment.exits]);
  let exitCursor = 0;
  for (const creator of creators) {
    const steps = creator.kind === 'deposit' ? built.deposits : built.transfers;
    steps.set(creator.draftIndex, freeze(creator));
    for (const note of creator.exits) {
      const exit = exits[exitCursor];
      exitCursor += 1;
      if (!exit) {
        throw new Error('Missing Payout for a mode 010 note');
      }
      built.withdrawals.set(exit.draftIndex, withdrawalFor(exit, note));
    }
  }
  return built;
}

function payoutRow(row: PayoutDraft, index: number, built: BuiltSteps): Row {
  const withdrawal = built.withdrawals.get(index);
  if (!withdrawal) {
    throw new Error('Missing mode 010 note for a Payout');
  }
  const transfer = built.transfers.get(index);
  return {
    kind: 'payout',
    account: row.account,
    amount: row.amount,
    withdrawal,
    ...(transfer === undefined ? {} : { transfer }),
  };
}

export function planFromDrafts(
  drafts: readonly RowDraft[],
  deriver: NoteDeriver,
): Plan {
  if (drafts[0]?.kind !== 'deposit') {
    throw new Error('Plan must start with an Initial Deposit');
  }
  const segments = segmentsOf(drafts);
  const built = builtSteps(buildCreators(segments, deriver), segments);
  const rows = drafts.map((row, index): Row => {
    if (row.kind === 'payout') {
      return payoutRow(row, index, built);
    }
    const step = built.deposits.get(index);
    if (!step) {
      throw new Error('Missing Deposit Step');
    }
    return { kind: 'deposit', amount: row.amount, step };
  });
  return { rows };
}
