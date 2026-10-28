export function mode010Accumulator(account: string, amount: bigint): string {
  return `010:${account}:${amount.toString()}`;
}
