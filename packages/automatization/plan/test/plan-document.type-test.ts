import { expectTypeOf, test } from 'vitest';
import type {
  Deposit,
  NotePlaintext,
  Payout,
  PinnedNote,
  Plan,
  Step,
} from '../src/index.js';

type KeysDeep<T> = T extends readonly (infer Item)[]
  ? KeysDeep<Item>
  : T extends bigint | string | boolean | number
    ? never
    : T extends object
      ? keyof T | { [K in keyof T]-?: KeysDeep<T[K]> }[keyof T]
      : never;

type DocumentKeys = KeysDeep<Plan> | KeysDeep<NotePlaintext> | KeysDeep<PinnedNote>;

type ScalarKey = Extract<DocumentKeys, `${string}${'scalar' | 'Scalar'}${string}`>;

type ExcludedNoteKey = Extract<
  DocumentKeys,
  'feeNote' | 'feeNotes' | 'unspentNote' | 'unspentNotes'
>;

test('the Plan document has no owner scalar', () => {
  expectTypeOf<ScalarKey>().toEqualTypeOf<never>();
  expectTypeOf<ExcludedNoteKey>().toEqualTypeOf<never>();
});

test('a Step stores Free tokens, an interval, pinned notes, and an optional transaction id', () => {
  expectTypeOf<Step['freeTokens']>().toEqualTypeOf<bigint>();
  expectTypeOf<Step['interval']>().toEqualTypeOf<bigint>();
  expectTypeOf<Step['pinnedInputs']>().toEqualTypeOf<readonly PinnedNote[]>();
  expectTypeOf<Step['pinnedOutputs']>().toEqualTypeOf<readonly PinnedNote[]>();
  expectTypeOf<Step['transactionId']>().toEqualTypeOf<string | undefined>();
});

test('a Payout stores an account and a public amount', () => {
  expectTypeOf<Payout['account']>().toEqualTypeOf<string>();
  expectTypeOf<Payout['amount']>().toEqualTypeOf<bigint>();
  expectTypeOf<Deposit['amount']>().toEqualTypeOf<bigint>();
});

test('a pinned note stores plaintext, a commitment, and a nullifier hash', () => {
  expectTypeOf<NotePlaintext['amount']>().toEqualTypeOf<bigint>();
  expectTypeOf<NotePlaintext['accumulator']>().toEqualTypeOf<string>();
  expectTypeOf<PinnedNote['commitment']>().toEqualTypeOf<string>();
  expectTypeOf<PinnedNote['nullifierHash']>().toEqualTypeOf<string>();
});
