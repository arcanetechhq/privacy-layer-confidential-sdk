import { expectTypeOf, test } from 'vitest';
import type {
  PinnedNotePresence,
  Plan,
} from '@arcanetech/privacy-sdk-automatization-plan';
import type { PlanProgress, StepProgress } from '../src/index.js';
import { planProgress } from '../src/index.js';

type KeysDeep<T> = T extends readonly (infer Item)[]
  ? KeysDeep<Item>
  : T extends bigint | string | boolean | number
    ? never
    : T extends object
      ? keyof T | { [K in keyof T]-?: KeysDeep<T[K]> }[keyof T]
      : never;

type ProgressKeys = KeysDeep<PlanProgress>;

type ScalarKey = Extract<ProgressKeys, `${string}${'scalar' | 'Scalar'}${string}`>;

type ExcludedKey = Extract<
  ProgressKeys,
  | 'feeNote'
  | 'feeNotes'
  | 'unspentNote'
  | 'unspentNotes'
  | 'executionMaterial'
  | 'authorization'
  | 'serviceScalar'
>;

test('plan progress takes a Plan and a presence report', () => {
  expectTypeOf<Parameters<typeof planProgress>>().toEqualTypeOf<
    [Plan, PinnedNotePresence]
  >();
});

test('the progress view has no Service scalar and no Execution material', () => {
  expectTypeOf<ScalarKey>().toEqualTypeOf<never>();
  expectTypeOf<ExcludedKey>().toEqualTypeOf<never>();
});

test('Free tokens are an amount', () => {
  expectTypeOf<StepProgress['freeTokens']>().toEqualTypeOf<bigint>();
});
