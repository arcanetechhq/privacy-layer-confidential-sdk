import type { StellarPrivateRecord } from '../../types.js';
import { isPublicWithdrawNote, publicWithdrawNoteAmount } from './select-note.js';

export interface StellarPublicWithdrawNote {
  id: string;
  asset: string;
  amount: bigint;
  privateAddress: string;
}

export interface StellarPublicWithdrawNotePage {
  notes: StellarPublicWithdrawNote[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}

export function listPublicWithdrawNotes(input: {
  records: readonly StellarPrivateRecord[];
  page: number;
  pageSize: number;
  asset?: string;
}): StellarPublicWithdrawNotePage {
  const notes = input.records
    .filter(
      (record) =>
        isPublicWithdrawNote(record) &&
        (input.asset === undefined || record.asset === input.asset),
    )
    .toSorted((left, right) => left.id.localeCompare(right.id))
    .flatMap((record) => {
      const amount = publicWithdrawNoteAmount(record);
      const privateAddress = record.privateAddress?.trim();
      if (amount === undefined || !privateAddress) {
        return [];
      }
      return [
        {
          id: record.id,
          asset: record.asset,
          amount,
          privateAddress,
        },
      ];
    });
  const start = (input.page - 1) * input.pageSize;
  const pageNotes = notes.slice(start, start + input.pageSize);
  return {
    notes: pageNotes,
    pagination: {
      total: notes.length,
      page: input.page,
      pageSize: input.pageSize,
      hasMore: start + pageNotes.length < notes.length,
    },
  };
}
