export interface NotePlaintext {
  readonly amount: bigint;
  readonly accumulator: string;
}

export interface PinnedNote {
  readonly plaintext: NotePlaintext;
  readonly commitment: string;
  readonly nullifierHash: string;
}

export interface Step {
  readonly freeTokens: bigint;
  readonly interval: bigint;
  readonly pinnedInputs: readonly PinnedNote[];
  readonly pinnedOutputs: readonly PinnedNote[];
  readonly transactionId?: string;
}

export interface Deposit {
  readonly kind: 'deposit';
  readonly amount: bigint;
  readonly step: Step;
}

export interface Payout {
  readonly kind: 'payout';
  readonly account: string;
  readonly amount: bigint;
  readonly transfer: Step;
  readonly withdrawal: Step;
}

export type Row = Deposit | Payout;

export interface Plan {
  readonly rows: readonly Row[];
}
