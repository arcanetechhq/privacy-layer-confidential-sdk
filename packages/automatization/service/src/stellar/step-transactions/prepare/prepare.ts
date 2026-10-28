import {
  resolveTransactionAuditParams,
  type DepositSlot,
  type WithdrawResult,
  type WithdrawSlot,
} from '@arcanetech/stellar-privacy-pool-zk-sdk';
import type { rpc } from '@stellar/stellar-sdk';
import type { ProofRequest } from '../../../ports/index.js';
import {
  inspectPassage,
  type StellarKytAccess,
  type StellarServiceNetwork,
} from '../../kyt/index.js';
import type { SorobanPoolReader } from '../../pool/index.js';
import type { FieldPair } from '../../shared/index.js';
import { assertBalance, assertPinnedSignals, withdrawAddress } from './checks.js';
import { simulateTransact, type PackedTransaction } from './simulate.js';
import {
  applicationIdHints,
  depositFrom,
  feeDeposit,
  pinnedInputWithdraws,
  pinnedOutputDeposits,
  type SlotContext,
} from './slots.js';

export interface NoteOwners {
  readonly service: FieldPair;
  readonly unspent?: { readonly publicKey: FieldPair; readonly scalar: string };
}

export interface PrepareContext extends SlotContext {
  readonly server: rpc.Server;
  readonly reader: SorobanPoolReader;
  readonly network: StellarServiceNetwork;
  readonly kyt: StellarKytAccess;
  readonly serviceAccount: string;
  readonly zkConfigNonce: bigint;
  readonly auditPublicKey: FieldPair;
  readonly ensureNoteOwners?: (owners: NoteOwners) => Promise<void>;
}

export type PreparedStep =
  | {
      readonly refused: false;
      readonly authEntries: readonly string[];
      readonly packed: PackedTransaction;
    }
  | { readonly refused: true; readonly reason: string };

export class PoolRootChangedError extends Error {
  constructor() {
    super('Pool root changed before the proof');
    this.name = 'PoolRootChangedError';
  }
}

interface StepSlots {
  readonly root: string;
  readonly withdraws: WithdrawSlot[];
  readonly deposits: DepositSlot[];
}

async function stepSlots(
  context: PrepareContext,
  request: ProofRequest,
): Promise<StepSlots> {
  const { pinnedInputs, pinnedOutputs } = request.step;
  const leaves = pinnedInputs.length === 0 ? [] : await context.reader.readLeaves();
  const root = await context.reader.readRoot();
  if (BigInt(root) !== BigInt(request.root)) {
    throw new PoolRootChangedError();
  }
  const withdraws = pinnedInputWithdraws(context, {
    inputs: pinnedInputs,
    outputCount: pinnedOutputs.length,
    leaves,
    root,
  });
  const deposits: DepositSlot[] = pinnedOutputDeposits(context, pinnedOutputs);
  if (request.feeNote.amount > 0n) {
    deposits.push(
      feeDeposit(context, request.feeNote.collector, request.feeNote.amount),
    );
  }
  const unspent = request.unspentNote;
  if (unspent !== undefined && unspent.amount > 0n) {
    const opened = context.notes.openUnspent(unspent.amount, unspent.scalar);
    deposits.push(depositFrom(context, opened, unspent.amount));
    await context.ensureNoteOwners?.({
      service: context.notes.servicePublicKey,
      unspent: { publicKey: opened.ownerPub, scalar: unspent.scalar },
    });
  } else {
    await context.ensureNoteOwners?.({ service: context.notes.servicePublicKey });
  }
  if (
    deposits.length > context.layout.nOuts ||
    withdraws.length > context.layout.nIns
  ) {
    throw new Error('The step does not fit the pool circuit');
  }
  return { root, withdraws, deposits };
}

function prove(
  context: PrepareContext,
  request: ProofRequest,
  slots: StepSlots,
): Promise<WithdrawResult> {
  const address = withdrawAddress(request.publicWithdrawal, request.recipient);
  const asset = context.notes.asset;
  return context.sdk.proveTransaction(
    {
      stateRoot: slots.root,
      withdrawAddressHi: address.hi,
      withdrawAddressLo: address.lo,
      privKeyScalar: context.notes.serviceScalar,
    },
    {
      publicDeposits: [request.publicDeposit.toString()],
      publicWithdrawals: [request.publicWithdrawal.toString()],
      publicDepositedAssets: [request.publicDeposit > 0n ? asset : ['0', '0']],
      publicWithdrawnAssets: [request.publicWithdrawal > 0n ? asset : ['0', '0']],
    },
    slots.withdraws,
    slots.deposits,
    resolveTransactionAuditParams(
      context.notes.applicationId,
      context.auditPublicKey,
      context.layout.nAuditSlots,
    ),
  );
}

function inspect(
  context: PrepareContext,
  input: {
    readonly from: string;
    readonly slots: StepSlots;
    readonly proved: WithdrawResult;
  },
) {
  return inspectPassage({
    server: context.server,
    kyt: context.kyt,
    poolContract: context.network.poolContract,
    zkConfigNonce: context.zkConfigNonce,
    owner: input.from,
    proofHex: input.proved.proof_hex,
    publicHex: input.proved.public_hex,
    ciphertextHex: input.proved.ciphertext_hex,
    outputNoteEphemeralScalars: input.proved.output_note_ephemeral_scalars,
    applicationIdHints: applicationIdHints(
      context,
      input.slots.withdraws.length,
      input.slots.deposits.length,
    ),
  });
}

export async function prepareStep(
  context: PrepareContext,
  request: ProofRequest,
  from: string,
): Promise<PreparedStep> {
  const slots = await stepSlots(context, request);
  assertBalance({
    publicDeposit: request.publicDeposit,
    publicWithdrawal: request.publicWithdrawal,
    feeAmount: request.feeNote.amount,
    unspentAmount: request.unspentNote?.amount ?? 0n,
    inputs: request.step.pinnedInputs,
    outputs: request.step.pinnedOutputs,
  });
  const proved = await prove(context, request, slots);
  assertPinnedSignals(
    proved.public_hex,
    context.layout.nIns,
    request.step.pinnedOutputs,
  );
  const approval = await inspect(context, { from, slots, proved });
  if (!approval.approved) {
    return { refused: true, reason: approval.reason };
  }
  const simulated = await simulateTransact(context, {
    from,
    proofHex: proved.proof_hex,
    publicHex: proved.public_hex,
    ciphertextHex: proved.ciphertext_hex,
    kytExpirationLedger: approval.expiresAtLedger,
    kytSignature: approval.signature,
  });
  return {
    refused: false,
    authEntries: simulated.authEntries,
    packed: simulated.packed,
  };
}
