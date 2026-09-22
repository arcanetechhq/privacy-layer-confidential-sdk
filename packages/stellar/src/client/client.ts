import type {
  ResolvedStellarPrivacyClientConfig,
  StellarTransferIntent,
} from '../types.js';
import {
  composeStellarPrivacyClient,
  type ComposedStellarPrivacyClient,
} from './compose.js';
import {
  createStateDelegates,
  type StellarPrivacyClientStateDelegates,
} from './state-delegates/index.js';
import {
  hydrateStellarPrivacyState,
  type StellarPrivacyStateHydration,
} from './hydrate-state.js';

type StellarPrivacyClientNetwork = ComposedStellarPrivacyClient['network'];
type StellarPrivacyClientOperations = ComposedStellarPrivacyClient['operations'];

export type StellarPrivacyClient = {
  readonly state: ComposedStellarPrivacyClient['state'];
  deposit: StellarPrivacyClientOperations['deposit'];
  transfer: (
    intent: StellarTransferIntent,
  ) => ReturnType<StellarPrivacyClientOperations['transfer']>;
  withdraw: StellarPrivacyClientOperations['withdraw'];
  syncPoolMerkleState: StellarPrivacyClientNetwork['syncPoolMerkleState'];
  syncPoolMerkleStates: StellarPrivacyClientNetwork['syncPoolMerkleStates'];
  readPoolLeafEphemeralHex: StellarPrivacyClientNetwork['readPoolLeafEphemeralHex'];
  checkRegistrationStatus: StellarPrivacyClientNetwork['checkRegistrationStatus'];
  registerPrivateAddress: StellarPrivacyClientNetwork['registerPrivateAddress'];
  resolveTransferRecipient: StellarPrivacyClientNetwork['resolveTransferRecipient'];
  checkPrivateRecordSpendStatus: StellarPrivacyClientNetwork['checkPrivateRecordSpendStatus'];
  waitForTransactionConfirmation: StellarPrivacyClientNetwork['waitForTransactionConfirmation'];
  fetchTransactionConfirmationStatus: StellarPrivacyClientNetwork['fetchTransactionConfirmationStatus'];
  getTransactionDetails: StellarPrivacyClientNetwork['getTransactionDetails'];
} & StellarPrivacyClientStateDelegates & {
    hydrateState: (snapshot: StellarPrivacyStateHydration) => Promise<void>;
  };

export function createStellarPrivacyClientInstance(
  config: ResolvedStellarPrivacyClientConfig,
): StellarPrivacyClient {
  const composed = composeStellarPrivacyClient(config);
  const stateDelegates = createStateDelegates(composed.state);

  return {
    state: composed.state,
    ...stateDelegates,
    hydrateState: (snapshot) => hydrateStellarPrivacyState(stateDelegates, snapshot),
    deposit: (intent) => composed.operations.deposit(intent),
    transfer: (intent) => composed.operations.transfer(intent),
    withdraw: (intent) => composed.operations.withdraw(intent),
    syncPoolMerkleState: (input) => composed.network.syncPoolMerkleState(input),
    syncPoolMerkleStates: (input) => composed.network.syncPoolMerkleStates(input),
    readPoolLeafEphemeralHex: (input) =>
      composed.network.readPoolLeafEphemeralHex(input),
    checkRegistrationStatus: (input) => composed.network.checkRegistrationStatus(input),
    registerPrivateAddress: (input) => composed.network.registerPrivateAddress(input),
    resolveTransferRecipient: (input) =>
      composed.network.resolveTransferRecipient(input),
    checkPrivateRecordSpendStatus: (input) =>
      composed.network.checkPrivateRecordSpendStatus(input),
    waitForTransactionConfirmation: (input) =>
      composed.network.waitForTransactionConfirmation(input),
    fetchTransactionConfirmationStatus: (txHash) =>
      composed.network.fetchTransactionConfirmationStatus(txHash),
    getTransactionDetails: (txHash) => composed.network.getTransactionDetails(txHash),
  };
}
