import type { NotePlaintext } from '@arcanetech/privacy-sdk-automatization-plan';

export interface Recipient {
  readonly account: string;
  readonly amount: bigint;
}

export interface ComposeInput {
  readonly recipients: readonly Recipient[];
  readonly freeTokenFloor: bigint;
  readonly standardInterval: bigint;
}

export interface NoteDerivation {
  readonly commitment: string;
  readonly nullifierHash: string;
}

export interface NoteDeriver {
  derive(plaintext: NotePlaintext): NoteDerivation;
}

export interface StepPlace {
  readonly rowIndex: number;
  readonly role: 'deposit' | 'transfer' | 'withdrawal';
}
