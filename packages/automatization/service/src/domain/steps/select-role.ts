import type { StepPlace } from '../../ports/index.js';

export function selectRole<T>(
  kind: 'deposit' | 'payout',
  role: StepPlace['role'],
  values: { readonly deposit: T; readonly transfer: T; readonly withdrawal: T },
): T {
  if (kind === 'deposit') {
    if (role !== 'deposit') {
      throw new Error('That Row is a Deposit');
    }
    return values.deposit;
  }
  if (role === 'deposit') {
    throw new Error('That Row is a Payout');
  }
  if (role === 'transfer') {
    return values.transfer;
  }
  return values.withdrawal;
}
