import type { NoteDeriver, NoteOwnership } from '../ports/index.js';

export function createDerivedNoteOwnership(
  notes: NoteDeriver,
  serviceScalar: string,
): NoteOwnership {
  return {
    isOwnedByServiceScalar(note, scalar) {
      if (scalar !== serviceScalar) {
        return Promise.resolve(false);
      }
      const derived = notes.derive(note.plaintext);
      return Promise.resolve(
        derived.commitment === note.commitment &&
          derived.nullifierHash === note.nullifierHash,
      );
    },
  };
}
