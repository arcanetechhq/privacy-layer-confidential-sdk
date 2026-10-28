import type { Plan } from '@arcanetech/privacy-sdk-automatization-plan';
import { getJson, postJson, restorePlanValue } from '../transport/index.js';

export interface PlanRecipient {
  readonly account: string;
  readonly amount: bigint;
}

export interface StepPlace {
  readonly rowIndex: number;
  readonly role: 'deposit' | 'transfer' | 'withdrawal';
}

export interface PreparedDepositInvocation {
  readonly root: string;
  readonly pinnedOutputCommitments: readonly string[];
  readonly authEntries?: readonly string[];
}

export interface PlanClient {
  compose(recipients: readonly PlanRecipient[]): Promise<Plan>;
  reviseFreeTokens(plan: Plan, place: StepPlace, freeTokens: bigint): Promise<Plan>;
  insertDeposit(plan: Plan, rowIndex: number): Promise<Plan>;
  moveDepositAmount(
    plan: Plan,
    move: { fromRowIndex: number; toRowIndex: number; amount: bigint },
  ): Promise<Plan>;
  replaceStepInterval(plan: Plan, place: StepPlace, interval: bigint): Promise<Plan>;
  coverFees(plan: Plan): Promise<Plan>;
  confirm(
    plan: Plan,
    sorobanAuthorization: string,
    depositor?: string,
  ): Promise<{ id: string }>;
  read(id: string): Promise<Plan>;
  initialDepositInvocation(
    plan: Plan,
    depositor?: string,
  ): Promise<PreparedDepositInvocation>;
  depositToSign(
    id: string,
    depositor?: string,
  ): Promise<PreparedDepositInvocation | undefined>;
  authorizeDeposit(
    id: string,
    sorobanAuthorization: string,
    depositor?: string,
  ): Promise<void>;
}

export function createPlanClient(options: { baseUrl: string }): PlanClient {
  return { ...draftMethods(options.baseUrl), ...savedMethods(options.baseUrl) };
}

function draftMethods(
  baseUrl: string,
): Pick<
  PlanClient,
  | 'compose'
  | 'reviseFreeTokens'
  | 'insertDeposit'
  | 'moveDepositAmount'
  | 'replaceStepInterval'
  | 'coverFees'
> {
  return {
    compose(recipients) {
      return readPlan(postJson(baseUrl, '/plans/drafts', { recipients }));
    },
    reviseFreeTokens(plan, place, freeTokens) {
      return readPlan(
        postJson(baseUrl, '/plans/drafts/free-tokens', { plan, place, freeTokens }),
      );
    },
    insertDeposit(plan, rowIndex) {
      return readPlan(postJson(baseUrl, '/plans/drafts/deposits', { plan, rowIndex }));
    },
    moveDepositAmount(plan, move) {
      return readPlan(
        postJson(baseUrl, '/plans/drafts/deposit-moves', {
          plan,
          fromRowIndex: move.fromRowIndex,
          toRowIndex: move.toRowIndex,
          amount: move.amount,
        }),
      );
    },
    replaceStepInterval(plan, place, interval) {
      return readPlan(
        postJson(baseUrl, '/plans/drafts/intervals', { plan, place, interval }),
      );
    },
    coverFees(plan) {
      return readPlan(postJson(baseUrl, '/plans/drafts/fee-coverage', { plan }));
    },
  };
}

function savedMethods(
  baseUrl: string,
): Pick<
  PlanClient,
  'confirm' | 'read' | 'initialDepositInvocation' | 'depositToSign' | 'authorizeDeposit'
> {
  return {
    async confirm(plan, sorobanAuthorization, depositor) {
      const body = await postJson(baseUrl, '/plans', {
        plan,
        sorobanAuthorization,
        ...depositorField(depositor),
      });
      return { id: requiredId(body) };
    },
    read(id) {
      return readPlan(getJson(baseUrl, `/plans/${encodeURIComponent(id)}`));
    },
    initialDepositInvocation(plan, depositor) {
      return readInvocation(
        postJson(baseUrl, '/plans/drafts/initial-signing', {
          plan,
          ...depositorField(depositor),
        }),
      );
    },
    async depositToSign(id, depositor) {
      const body = await getJson(
        baseUrl,
        `/plans/${encodeURIComponent(id)}/deposit-signing${depositorQuery(depositor)}`,
      );
      if (body === undefined) {
        return;
      }
      return readInvocation(Promise.resolve(body));
    },
    async authorizeDeposit(id, sorobanAuthorization, depositor) {
      await postJson(
        baseUrl,
        `/plans/${encodeURIComponent(id)}/deposit-authorizations`,
        {
          sorobanAuthorization,
          ...depositorField(depositor),
        },
      );
    },
  };
}

function depositorQuery(depositor: string | undefined): string {
  return depositor === undefined || depositor.length === 0
    ? ''
    : `?depositor=${encodeURIComponent(depositor)}`;
}

function depositorField(depositor: string | undefined): { depositor?: string } {
  return depositor === undefined || depositor.length === 0 ? {} : { depositor };
}

async function readPlan(pending: Promise<unknown>): Promise<Plan> {
  return restorePlanValue(await pending) as Plan;
}

async function readInvocation(
  pending: Promise<unknown>,
): Promise<PreparedDepositInvocation> {
  const body = restorePlanValue(await pending);
  if (body === null || typeof body !== 'object') {
    throw new Error('Missing deposit invocation');
  }
  const record = body as {
    root?: unknown;
    pinnedOutputCommitments?: unknown;
    authEntries?: unknown;
  };
  if (
    typeof record.root !== 'string' ||
    !Array.isArray(record.pinnedOutputCommitments)
  ) {
    throw new TypeError('Missing deposit invocation');
  }
  const authEntries = Array.isArray(record.authEntries)
    ? record.authEntries.filter((entry): entry is string => typeof entry === 'string')
    : [];
  return {
    root: record.root,
    pinnedOutputCommitments: record.pinnedOutputCommitments.map(String),
    ...(authEntries.length > 0 ? { authEntries } : {}),
  };
}

function requiredId(body: unknown): string {
  if (
    body === null ||
    typeof body !== 'object' ||
    !('id' in body) ||
    typeof body.id !== 'string'
  ) {
    throw new Error('Missing plan id');
  }
  return body.id;
}
