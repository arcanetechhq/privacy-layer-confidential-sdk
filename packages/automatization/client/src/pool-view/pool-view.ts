import type {
  PinnedNote,
  PinnedNotePresence,
  Plan,
} from '@arcanetech/privacy-sdk-automatization-plan';
import type { PlanProgress } from '../progress/index.js';
import type { DepositInvocation } from '../signing/index.js';

export interface PoolView {
  merkleRoot(): Promise<string>;
  isNullifierConsumed(nullifierHash: string): Promise<boolean>;
  commitmentsInTree(): Promise<readonly string[]>;
}

export async function readPinnedPresence(
  plan: Plan,
  pool: PoolView,
): Promise<PinnedNotePresence> {
  const notes = notesIn(plan);
  return {
    consumedNullifierHashes: await consumedNullifiers(pool, notes),
    outputCommitmentsInPoolTree: await commitmentsPresent(pool, notes),
  };
}

export function waitingDeposit(
  plan: Plan,
  progress: PlanProgress,
  invocation?: DepositInvocation,
): number | undefined {
  if (invocation === undefined) {
    return undefined;
  }
  const wanted = invocation.pinnedOutputCommitments.join(' ');
  for (const [index, row] of plan.rows.entries()) {
    const shown = progress.rows[index];
    if (row.kind !== 'deposit' || shown?.kind !== 'deposit' || shown.step.executed) {
      continue;
    }
    const pinned = row.step.pinnedOutputs.map((note) => note.commitment).join(' ');
    if (pinned === wanted) {
      return index;
    }
  }
  return undefined;
}

function notesIn(plan: Plan): PinnedNote[] {
  const notes: PinnedNote[] = [];
  for (const row of plan.rows) {
    if (row.kind === 'deposit') {
      notes.push(...row.step.pinnedInputs, ...row.step.pinnedOutputs);
      continue;
    }
    if (row.transfer !== undefined) {
      notes.push(...row.transfer.pinnedInputs, ...row.transfer.pinnedOutputs);
    }
    notes.push(...row.withdrawal.pinnedInputs, ...row.withdrawal.pinnedOutputs);
  }
  return notes;
}

async function consumedNullifiers(
  pool: PoolView,
  notes: readonly PinnedNote[],
): Promise<string[]> {
  const consumed: string[] = [];
  for (const hash of unique(notes.map((note) => note.nullifierHash))) {
    if (await pool.isNullifierConsumed(hash)) {
      consumed.push(hash);
    }
  }
  return consumed;
}

async function commitmentsPresent(
  pool: PoolView,
  notes: readonly PinnedNote[],
): Promise<string[]> {
  const present = new Set(await pool.commitmentsInTree());
  return unique(notes.map((note) => note.commitment)).filter((commitment) =>
    present.has(commitment),
  );
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
