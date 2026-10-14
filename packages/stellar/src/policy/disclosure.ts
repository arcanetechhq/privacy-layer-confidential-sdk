import {
  unsupportedDisclosureError,
  type DepositIntent,
  type PrivacySdkError,
  type PublicWithdrawIntent,
  type WithdrawIntent,
} from '@arcanetech/privacy-sdk-core';
import type {
  StellarAddress,
  StellarAssetId,
  StellarTransferIntent,
} from '../types.js';
import {
  isPublicStellarRecipientTransfer,
  validatePublicRecipientTransferDisclosure,
} from './disclosure-routes.js';

type Intent =
  | DepositIntent<StellarAddress, StellarAssetId, bigint>
  | StellarTransferIntent
  | WithdrawIntent<StellarAddress, StellarAssetId, bigint>
  | PublicWithdrawIntent<StellarAddress, StellarAssetId, bigint>;

const PUBLIC_WITHDRAW_MESSAGE =
  'Public withdraw publishes the sender, recipient, asset, and amount.';

function rejectNonPublicWithdrawDisclosure(intent: Intent): PrivacySdkError[] {
  const errors: PrivacySdkError[] = [];
  const disclosure = intent.disclosure;
  if (disclosure.senderAddress !== 'public') {
    errors.push(
      unsupportedDisclosureError(
        'senderAddress',
        disclosure.senderAddress,
        ['public'],
        PUBLIC_WITHDRAW_MESSAGE,
      ),
    );
  }
  if (disclosure.recipientAddress !== 'public') {
    errors.push(
      unsupportedDisclosureError(
        'recipientAddress',
        disclosure.recipientAddress,
        ['public'],
        PUBLIC_WITHDRAW_MESSAGE,
      ),
    );
  }
  if (disclosure.assetAddress !== 'public') {
    errors.push(
      unsupportedDisclosureError(
        'assetAddress',
        disclosure.assetAddress,
        ['public'],
        PUBLIC_WITHDRAW_MESSAGE,
      ),
    );
  }
  if (disclosure.amount !== 'public') {
    errors.push(
      unsupportedDisclosureError(
        'amount',
        disclosure.amount,
        ['public'],
        PUBLIC_WITHDRAW_MESSAGE,
      ),
    );
  }
  return errors;
}

function isPublicWithdrawRoute(intent: Intent): boolean {
  return (
    intent.disclosure.recipientAddress === 'public' ||
    intent.disclosure.assetAddress === 'public' ||
    intent.disclosure.amount === 'public'
  );
}

function rejectPrivatePublicRouteFields(
  intent: Intent,
  errors: PrivacySdkError[],
  assetMessage: string,
  amountMessage: string,
): void {
  if (intent.disclosure.assetAddress === 'private') {
    errors.push(
      unsupportedDisclosureError('assetAddress', 'private', ['public'], assetMessage),
    );
  }
  if (intent.disclosure.amount === 'private') {
    errors.push(
      unsupportedDisclosureError('amount', 'private', ['public'], amountMessage),
    );
  }
}

export function validateStellarDisclosure(
  kind: 'deposit' | 'transfer' | 'withdraw' | 'publicWithdraw',
  intent: Intent,
): PrivacySdkError[] {
  const errors: PrivacySdkError[] = [];

  if (kind === 'publicWithdraw') {
    return rejectNonPublicWithdrawDisclosure(intent);
  }

  if (kind === 'transfer' && isPublicStellarRecipientTransfer(intent)) {
    errors.push(...validatePublicRecipientTransferDisclosure(intent.disclosure));
  }

  if (kind === 'withdraw' && isPublicWithdrawRoute(intent)) {
    rejectPrivatePublicRouteFields(
      intent,
      errors,
      'This withdrawal route publishes the asset identifier.',
      'This withdrawal route publishes the withdrawal amount.',
    );
  }

  if (kind === 'deposit' && intent.disclosure.senderAddress === 'private') {
    errors.push(
      unsupportedDisclosureError(
        'senderAddress',
        'private',
        ['public'],
        'Deposits from a public signer account cannot hide the sender address.',
      ),
    );
  }

  return errors;
}
