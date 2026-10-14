export class PublicWithdrawNoteError extends Error {
  readonly code = 'public_withdraw_note_unavailable';
  readonly asset: string;
  readonly amount: bigint;
  readonly noteId?: string;

  constructor(input: { asset: string; amount: bigint; noteId?: string }) {
    super('No unspent note matches this public withdraw.');
    this.name = 'PublicWithdrawNoteError';
    this.asset = input.asset;
    this.amount = input.amount;
    if (input.noteId !== undefined) {
      this.noteId = input.noteId;
    }
  }
}
