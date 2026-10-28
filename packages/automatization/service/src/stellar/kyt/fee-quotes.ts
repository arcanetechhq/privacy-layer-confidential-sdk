import { quoteRequiredFee } from '@arcanetech/privacy-sdk-stellar/transact';
import type { FeeQuote, FeeQuoteRequest, FeeQuotes } from '../../ports/index.js';
import {
  transactEnvironmentFor,
  type StellarKytAccess,
  type StellarServiceNetwork,
} from './kyt-access.js';

const DEFAULT_QUOTE_CACHE_MS = 60_000;

export interface KytFeeQuotesConfig {
  readonly network: StellarServiceNetwork;
  readonly kyt: StellarKytAccess;
  readonly assetContract: string;
  readonly quoteCacheMs?: number;
}

function transferAmount(request: FeeQuoteRequest): bigint {
  const publicLegs = request.publicDeposit + request.publicWithdrawal;
  return request.valueMoved > publicLegs ? request.valueMoved - publicLegs : 0n;
}

export function createKytFeeQuotes(config: KytFeeQuotesConfig): FeeQuotes {
  const transactEnvironment = transactEnvironmentFor(config.network, config.kyt);
  const ttl = config.quoteCacheMs ?? DEFAULT_QUOTE_CACHE_MS;
  const cache = new Map<string, { readonly at: number; readonly quote: FeeQuote }>();
  return {
    async quote(request) {
      const key = `${request.publicDeposit}|${request.valueMoved}|${request.publicWithdrawal}`;
      const cached = cache.get(key);
      if (cached !== undefined && Date.now() - cached.at < ttl) {
        return cached.quote;
      }
      const transfer = transferAmount(request);
      const quoted = await quoteRequiredFee({
        transactEnvironment,
        request: {
          feeAsset: config.assetContract,
          spendsNotes: transfer > 0n,
          publicDepositAmount: request.publicDeposit.toString(),
          transferInstructedAmount: transfer.toString(),
          publicWithdrawalAmount: request.publicWithdrawal.toString(),
        },
      });
      const quote = {
        amount: quoted.requiredFee,
        collector: quoted.feeCollectorPrivateAddress,
      };
      cache.set(key, { at: Date.now(), quote });
      return quote;
    },
  };
}
