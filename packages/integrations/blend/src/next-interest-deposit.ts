import { deriveInterestDepositSeed } from './derive-interest-deposit-seed.js';
import { interestDepositAccount } from './interest-deposit-account.js';

export interface NextInterestDeposit {
  chainIndex: number;
  account: string;
}

export interface NextInterestDepositInput {
  spendScalar: Uint8Array;
  blendPoolContractId: Uint8Array;
  tokenContractId: Uint8Array;
  recorded: (account: string) => Promise<boolean>;
}

export async function nextInterestDeposit(
  input: NextInterestDepositInput,
): Promise<NextInterestDeposit> {
  return firstFreeIndex(input, 0);
}

async function firstFreeIndex(
  input: NextInterestDepositInput,
  chainIndex: number,
): Promise<NextInterestDeposit> {
  const seed = await deriveInterestDepositSeed({
    spendScalar: input.spendScalar,
    blendPoolContractId: input.blendPoolContractId,
    tokenContractId: input.tokenContractId,
    chainIndex,
  });
  const account = interestDepositAccount(seed);
  if (!(await input.recorded(account))) {
    return { chainIndex, account };
  }
  return firstFreeIndex(input, chainIndex + 1);
}
