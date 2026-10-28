import {
  pinnedOutputAmount,
  type Plan,
} from '@arcanetech/privacy-sdk-automatization-plan';
import { planFromDrafts, type RowDraft } from '../../domain/drafts/index.js';
import type { ComposeInput, NoteDeriver } from '../../ports/index.js';

export function compose(input: ComposeInput, notes: NoteDeriver): Plan {
  const drafts: RowDraft[] = [
    {
      kind: 'deposit',
      amount: 0n,
      freeTokens: input.freeTokenFloor,
      interval: 0n,
    },
  ];
  for (const recipient of input.recipients) {
    drafts.push({
      kind: 'payout',
      account: recipient.account,
      amount: recipient.amount,
      transferFreeTokens: input.freeTokenFloor,
      transferInterval: input.standardInterval,
      withdrawalFreeTokens: input.freeTokenFloor,
      withdrawalInterval: input.standardInterval,
    });
  }
  const built = planFromDrafts(drafts, notes);
  const initial = built.rows[0];
  if (initial?.kind !== 'deposit') {
    throw new Error('Plan must start with an Initial Deposit');
  }
  // The chain was built from the end. This Deposit brings that Remainder plus its own Free tokens.
  return {
    rows: [
      {
        ...initial,
        amount: pinnedOutputAmount(initial.step) + initial.step.freeTokens,
      },
      ...built.rows.slice(1),
    ],
  };
}
