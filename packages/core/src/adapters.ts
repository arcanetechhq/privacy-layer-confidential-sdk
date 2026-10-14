import type {
  DepositIntent,
  PublicWithdrawIntent,
  TransferIntent,
  WithdrawIntent,
} from './intents.js';
import type { ExecuteOptions } from './events.js';
import type { PrivacySdkError } from './errors.js';

export interface WalletAdapter<TAddress, TSignedPayload> {
  getAddress(): Promise<TAddress>;
  authorizeMessage(message: Uint8Array | string): Promise<Uint8Array>;
  authorizePayload(payload: TSignedPayload): Promise<TSignedPayload>;
}

export interface StorageAdapter<TAddress, TAsset, TAmount, TPrivateRecord> {
  listPrivateRecords(filter: {
    owner: TAddress;
    asset?: TAsset;
    amount?: TAmount;
  }): Promise<TPrivateRecord[]>;
  savePrivateRecords(records: TPrivateRecord[]): Promise<void>;
  markPrivateRecordsUsed(records: TPrivateRecord[]): Promise<void>;
}

export interface NetworkAdapter<TAddress, TAsset, TAmount, TPrepared, TReceipt> {
  prepareDeposit(input: DepositIntent<TAddress, TAsset, TAmount>): Promise<TPrepared>;
  prepareTransfer(
    input: TransferIntent<TAddress, TAsset, TAmount, TAddress>,
  ): Promise<TPrepared>;
  prepareWithdraw(input: WithdrawIntent<TAddress, TAsset, TAmount>): Promise<TPrepared>;
  preparePublicWithdraw(
    input: PublicWithdrawIntent<TAddress, TAsset, TAmount>,
  ): Promise<TPrepared>;
  submit(prepared: TPrepared, options?: ExecuteOptions): Promise<TReceipt>;
}

export interface PolicyAdapter<TAddress, TAsset, TAmount> {
  validateDeposit(
    intent: DepositIntent<TAddress, TAsset, TAmount>,
  ): Promise<PrivacySdkError[]>;
  validateTransfer(
    intent: TransferIntent<TAddress, TAsset, TAmount, TAddress>,
  ): Promise<PrivacySdkError[]>;
  validateWithdraw(
    intent: WithdrawIntent<TAddress, TAsset, TAmount>,
  ): Promise<PrivacySdkError[]>;
  validatePublicWithdraw(
    intent: PublicWithdrawIntent<TAddress, TAsset, TAmount>,
  ): Promise<PrivacySdkError[]>;
}

export interface PrivacyClientAdapters<
  TAddress,
  TAsset,
  TAmount,
  TSignedPayload,
  TPrivateRecord,
  TPrepared,
  TReceipt,
> {
  wallet?: WalletAdapter<TAddress, TSignedPayload>;
  storage?: StorageAdapter<TAddress, TAsset, TAmount, TPrivateRecord>;
  network?: NetworkAdapter<TAddress, TAsset, TAmount, TPrepared, TReceipt>;
  policy?: PolicyAdapter<TAddress, TAsset, TAmount>;
}
