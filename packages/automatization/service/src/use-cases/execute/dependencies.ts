import type {
  AuthorizeDepositStore,
  Clock,
  CurrentRoot,
  FeeQuotes,
  FreshScalars,
  Inspection,
  PoolSubmission,
  Presence,
  Proofs,
  StepRunStore,
} from '../../ports/index.js';

export interface StepPorts {
  readonly serviceAccount: string;
  readonly clock: Clock;
  readonly currentRoot: CurrentRoot;
  readonly feeQuotes: FeeQuotes;
  readonly proofs: Proofs;
  readonly inspection: Inspection;
  readonly pool: PoolSubmission;
  readonly presence: Presence;
  readonly freshScalars: FreshScalars;
}

export interface StepDependencies extends StepPorts {
  readonly store: StepRunStore;
}

export interface AuthorizeDepositDependencies extends StepPorts {
  readonly store: AuthorizeDepositStore;
}
