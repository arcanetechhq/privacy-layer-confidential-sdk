export class AccumulatorMismatchError extends Error {
  constructor() {
    super('Accumulator does not match the pinned outputs');
    this.name = 'AccumulatorMismatchError';
  }
}
