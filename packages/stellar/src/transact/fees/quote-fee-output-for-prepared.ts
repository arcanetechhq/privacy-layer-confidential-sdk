import type { StellarPreparedOperation } from '../../types.js';
import type { StellarTransactEnvironment } from '../environment/types.js';
import type { FeeOutputSpec } from './append-fee-output.js';
import { quoteRequiredFee } from './quote-required-fee.js';
import {
  feeOutputKindFromPrepared,
  shouldAttachFeeOutput,
} from './should-attach-fee-output.js';

function instructedMinorUnits(prepared: StellarPreparedOperation): string {
  return prepared.intent.amount.toString();
}

const PUBLIC_WITHDRAWAL_FEE = 'public-withdrawal';

function feeQuoteRequestForPrepared(input: {
  prepared: StellarPreparedOperation;
  tokenAddress: string;
}) {
  const amount = instructedMinorUnits(input.prepared);
  if (chargesPublicWithdrawalFee(input.prepared)) {
    return {
      feeAsset: input.tokenAddress,
      publicWithdrawalAmount: amount,
      spendsNotes: true,
    };
  }
  if (input.prepared.kind === 'deposit') {
    return {
      feeAsset: input.tokenAddress,
      publicDepositAmount: amount,
      spendsNotes: false,
    };
  }
  return {
    feeAsset: input.tokenAddress,
    transferInstructedAmount: amount,
    spendsNotes: true,
  };
}

export async function quoteFeeOutputForPrepared(input: {
  prepared: StellarPreparedOperation;
  environment: StellarTransactEnvironment;
  tokenAddress: string;
}): Promise<FeeOutputSpec | undefined> {
  if (!shouldAttachFeeOutput(feeOutputKindFromPrepared(input.prepared))) {
    return undefined;
  }
  const quote = await quoteRequiredFee({
    transactEnvironment: input.environment,
    request: feeQuoteRequestForPrepared(input),
  });
  if (quote.requiredFee <= 0n) {
    return undefined;
  }
  return {
    requiredFee: quote.requiredFee,
    feeCollectorPrivateAddress: quote.feeCollectorPrivateAddress,
  };
}

function chargesPublicWithdrawalFee(prepared: StellarPreparedOperation): boolean {
  if (prepared.kind === 'withdraw') {
    return true;
  }
  const schedule = (prepared.intent as { feeSchedule?: string }).feeSchedule;
  return prepared.kind === 'deposit' && schedule === PUBLIC_WITHDRAWAL_FEE;
}

export function remainingAfterRequiredFee(input: {
  available: bigint;
  instructed: bigint;
  requiredFee: bigint;
}): bigint {
  const remaining = input.available - input.instructed - input.requiredFee;
  if (remaining < 0n) {
    throw new Error('Instructed amount and Required Fee exceed available note value');
  }
  return remaining;
}
