import type {
  Clock,
  ConfirmStore,
  CurrentRoot,
  FeeQuotes,
  FreshScalars,
  Inspection,
  NoteOwnership,
  PoolSubmission,
  Proofs,
} from '../../ports/index.js';

export interface ConfirmDependencies {
  readonly serviceAccount: string;
  readonly serviceScalar: string;
  readonly currentRoot: CurrentRoot;
  readonly feeQuotes: FeeQuotes;
  readonly proofs: Proofs;
  readonly pool: PoolSubmission;
  readonly noteOwnership: NoteOwnership;
  readonly clock: Clock;
  readonly freshScalars: FreshScalars;
  readonly inspection: Inspection;
  readonly store: ConfirmStore;
}
