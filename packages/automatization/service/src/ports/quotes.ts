export interface FeeQuoteRequest {
  readonly publicDeposit: bigint;
  readonly valueMoved: bigint;
  readonly publicWithdrawal: bigint;
}

export interface FeeQuote {
  readonly amount: bigint;
  readonly collector: string;
}

export interface FeeQuotes {
  quote(request: FeeQuoteRequest): Promise<FeeQuote>;
}

export interface FeeNote {
  readonly amount: bigint;
  readonly accumulator: string;
  readonly collector: string;
}
