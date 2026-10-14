import type { DisclosurePolicy } from './disclosure.js';

export type OperationKind = 'deposit' | 'transfer' | 'withdraw' | 'publicWithdraw';

export interface PublicWithdrawDisclosure {
  senderAddress: 'public';
  recipientAddress: 'public';
  assetAddress: 'public';
  amount: 'public';
}

export interface DepositIntent<TAddress, TAsset, TAmount> {
  from: TAddress;
  to: TAddress;
  asset: TAsset;
  amount: TAmount;
  disclosure: DisclosurePolicy;
}

export interface TransferIntent<TFrom, TAsset, TAmount, TTo = TFrom> {
  from: TFrom;
  to: TTo;
  asset: TAsset;
  amount: TAmount;
  disclosure: DisclosurePolicy;
}

export interface WithdrawIntent<TAddress, TAsset, TAmount> {
  from: TAddress;
  to: TAddress;
  asset: TAsset;
  amount: TAmount;
  disclosure: DisclosurePolicy;
}

export interface PublicWithdrawIntent<TAddress, TAsset, TAmount> {
  from: TAddress;
  to: TAddress;
  asset: TAsset;
  amount: TAmount;
  disclosure: PublicWithdrawDisclosure;
}

export type OperationIntent<TAddress, TAsset, TAmount> =
  | DepositIntent<TAddress, TAsset, TAmount>
  | TransferIntent<TAddress, TAsset, TAmount>
  | WithdrawIntent<TAddress, TAsset, TAmount>
  | PublicWithdrawIntent<TAddress, TAsset, TAmount>;

export type IntentForKind<
  TKind extends OperationKind,
  TAddress,
  TAsset,
  TAmount,
> = TKind extends 'deposit'
  ? DepositIntent<TAddress, TAsset, TAmount>
  : TKind extends 'transfer'
    ? TransferIntent<TAddress, TAsset, TAmount>
    : TKind extends 'withdraw'
      ? WithdrawIntent<TAddress, TAsset, TAmount>
      : TKind extends 'publicWithdraw'
        ? PublicWithdrawIntent<TAddress, TAsset, TAmount>
        : never;
