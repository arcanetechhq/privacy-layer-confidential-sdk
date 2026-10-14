import type { PrivacyClientAdapters } from './adapters.js';
import type {
  DepositIntent,
  PublicWithdrawIntent,
  TransferIntent,
  WithdrawIntent,
} from './intents.js';
import { preparePrivacyOperation } from './prepare-privacy-operation.js';
import type { OperationResult } from './operations.js';
import { PrivacyClient } from './privacy-client.js';

export class AdapterPrivacyClient<
  TAddress,
  TAsset,
  TAmount,
  TSignedPayload,
  TPrivateRecord,
  TPrepared,
  TReceipt,
> extends PrivacyClient<TAddress, TAsset, TAmount, TPrepared, TReceipt> {
  constructor(
    private readonly adapters: PrivacyClientAdapters<
      TAddress,
      TAsset,
      TAmount,
      TSignedPayload,
      TPrivateRecord,
      TPrepared,
      TReceipt
    >,
  ) {
    super();
  }

  deposit(
    intent: DepositIntent<TAddress, TAsset, TAmount>,
  ): Promise<
    OperationResult<'deposit', TAddress, TAsset, TAmount, TPrepared, TReceipt>
  > {
    return preparePrivacyOperation('deposit', intent, this.adapters);
  }

  transfer(
    intent: TransferIntent<TAddress, TAsset, TAmount, TAddress>,
  ): Promise<
    OperationResult<'transfer', TAddress, TAsset, TAmount, TPrepared, TReceipt>
  > {
    return preparePrivacyOperation('transfer', intent, this.adapters);
  }

  withdraw(
    intent: WithdrawIntent<TAddress, TAsset, TAmount>,
  ): Promise<
    OperationResult<'withdraw', TAddress, TAsset, TAmount, TPrepared, TReceipt>
  > {
    return preparePrivacyOperation('withdraw', intent, this.adapters);
  }

  publicWithdraw(
    intent: PublicWithdrawIntent<TAddress, TAsset, TAmount>,
  ): Promise<
    OperationResult<'publicWithdraw', TAddress, TAsset, TAmount, TPrepared, TReceipt>
  > {
    return preparePrivacyOperation('publicWithdraw', intent, this.adapters);
  }
}
