import type { DepositIntent } from '@arcanetech/privacy-sdk-core';
import type { StateFile } from '@arcanetech/stellar-privacy-pool-zk-sdk';
import type {
  StellarAddress,
  StellarAssetId,
  StellarPreparedOperation,
} from '../../../types.js';
import type { StellarTransactEnvironment } from '../../environment/types.js';
import { fetchAndMergeMerkleState } from '../../merkle/fetch-contract.js';
import { merkleSnapshotToStateFile } from '../../merkle/state-file.js';

export async function resolveTokenContractId(
  environment: StellarTransactEnvironment,
  assetId: string,
): Promise<string> {
  if (environment.resolveTokenContractId) {
    return environment.resolveTokenContractId(assetId);
  }
  throw new Error(`Token contract is not configured for asset ${assetId}.`);
}

export async function resolveWalletPublicKey(
  environment: StellarTransactEnvironment,
  prepared: StellarPreparedOperation,
): Promise<string> {
  if (environment.resolveWalletPublicKey) {
    return environment.resolveWalletPublicKey();
  }
  if (prepared.kind === 'deposit') {
    const depositIntent = prepared.intent as DepositIntent<
      StellarAddress,
      StellarAssetId,
      bigint
    >;
    return depositIntent.from;
  }
  throw new Error('Wallet public key resolver is not configured.');
}

async function resolveSenderPrivKeyScalarHex(
  environment: StellarTransactEnvironment,
  privateAddressStpl1: string,
  owner?: string,
): Promise<string> {
  const cached = await readSenderPrivKeyScalarHex(
    environment,
    privateAddressStpl1,
    owner,
  );
  if (cached) {
    return cached;
  }
  if (environment.ensureSenderPrivKeyScalarHex) {
    return environment.ensureSenderPrivKeyScalarHex(privateAddressStpl1);
  }
  if (!environment.resolveSenderPrivKeyScalarHex) {
    throw new Error('Sender private key scalar resolver is not configured.');
  }
  return environment.resolveSenderPrivKeyScalarHex(privateAddressStpl1);
}

async function readSenderPrivKeyScalarHex(
  environment: StellarTransactEnvironment,
  privateAddressStpl1: string,
  owner?: string,
): Promise<string | undefined> {
  if (owner && environment.resolveSenderPrivKeyScalarFromState) {
    const fromState = await environment.resolveSenderPrivKeyScalarFromState({
      owner,
      privateAddressStpl1,
    });
    if (fromState?.trim()) {
      return fromState.trim();
    }
  }
  if (environment.readSenderPrivKeyScalarHex) {
    const cached = await environment.readSenderPrivKeyScalarHex(privateAddressStpl1);
    if (cached?.trim()) {
      return cached.trim();
    }
  }
  return undefined;
}

export async function ensureSenderPrivKeyScalarHex(
  environment: StellarTransactEnvironment,
  privateAddressStpl1: string,
  owner?: string,
): Promise<string> {
  const cached = await readSenderPrivKeyScalarHex(
    environment,
    privateAddressStpl1,
    owner,
  );
  if (cached) {
    return cached;
  }
  if (environment.ensureSenderPrivKeyScalarHex) {
    return environment.ensureSenderPrivKeyScalarHex(privateAddressStpl1);
  }
  return resolveSenderPrivKeyScalarHex(environment, privateAddressStpl1, owner);
}

export async function loadMerkleState(
  environment: StellarTransactEnvironment,
  walletPublicKey: string,
): Promise<StateFile & { commitments: string[] }> {
  const merged = await fetchAndMergeMerkleState({
    poolContractId: environment.network.poolContract,
    walletPublicKey,
    transactEnvironment: environment,
    ...(environment.poolMerkleState
      ? { poolMerkleState: environment.poolMerkleState }
      : {}),
  });
  return merkleSnapshotToStateFile({
    commitments: merged.commitments,
    merkleRootHex: merged.merkleRootHex,
    ...(merged.nodes ? { nodes: merged.nodes } : {}),
  });
}

export function enrichPreparedOperation(
  prepared: StellarPreparedOperation,
  outputRecords: StellarPreparedOperation['outputRecords'],
  artifacts: NonNullable<StellarPreparedOperation['transactArtifacts']>,
): StellarPreparedOperation {
  return {
    ...prepared,
    outputRecords,
    transactArtifacts: artifacts,
    submissionPayload: {
      operationId: crypto.randomUUID(),
      signed: false,
    },
  };
}
