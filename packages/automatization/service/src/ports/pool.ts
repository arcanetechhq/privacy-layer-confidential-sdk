import type {
  PinnedNote,
  PinnedNotePresence,
} from '@arcanetech/privacy-sdk-automatization-plan';
import type { DepositAuthorization, TransactInvocation } from './transact.js';

export interface CurrentRoot {
  current(): Promise<string>;
}

export interface Presence {
  report(): Promise<PinnedNotePresence>;
}

export interface ServiceTransaction {
  readonly envelopeSigner: string;
  readonly invocation: TransactInvocation;
}

export type PoolSubmissionResult =
  { readonly ok: true; readonly transactionId: string } | { readonly ok: false };

export interface PoolSubmission {
  submit(
    transaction: ServiceTransaction,
    authorization?: DepositAuthorization,
  ): Promise<PoolSubmissionResult>;
}

export interface NoteOwnership {
  isOwnedByServiceScalar(note: PinnedNote, serviceScalar: string): Promise<boolean>;
}
