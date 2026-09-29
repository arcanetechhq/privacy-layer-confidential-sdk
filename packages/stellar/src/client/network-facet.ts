import type { StellarAddress } from '../types.js';
import type { StellarStateService } from '../state/index.js';
import type { StellarTransactEnvironment } from '../transact/environment/types.js';
import { assessIncomingNoteWithEnvironment } from './assess-incoming-note-network.js';
import type { AssessIncomingNoteClientInput } from './assess-incoming-note-network.js';
import {
  checkPrivateRecordSpendStatusWithEnvironment,
  checkRegistrationStatusWithEnvironment,
  fetchTransactionConfirmationStatusWithEnvironment,
  getTransactionDetailsWithEnvironment,
  registerPrivateAddressWithEnvironment,
  resolveTransferRecipientWithEnvironment,
  waitForTransactionConfirmationWithEnvironment,
} from './network.js';
import {
  readPoolLeafEphemeralHexWithEnvironment,
  syncPoolMerkleStateWithEnvironment,
  syncPoolMerkleStatesWithEnvironment,
} from './pool-sync.js';

function createPoolNetworkFacet(input: {
  transactEnvironment: StellarTransactEnvironment | undefined;
}) {
  const { transactEnvironment } = input;

  return {
    syncPoolMerkleState: (poolInput: {
      poolContractId: string;
      walletPublicKey: string;
    }) => syncPoolMerkleStateWithEnvironment(transactEnvironment, poolInput),

    syncPoolMerkleStates: (poolInput: {
      poolContractIds: string[];
      walletPublicKey: string;
    }) => syncPoolMerkleStatesWithEnvironment(transactEnvironment, poolInput),

    readPoolLeafEphemeralHex: (poolInput: {
      poolContractId: string;
      walletPublicKey: string;
      leafIndex: number;
    }) => readPoolLeafEphemeralHexWithEnvironment(transactEnvironment, poolInput),
  };
}

function createRegistryNetworkFacet(input: {
  transactEnvironment: StellarTransactEnvironment | undefined;
  state: StellarStateService;
}) {
  const { transactEnvironment, state } = input;

  return {
    checkRegistrationStatus: (registrationInput: {
      address: StellarAddress;
      walletPublicKey: string;
    }) =>
      checkRegistrationStatusWithEnvironment({
        transactEnvironment,
        address: registrationInput.address,
        walletPublicKey: registrationInput.walletPublicKey,
        saveLookup: (lookup) => state.saveRegistryLookup(lookup),
      }),

    registerPrivateAddress: (registrationInput: {
      owner: StellarAddress;
      walletPublicKey: string;
      privateAddressStpl1: string;
    }) =>
      registerPrivateAddressWithEnvironment({
        transactEnvironment,
        owner: registrationInput.owner,
        walletPublicKey: registrationInput.walletPublicKey,
        privateAddressStpl1: registrationInput.privateAddressStpl1,
      }),

    resolveTransferRecipient: (recipientInput: {
      recipientStellarAddress: StellarAddress;
      walletPublicKey: StellarAddress;
    }) =>
      resolveTransferRecipientWithEnvironment({
        transactEnvironment,
        recipientStellarAddress: recipientInput.recipientStellarAddress,
        walletPublicKey: recipientInput.walletPublicKey,
        readCachedLookup: (address) => state.getRegistryLookup(address),
        saveLookup: (lookup) => state.saveRegistryLookup(lookup),
      }),
  };
}

function createAssessmentNetworkFacet(input: {
  transactEnvironment: StellarTransactEnvironment | undefined;
  state: StellarStateService;
}) {
  const { transactEnvironment, state } = input;
  return {
    assessIncomingNote: (assessmentInput: AssessIncomingNoteClientInput) =>
      assessIncomingNoteWithEnvironment({
        transactEnvironment,
        state,
        ...assessmentInput,
      }),
  };
}

function createRpcNetworkFacet(input: {
  transactEnvironment: StellarTransactEnvironment | undefined;
}) {
  const { transactEnvironment } = input;

  return {
    checkPrivateRecordSpendStatus: (spendInput: {
      poolContractId?: string;
      nullifier: string;
      walletPublicKey: string;
      privKeyScalarHex: string;
    }) =>
      checkPrivateRecordSpendStatusWithEnvironment({
        transactEnvironment,
        ...spendInput,
      }),

    waitForTransactionConfirmation: (confirmationInput: {
      txHash: string;
      pollIntervalMs?: number;
      timeoutMs?: number;
    }) =>
      waitForTransactionConfirmationWithEnvironment({
        transactEnvironment,
        ...confirmationInput,
      }),

    fetchTransactionConfirmationStatus: async (txHash: string) => {
      const status = await fetchTransactionConfirmationStatusWithEnvironment({
        transactEnvironment,
        txHash,
      });
      if (!status) {
        throw new Error('Transaction status is unavailable.');
      }
      return status;
    },

    getTransactionDetails: (txHash: string) =>
      getTransactionDetailsWithEnvironment({
        transactEnvironment,
        txHash,
      }),
  };
}

export function createNetworkFacet(input: {
  transactEnvironment: StellarTransactEnvironment | undefined;
  state: StellarStateService;
}) {
  return {
    ...createPoolNetworkFacet(input),
    ...createRegistryNetworkFacet(input),
    ...createAssessmentNetworkFacet(input),
    ...createRpcNetworkFacet(input),
  };
}
