import { Buffer } from 'buffer';
import { Client as RegistryContractClient } from 'registry';
import {
  adaptSignTransactionForGeneratedBinding,
  type StellarSignTransaction,
} from '../signing.js';

export type RegistryContractReadClient = {
  get_private_address: (input: { owner: string }) => Promise<{ result: unknown }>;
};

export type RegistryContractWriteClient = RegistryContractReadClient & {
  register_private_address: (input: {
    owner: string;
    public_key_x: Buffer;
    public_key_y: Buffer;
  }) => Promise<{
    signAndSend: () => Promise<{
      sendTransactionResponse?: {
        hash?: string;
      };
    }>;
  }>;
};

export function createInternalRegistryContractClient(input: {
  contractId: string;
  walletPublicKey: string;
  networkPassphrase: string;
  sorobanRpcUrl: string;
  signTransaction: StellarSignTransaction;
}): RegistryContractWriteClient {
  const signBinding = adaptSignTransactionForGeneratedBinding(input.signTransaction, {
    networkPassphrase: input.networkPassphrase,
    walletPublicKey: input.walletPublicKey,
  });
  return new RegistryContractClient({
    contractId: input.contractId,
    networkPassphrase: input.networkPassphrase,
    rpcUrl: input.sorobanRpcUrl,
    allowHttp: true,
    publicKey: input.walletPublicKey,
    signTransaction: signBinding,
  }) as unknown as RegistryContractWriteClient;
}

export type { PrivateAddressRecord } from 'registry';
