import type { Step } from './document.js';

export interface PinnedNotePresence {
  readonly consumedNullifierHashes: readonly string[];
  readonly outputCommitmentsInPoolTree: readonly string[];
}

function includesEvery(
  required: readonly string[],
  present: readonly string[],
): boolean {
  const found = new Set(present);
  return required.every((value) => found.has(value));
}

export function isExecutedStep(step: Step, presence: PinnedNotePresence): boolean {
  const nullifierHashes = step.pinnedInputs.map((note) => note.nullifierHash);
  const commitments = step.pinnedOutputs.map((note) => note.commitment);
  return (
    includesEvery(nullifierHashes, presence.consumedNullifierHashes) &&
    includesEvery(commitments, presence.outputCommitmentsInPoolTree)
  );
}

export function isBlockedStep(step: Step, presence: PinnedNotePresence): boolean {
  if (isExecutedStep(step, presence)) {
    return false;
  }
  const consumed = new Set(presence.consumedNullifierHashes);
  return step.pinnedInputs.some((note) => consumed.has(note.nullifierHash));
}
