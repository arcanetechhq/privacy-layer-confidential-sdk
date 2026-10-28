import type { DepositInvocation } from '@arcanetech/privacy-sdk-automatization-plan';
import { Keypair } from '@stellar/stellar-sdk';

export type { DepositInvocation } from '@arcanetech/privacy-sdk-automatization-plan';

export interface DepositSigner {
  sign(invocation: DepositInvocation): Promise<string>;
}

export function depositSigningMessage(invocation: DepositInvocation): string {
  return `${invocation.root} ${invocation.pinnedOutputCommitments.join(' ')}`;
}

export function createSecretDepositSigner(input: { secretKey: string }): DepositSigner {
  const keypair = Keypair.fromSecret(input.secretKey);
  return {
    async sign(invocation) {
      const signature = keypair.sign(Buffer.from(depositSigningMessage(invocation)));
      return signature.toString('base64');
    },
  };
}
