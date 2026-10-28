export class DepositAuthorizationMismatchError extends Error {
  constructor() {
    super('Deposit authorization signs a different composition');
    this.name = 'DepositAuthorizationMismatchError';
  }
}
