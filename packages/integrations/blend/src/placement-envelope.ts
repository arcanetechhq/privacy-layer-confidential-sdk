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
import { contractFunction, poolCall } from './pool-call.js';

const ENVELOPE_FEE = '100';
const ENVELOPE_TIMEOUT_SECONDS = 30;
const CREATE_ACCOUNT_STARTING_BALANCE = '1';

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
  sourceSequence: string;
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
  const source = new Account(input.relayAccount, input.sourceSequence);
  return new TransactionBuilder(source, {
    fee: ENVELOPE_FEE,
    networkPassphrase: input.networkPassphrase,
  })
    .addOperation(
      Operation.createAccount({
        destination: input.account,
        startingBalance: CREATE_ACCOUNT_STARTING_BALANCE,
      }),
    )
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
