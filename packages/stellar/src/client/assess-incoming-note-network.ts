import { commitmentHexFromNoteOpening } from '@arcanetech/stellar-privacy-pool-zk-sdk';
import { requireContractContext } from '../contracts/contract-context.js';
import { readNullifierConsumedOnChain } from '../contracts/pool/pool-domain-service.js';
import type { StellarStateService } from '../state/index.js';
import { getPrivacyPoolService } from '../transact/pool/singleton.js';
import type { StellarTransactEnvironment } from '../transact/environment/types.js';
import { syncPoolMerkleStateWithEnvironment } from './pool-sync.js';
import { requireNetworkEnvironment } from './network.js';
import {
  assessIncomingNote,
  type AssessIncomingNoteInput,
  type AssessIncomingNotePorts,
  type IncomingNoteAssessment,
  type IncomingNoteFields,
} from './assess-incoming-note.js';

export type AssessIncomingNoteClientInput = AssessIncomingNoteInput & {
  walletPublicKey: string;
  poolContractId?: string;
};

function noteApplicationId(
  note: IncomingNoteFields,
  environment: StellarTransactEnvironment,
): string {
  const fromNote = note.application_id?.trim();
  if (fromNote) {
    return fromNote;
  }
  return environment.network.applicationId;
}

async function recomputeCommitmentHexFromNote(input: {
  note: IncomingNoteFields;
  privKeyScalarHex: string;
  applicationId: string;
}): Promise<string> {
  return commitmentHexFromNoteOpening({
    value: input.note.value,
    secret: input.note.secret,
    nullifier: input.note.nullifier,
    assetHi: input.note.asset_hi,
    assetLo: input.note.asset_lo,
    applicationId: input.applicationId,
    recipientScalarHex: input.privKeyScalarHex,
  });
}

async function hasCommitmentLeafInPoolState(input: {
  environment: StellarTransactEnvironment;
  state: StellarStateService;
  poolContractId: string;
  walletPublicKey: string;
  commitmentDecimal: string;
}): Promise<boolean> {
  const cached = await input.state.getPoolMerkleState(input.poolContractId);
  if ((cached?.commitments ?? []).includes(input.commitmentDecimal)) {
    return true;
  }
  await syncPoolMerkleStateWithEnvironment(input.environment, {
    poolContractId: input.poolContractId,
    walletPublicKey: input.walletPublicKey,
  });
  const synced = await input.state.getPoolMerkleState(input.poolContractId);
  return (synced?.commitments ?? []).includes(input.commitmentDecimal);
}

function createAssessIncomingNotePorts(input: {
  environment: StellarTransactEnvironment;
  state: StellarStateService;
  poolContractId: string;
  walletPublicKey: string;
}): AssessIncomingNotePorts {
  const { environment, state, poolContractId, walletPublicKey } = input;
  return {
    recomputeCommitmentHex: ({ note, privKeyScalarHex }) =>
      recomputeCommitmentHexFromNote({
        note,
        privKeyScalarHex,
        applicationId: noteApplicationId(note, environment),
      }),
    hasCommitmentLeaf: (commitmentDecimal) =>
      hasCommitmentLeafInPoolState({
        environment,
        state,
        poolContractId,
        walletPublicKey,
        commitmentDecimal,
      }),
    calculateNullifierHash: (nullifier, privKeyScalarDecimal) =>
      getPrivacyPoolService().calculateNullifierHash(nullifier, privKeyScalarDecimal),
    isNullifierConsumed: async (nullifierHashHex) => {
      const contractContext = requireContractContext(environment);
      return readNullifierConsumedOnChain({
        contractContext,
        poolContractId,
        walletPublicKey,
        nullifierHashHex,
      });
    },
  };
}

export async function assessIncomingNoteWithEnvironment(
  input: {
    transactEnvironment: StellarTransactEnvironment | undefined;
    state: StellarStateService;
  } & AssessIncomingNoteClientInput,
): Promise<IncomingNoteAssessment> {
  const environment = requireNetworkEnvironment(input.transactEnvironment);
  const poolContractId =
    input.poolContractId?.trim() || environment.network.poolContract;
  return assessIncomingNote({
    note: input.note,
    commitmentHex: input.commitmentHex,
    privKeyScalarHex: input.privKeyScalarHex,
    ports: createAssessIncomingNotePorts({
      environment,
      state: input.state,
      poolContractId,
      walletPublicKey: input.walletPublicKey,
    }),
  });
}
