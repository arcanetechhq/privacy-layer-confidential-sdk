export class UnownedNoteError extends Error {
  constructor() {
    super('Note is not owned by the Service scalar');
    this.name = 'UnownedNoteError';
  }
}
