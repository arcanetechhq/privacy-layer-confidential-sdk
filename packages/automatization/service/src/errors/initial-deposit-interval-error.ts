export class InitialDepositIntervalError extends Error {
  constructor() {
    super('Initial Deposit interval cannot be changed');
    this.name = 'InitialDepositIntervalError';
  }
}
