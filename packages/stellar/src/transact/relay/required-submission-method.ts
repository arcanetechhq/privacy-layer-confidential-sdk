import type { StellarPreparedOperation } from '../../types.js';
import { DEFAULT_ZK_CONFIG_NONCE } from '../environment/zk-config-nonce.js';
import { relayLayoutProfileForNonce } from './layout-profile.js';
import { sliceSupportedPublicSignalFields } from './signals.js';

const ZERO_PUBLIC_DEPOSIT = 0n;

export const SUBMISSION_METHOD = {
  direct: 'direct',
  relay: 'relay',
} as const;

export type SubmissionMethod =
  (typeof SUBMISSION_METHOD)[keyof typeof SUBMISSION_METHOD];

export const ESCROW_SUBMISSION_REFUSAL = {
  positivePublicDeposit: 'escrow_positive_public_deposit',
} as const;

export type EscrowSubmissionRefusal =
  (typeof ESCROW_SUBMISSION_REFUSAL)[keyof typeof ESCROW_SUBMISSION_REFUSAL];

export type RequiredSubmissionMethodResult =
  { method: SubmissionMethod } | { refused: EscrowSubmissionRefusal };

export class EscrowSubmissionRefusedError extends Error {
  readonly reason: EscrowSubmissionRefusal;

  constructor(reason: EscrowSubmissionRefusal) {
    super(reason);
    this.name = 'EscrowSubmissionRefusedError';
    this.reason = reason;
  }
}

export function isEscrowPreparedOperation(prepared: StellarPreparedOperation): boolean {
  return (
    prepared.transactArtifacts?.escrowSend === true ||
    prepared.transactArtifacts?.spendSource === 'escrow'
  );
}

function publicDepositAmountFromPrepared(
  prepared: StellarPreparedOperation,
  zkConfigNonce: bigint,
): bigint | undefined {
  const publicHex = prepared.transactArtifacts?.publicHex;
  if (!publicHex) {
    return undefined;
  }
  const layout = relayLayoutProfileForNonce(zkConfigNonce);
  const fields = sliceSupportedPublicSignalFields(publicHex, zkConfigNonce);
  const field = fields.find(
    (_unused, offset) => offset === layout.indices.publicDeposit,
  );
  if (!field) {
    throw new Error(
      `Missing packed public signal at index ${String(layout.indices.publicDeposit)}.`,
    );
  }
  return BigInt(`0x${field.toString('hex')}`);
}

export function evaluateRequiredSubmissionMethod(
  prepared: StellarPreparedOperation,
  zkConfigNonce: bigint = DEFAULT_ZK_CONFIG_NONCE,
): RequiredSubmissionMethodResult {
  if (prepared.kind === 'publicWithdraw') {
    return { method: SUBMISSION_METHOD.direct };
  }
  const publicDepositAmount = publicDepositAmountFromPrepared(prepared, zkConfigNonce);
  if (isEscrowPreparedOperation(prepared)) {
    if (
      publicDepositAmount !== undefined &&
      publicDepositAmount > ZERO_PUBLIC_DEPOSIT
    ) {
      return { refused: ESCROW_SUBMISSION_REFUSAL.positivePublicDeposit };
    }
    if (prepared.transactArtifacts?.escrowSend === true) {
      return { method: SUBMISSION_METHOD.relay };
    }
    return { method: SUBMISSION_METHOD.direct };
  }
  if (publicDepositAmount === undefined) {
    throw new Error('Prepared operation is missing transact artifacts.');
  }
  return {
    method:
      publicDepositAmount > ZERO_PUBLIC_DEPOSIT
        ? SUBMISSION_METHOD.direct
        : SUBMISSION_METHOD.relay,
  };
}

export function requiredSubmissionMethod(
  prepared: StellarPreparedOperation,
  zkConfigNonce: bigint = DEFAULT_ZK_CONFIG_NONCE,
): SubmissionMethod {
  const result = evaluateRequiredSubmissionMethod(prepared, zkConfigNonce);
  if ('refused' in result) {
    throw new EscrowSubmissionRefusedError(result.refused);
  }
  return result.method;
}
