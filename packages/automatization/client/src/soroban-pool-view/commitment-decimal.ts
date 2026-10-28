import { Buffer } from 'buffer';

const FR_ORDER =
  0x73_ed_a7_53_29_9d_7d_48_33_39_d8_08_09_a1_d8_05_53_bd_a4_02_ff_fe_5b_fe_ff_ff_ff_ff_00_00_00_01n;

export function commitmentBufferToDecimal(buf: Buffer): string {
  const reduced = BigInt(`0x${buf.toString('hex')}`) % FR_ORDER;
  return reduced.toString();
}

export function fieldElementToBytes(decimal: string): Buffer {
  const value = BigInt(decimal);
  if (value < 0n || value >= FR_ORDER) {
    throw new Error('Nullifier hash is not a field element');
  }
  return Buffer.from(value.toString(16).padStart(64, '0'), 'hex');
}
