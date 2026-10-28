import type { PinnedNote } from '@arcanetech/privacy-sdk-automatization-plan';

export function mode001Accumulator(outputs: readonly PinnedNote[]): string {
  return `001:${outputs.map((note) => note.commitment).join(',')}`;
}
