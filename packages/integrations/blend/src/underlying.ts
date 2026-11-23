const BLEND_RATE_SCALE = 1_000_000_000_000n;

export function underlyingFromShares(shares: bigint, exchangeRate: bigint): bigint {
  return (shares * exchangeRate) / BLEND_RATE_SCALE;
}
