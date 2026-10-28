export function pinnedOutputAmount(step: {
  readonly pinnedOutputs: readonly {
    readonly plaintext: { readonly amount: bigint };
  }[];
}): bigint {
  let total = 0n;
  for (const note of step.pinnedOutputs) {
    total += note.plaintext.amount;
  }
  return total;
}
