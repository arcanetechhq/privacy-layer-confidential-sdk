import type {
  StellarAsset,
  StellarPoolMerkleState,
  StellarPrivateRecord,
  StellarWalletPrivateAddressRecord,
  StellarWalletPrivateAddressScalar,
} from '../types.js';
import type { StellarPrivacyClientStateDelegates } from './state-delegates/index.js';

export type StellarPrivacyStateHydration = {
  poolMerkleStates?: StellarPoolMerkleState[];
  privateRecords?: StellarPrivateRecord[];
  walletPrivateAddressRecords?: StellarWalletPrivateAddressRecord[];
  walletPrivateAddressScalars?: StellarWalletPrivateAddressScalar[];
  walletDefaultPrivateAddressNonces?: Array<{ owner: string; nonce: string }>;
  assets?: StellarAsset[];
};

async function hydratePoolMerkleStates(
  client: Pick<StellarPrivacyClientStateDelegates, 'setPoolMerkleState'>,
  states: StellarPoolMerkleState[] | undefined,
): Promise<void> {
  for (const poolState of states ?? []) {
    await client.setPoolMerkleState(poolState);
  }
}

async function hydrateWalletAddresses(
  client: Pick<
    StellarPrivacyClientStateDelegates,
    | 'saveWalletPrivateAddressRecord'
    | 'saveWalletPrivateAddressScalar'
    | 'setWalletDefaultPrivateAddressNonce'
  >,
  snapshot: StellarPrivacyStateHydration,
): Promise<void> {
  for (const record of snapshot.walletPrivateAddressRecords ?? []) {
    await client.saveWalletPrivateAddressRecord(record);
  }
  for (const scalar of snapshot.walletPrivateAddressScalars ?? []) {
    await client.saveWalletPrivateAddressScalar(scalar);
  }
  for (const entry of snapshot.walletDefaultPrivateAddressNonces ?? []) {
    await client.setWalletDefaultPrivateAddressNonce(entry);
  }
}

export async function hydrateStellarPrivacyState(
  client: Pick<
    StellarPrivacyClientStateDelegates,
    | 'setPoolMerkleState'
    | 'upsertPrivateRecords'
    | 'saveWalletPrivateAddressRecord'
    | 'saveWalletPrivateAddressScalar'
    | 'setWalletDefaultPrivateAddressNonce'
    | 'replaceAssets'
  >,
  snapshot: StellarPrivacyStateHydration,
): Promise<void> {
  if (snapshot.assets && snapshot.assets.length > 0) {
    await client.replaceAssets(snapshot.assets);
  }
  await hydratePoolMerkleStates(client, snapshot.poolMerkleStates);
  if (snapshot.privateRecords && snapshot.privateRecords.length > 0) {
    await client.upsertPrivateRecords(snapshot.privateRecords);
  }
  await hydrateWalletAddresses(client, snapshot);
}
