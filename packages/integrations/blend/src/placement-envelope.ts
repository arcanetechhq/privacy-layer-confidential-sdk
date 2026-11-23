import {
  Account,
  Address,
  authorizeInvocation,
  Keypair,
  nativeToScVal,
  Operation,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';

const ENVELOPE_FEE = '100';
const ENVELOPE_TIMEOUT_SECONDS = 30;
const SOURCE_SEQUENCE = '0';

export async function buildPlacementEnvelope(input: {
  seed: Uint8Array;
  account: string;
  adapterContractId: string;
  blendPool: string;
  reserve: string;
  amount: bigint;
  signedSignals: Uint8Array;
  ciphertext: Uint8Array;
  proof: Uint8Array;
  publicSignals: Uint8Array;
  relayAccount: string;
  networkPassphrase: string;
  signatureExpirationLedger: number;
  kytExpirationLedger: number;
  kytSignature: Uint8Array;
}): Promise<string> {
  const authorization = await authorizeInvocation({
    signer: Keypair.fromRawEd25519Seed(Buffer.from(input.seed)),
    validUntilLedgerSeq: input.signatureExpirationLedger,
    invocation: depositAuthorization(input),
    networkPassphrase: input.networkPassphrase,
  });
  const source = new Account(input.relayAccount, SOURCE_SEQUENCE);
  return new TransactionBuilder(source, {
    fee: ENVELOPE_FEE,
    networkPassphrase: input.networkPassphrase,
  })
    .addOperation(depositOperation(input, authorization))
    .setTimeout(ENVELOPE_TIMEOUT_SECONDS)
    .build()
    .toXDR();
}

function depositAuthorization(input: {
  adapterContractId: string;
  blendPool: string;
  reserve: string;
  account: string;
  amount: bigint;
  signedSignals: Uint8Array;
  ciphertext: Uint8Array;
}): xdr.SorobanAuthorizedInvocation {
  return new xdr.SorobanAuthorizedInvocation({
    function: contractFunction(
      input.adapterContractId,
      'deposit',
      authorizedArguments(input),
    ),
    subInvocations: [tokenTransfer(input)],
  });
}

function tokenTransfer(input: {
  reserve: string;
  account: string;
  adapterContractId: string;
  amount: bigint;
}): xdr.SorobanAuthorizedInvocation {
  return new xdr.SorobanAuthorizedInvocation({
    function: contractFunction(input.reserve, 'transfer', [
      new Address(input.account).toScVal(),
      new Address(input.adapterContractId).toScVal(),
      nativeToScVal(input.amount, { type: 'i128' }),
    ]),
    subInvocations: [],
  });
}

function authorizedArguments(input: {
  blendPool: string;
  reserve: string;
  amount: bigint;
  signedSignals: Uint8Array;
  ciphertext: Uint8Array;
}): xdr.ScVal[] {
  return [
    new Address(input.blendPool).toScVal(),
    new Address(input.reserve).toScVal(),
    nativeToScVal(input.amount, { type: 'i128' }),
    nativeToScVal(Buffer.from(input.signedSignals), { type: 'bytes' }),
    nativeToScVal(Buffer.from(input.ciphertext), { type: 'bytes' }),
  ];
}

function depositOperation(
  input: {
    adapterContractId: string;
    account: string;
    blendPool: string;
    reserve: string;
    amount: bigint;
    signedSignals: Uint8Array;
    proof: Uint8Array;
    publicSignals: Uint8Array;
    ciphertext: Uint8Array;
    kytExpirationLedger: number;
    kytSignature: Uint8Array;
  },
  authorization: xdr.SorobanAuthorizationEntry,
): xdr.Operation {
  return Operation.invokeContractFunction({
    contract: input.adapterContractId,
    function: 'deposit',
    args: [
      new Address(input.account).toScVal(),
      ...authorizedArguments({
        ...input,
        ciphertext: input.ciphertext,
      }).slice(0, 4),
      poolCall(input),
    ],
    auth: [authorization],
  });
}

function poolCall(input: {
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

function contractFunction(
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
