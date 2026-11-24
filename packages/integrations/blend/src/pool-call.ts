import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';

const SIX_BY_SIX_NONCE = 7n;

const POOL_CALL_TYPE = {
  nonce: ['symbol', 'u64'],
  proof_bytes: ['symbol', 'bytes'],
  pub_signals_bytes: ['symbol', 'bytes'],
  ciphertext_bytes: ['symbol', 'bytes'],
  kyt_authorization: [
    'symbol',
    {
      expiration_ledger: ['symbol', 'u32'],
      signature: ['symbol', 'bytes'],
    },
  ],
} as const;

export function poolCall(input: {
  proof: Uint8Array;
  publicSignals: Uint8Array;
  ciphertext: Uint8Array;
  kytExpirationLedger: number;
  kytSignature: Uint8Array;
}): xdr.ScVal {
  return nativeToScVal(
    {
      nonce: SIX_BY_SIX_NONCE,
      proof_bytes: Buffer.from(input.proof),
      pub_signals_bytes: Buffer.from(input.publicSignals),
      ciphertext_bytes: Buffer.from(input.ciphertext),
      kyt_authorization: {
        expiration_ledger: input.kytExpirationLedger,
        signature: Buffer.from(input.kytSignature),
      },
    },
    { type: POOL_CALL_TYPE },
  );
}

export function contractFunction(
  contractId: string,
  functionName: string,
  args: xdr.ScVal[],
): xdr.SorobanAuthorizedFunction {
  return xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
    new xdr.InvokeContractArgs({
      contractAddress: new Address(contractId).toScAddress(),
      functionName,
      args,
    }),
  );
}
