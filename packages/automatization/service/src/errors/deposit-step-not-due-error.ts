export class DepositStepNotDueError extends Error {
  constructor() {
    super('Deposit Step is not due');
    this.name = 'DepositStepNotDueError';
  }
}
