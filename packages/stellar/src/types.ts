import type { OperationKind } from '@arcanetech/privacy-sdk-core';
import type { StateBridgeAdapter } from '@arcanetech/privacy-sdk-core/state';
import type {
  DepositIntent,
  TransferIntent,
  WithdrawIntent,
} from '@arcanetech/privacy-sdk-core';
import type { StellarPrivateRecord } from './state/domain/types.js';
import type { KytApplicationIdHints } from './transact/pool/proof-types.js';
import type { StellarTransferFromAddress } from './transact/transfer-source/types.js';

export type StellarAddress = string;
export type StellarAssetId = string;

export type { StellarTransferFromAddress } from './transact/transfer-source/types.js';

export type StellarTransferIntent = TransferIntent<
  StellarTransferFromAddress,
  StellarAssetId,
  bigint,
  StellarAddress
>;

export type {
  StellarAsset,
  StellarAssetsCatalog,
  StellarDeliverySyncState,
  StellarIncomingDeliveriesFilter,
  StellarIncomingDelivery,
  StellarLeafEphemeral,
  StellarLeanImtNode,
  StellarPoolMerkleState,
  StellarPrivateAssetRow,
  StellarPrivateRecord,
  StellarPrivateRecordStatus,
  StellarPublicBalance,
  StellarRegistryLookup,
  StellarWalletPrivateAddressScalar,
  StellarWalletPrivateAddressRecord,
  StellarTransactionStatus,
} from './state/domain/types.js';

export interface StellarPreparedOperation {
  kind: OperationKind;
  intent:
    | DepositIntent<StellarAddress, StellarAssetId, bigint>
    | StellarTransferIntent
    | WithdrawIntent<StellarAddress, StellarAssetId, bigint>;
  consumedRecords: StellarPrivateRecord[];
  outputRecords: StellarPrivateRecord[];
  submissionPayload: StellarSubmissionPayload;
  transactArtifacts?: StellarTransactArtifacts;
}

export interface StellarSubmissionPayload {
  operationId: string;
  signed: boolean;
  txHash?: string;
}

export interface StellarTransactArtifacts {
  proofHex?: string;
  publicHex?: string;
  ciphertextHex?: string;
  outputNoteEphemeralScalars?: string[];
  applicationIdsPlaintext?: KytApplicationIdHints;
  tokenAddress?: string;
  depositScalarHex?: string;
  precommitementHex?: string;
  commitmentHex?: string;
  walletPublicKey?: string;
  escrowRecipient?: string;
  escrowAuthorization?: string;
  escrowSend?: boolean;
  escrowSpendScalarHex?: string;
  escrowClaimantLimbs?: {
    recipientHi: string;
    recipientLo: string;
    nonceDecimal?: string;
  };
  executeFinalizeRequired?: boolean;
  spendSource?: 'privateAddress' | 'escrow';
  zkConfigNonce?: bigint;
}

export interface StellarOperationReceipt {
  operationId: string;
  confirmed: boolean;
}

export interface StellarNetworkConfig {
  id: string;
  rpcUrl: string;
  networkPassphrase: string;
  poolContract: string;
  registryContract: string;
  applicationId: string;
}

export interface StellarBrowserAssets {
  sdkWasm: ArrayBuffer;
}

export interface StellarWalletAdapter {
  getAddress(): Promise<StellarAddress>;
  authorizeMessage(message: Uint8Array | string): Promise<Uint8Array>;
  signTransactionPayload(
    payload: StellarSubmissionPayload,
  ): Promise<StellarSubmissionPayload>;
}

export interface StellarStorageAdapter {
  listPrivateRecords(filter: {
    owner?: StellarAddress;
    privateAddress?: string;
    asset?: StellarAssetId;
    amount?: bigint;
  }): Promise<StellarPrivateRecord[]>;
  savePrivateRecords(records: StellarPrivateRecord[]): Promise<void>;
  markPrivateRecordsUsed(records: StellarPrivateRecord[]): Promise<void>;
}

/** @internal Bridge-backed storage adapter; consumers pass {@link StateBridgeAdapter} instead. */
export type StellarStateAdapter = StateBridgeAdapter;

export interface StellarPolicyAdapter {
  inspectOperation(
    kind: OperationKind,
    intent:
      | DepositIntent<StellarAddress, StellarAssetId, bigint>
      | StellarTransferIntent
      | WithdrawIntent<StellarAddress, StellarAssetId, bigint>,
  ): Promise<void>;
}

export interface StellarTransactEngine {
  prepare(prepared: StellarPreparedOperation): Promise<StellarPreparedOperation>;
  submit(
    prepared: StellarPreparedOperation,
    signedPayload: StellarSubmissionPayload,
  ): Promise<StellarOperationReceipt>;
}

export interface StellarPrivacyClientConfigBase {
  network: StellarNetworkConfig;
  wallet: StellarWalletAdapter;
  state: StellarStateAdapter;
  auditPublicKeyHex?: string;
  policy?: StellarPolicyAdapter;
  transactEngine?: StellarTransactEngine;
}

import type { StellarTransactEnvironment } from './transact/environment/types.js';

export interface StellarBrowserPrivacyClientConfig extends StellarPrivacyClientConfigBase {
  assets: StellarBrowserAssets;
  transactEnvironment?: StellarTransactEnvironment;
}

/** Browser entrypoint config alias. */
export type StellarPrivacyClientConfig = StellarBrowserPrivacyClientConfig;

export interface ResolvedStellarPrivacyClientConfig extends Omit<
  StellarPrivacyClientConfigBase,
  'transactEngine'
> {
  transactEngine: StellarTransactEngine;
  transactEnvironment?: StellarTransactEnvironment;
}
