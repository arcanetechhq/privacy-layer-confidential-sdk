export class DepositRefusedError extends Error {
  constructor(message = 'The pool refused this Deposit') {
    super(message);
    this.name = 'DepositRefusedError';
  }
}
