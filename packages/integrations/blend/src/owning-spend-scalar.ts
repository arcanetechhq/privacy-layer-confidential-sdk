import { deriveInterestDepositSeed } from './derive-interest-deposit-seed.js';
import { interestDepositAccount } from './interest-deposit-account.js';

export async function owningSpendScalar(input: {
  spendScalars: readonly Uint8Array[];
  account: string;
  blendPoolContractId: Uint8Array;
  tokenContractId: Uint8Array;
  chainIndex: number;
}): Promise<Uint8Array> {
  for (const spendScalar of input.spendScalars) {
    const seed = await deriveInterestDepositSeed({
      spendScalar,
      blendPoolContractId: input.blendPoolContractId,
      tokenContractId: input.tokenContractId,
      chainIndex: input.chainIndex,
    });
    if (interestDepositAccount(seed) === input.account) {
      return spendScalar;
    }
  }
  throw new Error('No spend scalar owns this Interest Deposit.');
}
