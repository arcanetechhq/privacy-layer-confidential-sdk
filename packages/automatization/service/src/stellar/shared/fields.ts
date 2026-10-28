import { randomBytes } from 'node:crypto';

export const FR_ORDER =
  0x30_64_4e_72_e1_31_a0_29_b8_50_45_b6_81_81_58_5d_28_33_e8_48_79_b9_70_91_43_e1_f5_93_f0_00_00_01n;
const BABYJUB_SUBGROUP_ORDER =
  2_736_030_358_979_909_402_780_800_718_157_159_386_076_813_972_158_567_259_200_215_660_948_447_373_041n;

export type FieldPair = [string, string];

export function stripHexPrefix(hex: string): string {
  return hex.replace(/^0x/iu, '');
}

export function hexToDecimal(hex: string): string {
  const clean = stripHexPrefix(hex);
  if (clean.length === 0) {
    return '0';
  }
  return (BigInt(`0x${clean}`) % FR_ORDER).toString(10);
}

export function decimalToHex(decimal: string): string {
  return BigInt(decimal).toString(16).padStart(64, '0');
}

export function fieldBytes(decimal: string): Buffer {
  const value = BigInt(decimal);
  if (value < 0n || value >= FR_ORDER) {
    throw new Error('Value is not a field element');
  }
  return Buffer.from(decimalToHex(decimal), 'hex');
}

export function babyJubDecimal(hex: string): string {
  const scalar = BigInt(`0x${hex}`) % BABYJUB_SUBGROUP_ORDER;
  return (scalar === 0n ? 1n : scalar).toString(10);
}

export function randomBabyJubScalar(): string {
  return babyJubDecimal(randomBytes(32).toString('hex'));
}

export function randomField(): string {
  return (BigInt(`0x${randomBytes(32).toString('hex')}`) % FR_ORDER).toString(10);
}
