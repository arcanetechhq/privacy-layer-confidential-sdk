import { Buffer } from 'buffer';
import { Keypair } from '@stellar/stellar-sdk';

export function interestDepositAccount(seed: Uint8Array): string {
  return Keypair.fromRawEd25519Seed(Buffer.from(seed)).publicKey();
}
