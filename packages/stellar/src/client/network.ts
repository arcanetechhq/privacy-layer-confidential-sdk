import type {
  StellarAddress,
  StellarRegistryLookup,
  StellarTransactionStatus,
} from '../types.js';
import { requireContractContext } from '../contracts/contract-context.js';
import { readNullifierConsumedOnChain } from '../contracts/pool/pool-domain-service.js';
import {
  readRegistryLookupFromChain,
  registerPrivateAddressOnChain,
} from '../contracts/registry/registry-domain-service.js';
import { resolveTransferRecipientFromChain } from '../contracts/registry/resolve-transfer-recipient.js';
import {
  fetchStellarTransactionDetails,
  readStellarTransactionStatus,
  waitForStellarTransactionConfirmation,
  type StellarTransactionDetails,
} from '../rpc/index.js';
import { getPrivacyPoolService } from '../transact/pool/singleton.js';
import { privKeyScalarDecimalFromRecipientScalarHex } from '../transact/encoding/priv-key-scalar-from-recipient-hex.js';
import type {
  StellarTransactEnvironment,
  TransferRecipientExecutionContext,
} from '../transact/environment/types.js';

function requireNetworkEnvironment(
  transactEnvironment: StellarTransactEnvironment | undefined,
): StellarTransactEnvironment {
  if (!transactEnvironment) {
    throw new Error(
      'Stellar privacy client network operations require transact environment.',
    );
  }
  return transactEnvironment;
}

export { requireNetworkEnvironment };

export async function checkRegistrationStatusWithEnvironment(input: {
  transactEnvironment: StellarTransactEnvironment | undefined;
  address: StellarAddress;
  walletPublicKey: string;
  saveLookup: (lookup: StellarRegistryLookup) => Promise<void>;
}): Promise<StellarRegistryLookup> {
  const environment = requireNetworkEnvironment(input.transactEnvironment);
  const contractContext = requireContractContext(environment);
  const lookup = await readRegistryLookupFromChain({
    contractContext,
    owner: input.address,
    walletPublicKey: input.walletPublicKey,
  });
  await input.saveLookup(lookup);
  return lookup;
}

export async function registerPrivateAddressWithEnvironment(input: {
  transactEnvironment: StellarTransactEnvironment | undefined;
  owner: StellarAddress;
  walletPublicKey: string;
  privateAddressStpl1: string;
}): Promise<StellarTransactionStatus> {
  const environment = requireNetworkEnvironment(input.transactEnvironment);
  const contractContext = requireContractContext(environment);
  const txHash = await registerPrivateAddressOnChain({
    contractContext,
    owner: input.owner,
    walletPublicKey: input.walletPublicKey,
    privateAddressStpl1: input.privateAddressStpl1,
  });
  return {
    txHash,
    status: 'pending',
  };
}

export async function resolveTransferRecipientWithEnvironment(input: {
  transactEnvironment: StellarTransactEnvironment | undefined;
  recipientStellarAddress: StellarAddress;
  walletPublicKey: StellarAddress;
  readCachedLookup: (
    address: StellarAddress,
  ) => Promise<StellarRegistryLookup | undefined>;
  saveLookup: (lookup: StellarRegistryLookup) => Promise<void>;
}): Promise<TransferRecipientExecutionContext> {
  const environment = requireNetworkEnvironment(input.transactEnvironment);
  const contractContext = requireContractContext(environment);
  const recipientStellarAddress = input.recipientStellarAddress.trim();
  const cachedLookup = await input.readCachedLookup(recipientStellarAddress);
  if (
    cachedLookup?.status === 'registered' &&
    cachedLookup.privateAddressStpl1?.trim()
  ) {
    return {
      recipientPrivateAddressStpl1: cachedLookup.privateAddressStpl1.trim(),
      recipientStellarAddress,
    };
  }
  const lookup = await readRegistryLookupFromChain({
    contractContext,
    owner: recipientStellarAddress,
    walletPublicKey: input.walletPublicKey,
  });
  await input.saveLookup(lookup);
  return resolveTransferRecipientFromChain({
    contractContext,
    recipientStellarAddress,
    walletPublicKey: input.walletPublicKey,
    cachedLookup: lookup,
  });
}

export async function checkPrivateRecordSpendStatusWithEnvironment(input: {
  transactEnvironment: StellarTransactEnvironment | undefined;
  poolContractId?: string;
  nullifier: string;
  walletPublicKey: string;
  privKeyScalarHex: string;
}): Promise<{ spent: boolean; nullifierHashHex: string }> {
  const environment = requireNetworkEnvironment(input.transactEnvironment);
  const contractContext = requireContractContext(environment);
  const nullifierHashHex = await getPrivacyPoolService().calculateNullifierHash(
    input.nullifier,
    privKeyScalarDecimalFromRecipientScalarHex(input.privKeyScalarHex),
  );
  const poolContractId =
    input.poolContractId?.trim() || contractContext.network.poolContract;
  const spent = await readNullifierConsumedOnChain({
    contractContext,
    poolContractId,
    walletPublicKey: input.walletPublicKey,
    nullifierHashHex,
  });
  return { spent, nullifierHashHex };
}

export async function waitForTransactionConfirmationWithEnvironment(input: {
  transactEnvironment: StellarTransactEnvironment | undefined;
  txHash: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
}): Promise<StellarTransactionStatus> {
  const environment = requireNetworkEnvironment(input.transactEnvironment);
  const contractContext = requireContractContext(environment);
  return waitForStellarTransactionConfirmation({
    server: contractContext.rpcServer,
    txHash: input.txHash,
    ...(input.pollIntervalMs === undefined
      ? {}
      : { pollIntervalMs: input.pollIntervalMs }),
    ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs }),
  });
}

export async function fetchTransactionConfirmationStatusWithEnvironment(input: {
  transactEnvironment: StellarTransactEnvironment | undefined;
  txHash: string;
}): Promise<StellarTransactionStatus | undefined> {
  const environment = requireNetworkEnvironment(input.transactEnvironment);
  const contractContext = requireContractContext(environment);
  const status = await readStellarTransactionStatus(
    contractContext.rpcServer,
    input.txHash,
  );
  if ('kind' in status) {
    if (status.kind === 'not_found') {
      return {
        txHash: input.txHash.trim(),
        status: 'pending',
      };
    }
    throw new Error(status.message);
  }
  return status;
}

export async function getTransactionDetailsWithEnvironment(input: {
  transactEnvironment: StellarTransactEnvironment | undefined;
  txHash: string;
}): Promise<StellarTransactionDetails> {
  const environment = requireNetworkEnvironment(input.transactEnvironment);
  const contractContext = requireContractContext(environment);
  const details = await fetchStellarTransactionDetails(
    contractContext.rpcServer,
    input.txHash,
  );
  if ('kind' in details) {
    throw new Error(details.message);
  }
  return details;
}

export { type StellarTransactionDetails } from '../rpc/index.js';
