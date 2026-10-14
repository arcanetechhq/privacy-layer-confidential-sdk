import type { PrivacyClientAdapters } from './adapters.js';
import { missingDependencyError, type PrivacySdkError } from './errors.js';
import type {
  OperationIntent,
  OperationKind,
  PublicWithdrawIntent,
} from './intents.js';

export function collectMissingDependencies<
  TAddress,
  TAsset,
  TAmount,
  TSignedPayload,
  TPrivateRecord,
  TPrepared,
  TReceipt,
>(
  adapters: PrivacyClientAdapters<
    TAddress,
    TAsset,
    TAmount,
    TSignedPayload,
    TPrivateRecord,
    TPrepared,
    TReceipt
  >,
  required: Array<
    keyof PrivacyClientAdapters<
      TAddress,
      TAsset,
      TAmount,
      TSignedPayload,
      TPrivateRecord,
      TPrepared,
      TReceipt
    >
  >,
): PrivacySdkError[] {
  const errors: PrivacySdkError[] = [];
  for (const key of required) {
    const missingError = getMissingDependencyError(adapters, key);
    if (missingError !== undefined) {
      errors.push(missingError);
    }
  }
  return errors;
}

function getMissingDependencyError<
  TAddress,
  TAsset,
  TAmount,
  TSignedPayload,
  TPrivateRecord,
  TPrepared,
  TReceipt,
>(
  adapters: PrivacyClientAdapters<
    TAddress,
    TAsset,
    TAmount,
    TSignedPayload,
    TPrivateRecord,
    TPrepared,
    TReceipt
  >,
  key: keyof PrivacyClientAdapters<
    TAddress,
    TAsset,
    TAmount,
    TSignedPayload,
    TPrivateRecord,
    TPrepared,
    TReceipt
  >,
): PrivacySdkError | undefined {
  if (key === 'wallet' && adapters.wallet === undefined) {
    return missingDependencyError('wallet', 'Missing wallet adapter.');
  }
  if (key === 'storage' && adapters.storage === undefined) {
    return missingDependencyError('storage', 'Missing storage adapter.');
  }
  if (key === 'network' && adapters.network === undefined) {
    return missingDependencyError('network', 'Missing network adapter.');
  }
  if (key === 'policy' && adapters.policy === undefined) {
    return missingDependencyError('policy', 'Missing policy adapter.');
  }
  return undefined;
}

export async function validatePolicy<
  TAddress,
  TAsset,
  TAmount,
  TSignedPayload,
  TPrivateRecord,
  TPrepared,
  TReceipt,
>(
  kind: OperationKind,
  intent: OperationIntent<TAddress, TAsset, TAmount>,
  policy: NonNullable<
    PrivacyClientAdapters<
      TAddress,
      TAsset,
      TAmount,
      TSignedPayload,
      TPrivateRecord,
      TPrepared,
      TReceipt
    >['policy']
  >,
): Promise<PrivacySdkError[]> {
  if (kind === 'deposit') {
    return policy.validateDeposit(intent);
  }
  if (kind === 'transfer') {
    return policy.validateTransfer(intent);
  }
  if (kind === 'publicWithdraw') {
    return policy.validatePublicWithdraw(
      intent as PublicWithdrawIntent<TAddress, TAsset, TAmount>,
    );
  }
  return policy.validateWithdraw(intent);
}

export async function prepareWithNetwork<
  TAddress,
  TAsset,
  TAmount,
  TSignedPayload,
  TPrivateRecord,
  TPrepared,
  TReceipt,
>(
  kind: OperationKind,
  intent: OperationIntent<TAddress, TAsset, TAmount>,
  network: NonNullable<
    PrivacyClientAdapters<
      TAddress,
      TAsset,
      TAmount,
      TSignedPayload,
      TPrivateRecord,
      TPrepared,
      TReceipt
    >['network']
  >,
): Promise<TPrepared> {
  if (kind === 'deposit') {
    return network.prepareDeposit(intent);
  }
  if (kind === 'transfer') {
    return network.prepareTransfer(intent);
  }
  if (kind === 'publicWithdraw') {
    return network.preparePublicWithdraw(
      intent as PublicWithdrawIntent<TAddress, TAsset, TAmount>,
    );
  }
  return network.prepareWithdraw(intent);
}
