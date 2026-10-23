import {
  isBlockedStep,
  isExecutedStep,
  type PinnedNote,
  type PinnedNotePresence,
  type Plan,
  type Row,
  type Step,
} from '@arcanetech/privacy-sdk-automatization-plan';

export interface StepProgress {
  readonly pinnedInputs: readonly PinnedNote[];
  readonly pinnedOutputs: readonly PinnedNote[];
  readonly freeTokens: bigint;
  readonly executed: boolean;
  readonly blocked: boolean;
}

export interface DepositProgress {
  readonly kind: 'deposit';
  readonly amount: bigint;
  readonly step: StepProgress;
}

export interface PayoutProgress {
  readonly kind: 'payout';
  readonly account: string;
  readonly amount: bigint;
  readonly transfer: StepProgress;
  readonly withdrawal: StepProgress;
}

export type RowProgress = DepositProgress | PayoutProgress;

export interface PlanProgress {
  readonly rows: readonly RowProgress[];
}

function stepProgress(step: Step, report: PinnedNotePresence): StepProgress {
  return {
    pinnedInputs: step.pinnedInputs,
    pinnedOutputs: step.pinnedOutputs,
    freeTokens: step.freeTokens,
    executed: isExecutedStep(step, report),
    blocked: isBlockedStep(step, report),
  };
}

function rowProgress(row: Row, report: PinnedNotePresence): RowProgress {
  if (row.kind === 'deposit') {
    return {
      kind: 'deposit',
      amount: row.amount,
      step: stepProgress(row.step, report),
    };
  }
  return {
    kind: 'payout',
    account: row.account,
    amount: row.amount,
    transfer: stepProgress(row.transfer, report),
    withdrawal: stepProgress(row.withdrawal, report),
  };
}

export function planProgress(plan: Plan, presence: PinnedNotePresence): PlanProgress {
  return {
    rows: plan.rows.map((row) => rowProgress(row, presence)),
  };
}
