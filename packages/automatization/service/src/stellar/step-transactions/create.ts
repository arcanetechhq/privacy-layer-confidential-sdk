import { PrivacyPoolSDK } from '@arcanetech/stellar-privacy-pool-zk-sdk';
import { Keypair } from '@stellar/stellar-sdk';
import type {
  DepositSigning,
  FreshScalars,
  Inspection,
  PoolSubmission,
  ProofRequest,
  Proofs,
  TransactInvocation,
} from '../../ports/index.js';
import type { StellarKytAccess, StellarServiceNetwork } from '../kyt/index.js';
import type { StellarNoteDeriver } from '../notes/index.js';
import type { SorobanPoolReader } from '../pool/index.js';
import { randomBabyJubScalar, sorobanServer } from '../shared/index.js';
import { signedEntries } from './auth/index.js';
import {
  PoolRootChangedError,
  auditPoint,
  createPreparedCache,
  invocationKey,
  invocationOf,
  prepareStep,
  proofKey,
  type CachedStep,
  type NoteOwners,
  type PrepareContext,
} from './prepare/index.js';
import { submitPacked } from './submit/index.js';

export interface StellarStepTransactionsConfig {
  readonly network: StellarServiceNetwork;
  readonly kyt: StellarKytAccess;
  readonly serviceSecret: string;
  readonly notes: StellarNoteDeriver;
  readonly reader: SorobanPoolReader;
  readonly auditPublicKey: string;
  readonly zkConfigNonce: bigint;
  readonly zkArtifactBaseUrl?: string;
  readonly ensureNoteOwners?: (owners: NoteOwners) => Promise<void>;
}

export interface StellarStepTransactions {
  readonly serviceAccount: string;
  readonly proofs: Proofs;
  readonly inspection: Inspection;
  readonly pool: PoolSubmission;
  readonly freshScalars: FreshScalars;
  readonly depositSigning: DepositSigning;
  setDepositor(account: string): void;
  clear(): void;
}

interface Session {
  readonly config: StellarStepTransactionsConfig;
  readonly signer: Keypair;
  readonly cache: ReturnType<typeof createPreparedCache>;
  readonly context: () => Promise<PrepareContext>;
  depositor: string;
  sticky: string | undefined;
}

function lazyContext(config: StellarStepTransactionsConfig, serviceAccount: string) {
  let pending: Promise<PrepareContext> | undefined;
  const server = sorobanServer(config.network.rpcUrl);
  const build = async (): Promise<PrepareContext> => {
    const sdk = await PrivacyPoolSDK.init({
      zkConfigNonce: config.zkConfigNonce,
      ...(config.zkArtifactBaseUrl === undefined
        ? {}
        : { zkArtifactBaseUrl: config.zkArtifactBaseUrl }),
    });
    return {
      sdk,
      layout: sdk.getLayout(),
      notes: config.notes,
      server,
      reader: config.reader,
      network: config.network,
      kyt: config.kyt,
      serviceAccount,
      zkConfigNonce: config.zkConfigNonce,
      auditPublicKey: auditPoint(config.auditPublicKey),
      ...(config.ensureNoteOwners === undefined
        ? {}
        : { ensureNoteOwners: config.ensureNoteOwners }),
    };
  };
  return () => (pending ??= build());
}

async function prove(
  session: Session,
  request: ProofRequest,
): Promise<TransactInvocation> {
  const invocation = invocationOf(request);
  const from =
    request.publicDeposit > 0n ? session.depositor : session.signer.publicKey();
  const key = proofKey(request, from);
  if (session.cache.byProofKey(key) !== undefined) {
    return invocation;
  }
  const entry = { key, invocationKey: invocationKey(invocation) };
  try {
    if (from.length === 0) {
      throw new Error('A Deposit needs the depositor account');
    }
    const prepared = await prepareStep(await session.context(), request, from);
    session.cache.remember({ ...entry, prepared });
  } catch (error) {
    if (error instanceof PoolRootChangedError) {
      session.config.reader.forget();
      throw error;
    }
    const reason = error instanceof Error ? error.message : 'Proof failed';
    session.cache.remember({ ...entry, prepared: { refused: true, reason } });
  }
  return invocation;
}

function acceptedEntry(session: Session, invocation: TransactInvocation) {
  const entry = session.cache.byInvocation(invocation);
  return entry === undefined || entry.prepared.refused
    ? undefined
    : { entry, prepared: entry.prepared };
}

async function authEntries(
  session: Session,
  invocation: TransactInvocation,
): Promise<readonly string[]> {
  const entry: CachedStep | undefined = session.cache.byInvocation(invocation);
  if (entry === undefined) {
    throw new Error('This Deposit has not been prepared');
  }
  if (entry.prepared.refused) {
    throw new Error(entry.prepared.reason);
  }
  if (entry.prepared.authEntries.length === 0) {
    throw new Error('This Deposit has no Soroban authorization to sign');
  }
  return entry.prepared.authEntries;
}

function pool(session: Session): PoolSubmission {
  return {
    async submit(transaction, authorization) {
      const accepted = acceptedEntry(session, transaction.invocation);
      if (accepted === undefined) {
        return { ok: false };
      }
      const signed = signedEntries(
        authorization?.sorobanAuthorization,
        accepted.prepared.authEntries.length,
      );
      if (signed === undefined) {
        return { ok: false };
      }
      const outcome = await submitPacked(
        {
          server: sorobanServer(session.config.network.rpcUrl),
          networkPassphrase: session.config.network.networkPassphrase,
          signer: session.signer,
        },
        accepted.prepared.packed,
        signed,
      );
      if (outcome.ok || outcome.drop) {
        session.cache.drop(accepted.entry);
        session.sticky = undefined;
      }
      if (!outcome.ok) {
        return { ok: false };
      }
      session.config.reader.forget();
      return { ok: true, transactionId: outcome.transactionId };
    },
  };
}

export function createStellarStepTransactions(
  config: StellarStepTransactionsConfig,
): StellarStepTransactions {
  const signer = Keypair.fromSecret(config.serviceSecret);
  const session: Session = {
    config,
    signer,
    cache: createPreparedCache(),
    context: lazyContext(config, signer.publicKey()),
    depositor: '',
    sticky: undefined,
  };
  return {
    serviceAccount: signer.publicKey(),
    proofs: { prove: (request) => prove(session, request) },
    inspection: {
      inspect: (invocation) =>
        Promise.resolve(
          acceptedEntry(session, invocation) === undefined ? 'refuse' : 'accept',
        ),
    },
    pool: pool(session),
    freshScalars: {
      next() {
        session.sticky ??= randomBabyJubScalar();
        return Promise.resolve(session.sticky);
      },
    },
    depositSigning: { authEntries: (invocation) => authEntries(session, invocation) },
    setDepositor(account) {
      session.depositor = account.trim();
    },
    clear() {
      session.cache.clear();
      session.sticky = undefined;
      session.depositor = '';
    },
  };
}
