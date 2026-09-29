import {
  canonicalBabyJubScalarFromInteger,
  reduceDerivedEscrowSpendScalar,
} from '@arcanetech/stellar-privacy-pool-zk-sdk';

const SCALAR_HEX_CHAR_LENGTH = 64;
const DECIMAL_RADIX = 10;

function normalizeRecipientScalarHex(hexInput: string): string {
  const trimmed = hexInput.trim().replace(/^0x/iu, '');
  if (!/^[0-9a-f]*$/iu.test(trimmed)) {
    throw new Error('recipient scalar hex must be hexadecimal');
  }
  const withLeadingNibble = trimmed.length % 2 === 0 ? trimmed : `0${trimmed}`;
  const lower = withLeadingNibble.toLowerCase();
  const padded = lower
    .padStart(SCALAR_HEX_CHAR_LENGTH, '0')
    .slice(-SCALAR_HEX_CHAR_LENGTH);
  if (padded.length !== SCALAR_HEX_CHAR_LENGTH) {
    throw new Error(
      `recipient scalar hex must fit 32 bytes (${SCALAR_HEX_CHAR_LENGTH} hex chars)`,
    );
  }
  return padded;
}

export function privKeyScalarDecimalFromRecipientScalarHex(hexInput: string): string {
  const hex = normalizeRecipientScalarHex(hexInput);
  const value = BigInt(`0x${hex}`);
  return canonicalBabyJubScalarFromInteger(value).toString(DECIMAL_RADIX);
}

function privKeyScalarDecimalFromDerivedEscrowHex(hexInput: string): string {
  const hex = normalizeRecipientScalarHex(hexInput);
  const value = BigInt(`0x${hex}`);
  return reduceDerivedEscrowSpendScalar(value).toString(DECIMAL_RADIX);
}

export function resolveTransferSpendScalars(input: {
  senderPrivKeyScalarHex: string;
  escrowSweep: boolean;
}): { privKeyScalar: string; ownerScalarHex: string } {
  const senderHex = input.senderPrivKeyScalarHex;
  if (!input.escrowSweep) {
    return {
      privKeyScalar: privKeyScalarDecimalFromRecipientScalarHex(senderHex),
      ownerScalarHex: senderHex,
    };
  }
  const privKeyScalar = privKeyScalarDecimalFromDerivedEscrowHex(senderHex);
  return {
    privKeyScalar,
    ownerScalarHex: BigInt(privKeyScalar)
      .toString(16)
      .padStart(SCALAR_HEX_CHAR_LENGTH, '0'),
  };
}
