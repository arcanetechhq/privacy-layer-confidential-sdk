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

export interface ReturnLegDraft {
  seed: Uint8Array;
  account: string;
  amount: bigint;
}

export interface ReturnEnvelopeInput {
  legs: ReturnLegDraft[];
  adapterContractId: string;
  blendPool: string;
  reserve: string;
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
}

export async function buildReturnEnvelope(input: ReturnEnvelopeInput): Promise<string> {
  const authorization = await Promise.all(
    input.legs.map((leg) => authorizeLeg(input, leg)),
  );
  const source = new Account(input.relayAccount, input.sourceSequence);
  return new TransactionBuilder(source, {
    fee: ENVELOPE_FEE,
    networkPassphrase: input.networkPassphrase,
  })
    .addOperation(returnOperation(input, authorization))
    .setTimeout(ENVELOPE_TIMEOUT_SECONDS)
    .build()
    .toXDR();
}

async function authorizeLeg(
  input: ReturnEnvelopeInput,
  leg: ReturnLegDraft,
): Promise<xdr.SorobanAuthorizationEntry> {
  return authorizeInvocation({
    signer: Keypair.fromRawEd25519Seed(Buffer.from(leg.seed)),
    validUntilLedgerSeq: input.signatureExpirationLedger,
    invocation: returnInvocation(input),
    networkPassphrase: input.networkPassphrase,
  });
}

function returnInvocation(input: ReturnEnvelopeInput): xdr.SorobanAuthorizedInvocation {
  return new xdr.SorobanAuthorizedInvocation({
    function: contractFunction(
      input.adapterContractId,
      'withdraw',
      authorizedArguments(input),
    ),
    subInvocations: [],
  });
}

function authorizedArguments(input: ReturnEnvelopeInput): xdr.ScVal[] {
  return [
    requestList(input.legs),
    new Address(input.blendPool).toScVal(),
    new Address(input.reserve).toScVal(),
    nativeToScVal(Buffer.from(input.signedSignals), { type: 'bytes' }),
    nativeToScVal(Buffer.from(input.ciphertext), { type: 'bytes' }),
  ];
}

function requestList(legs: readonly ReturnLegDraft[]): xdr.ScVal {
  return nativeToScVal(
    legs.map((leg) => ({ position: leg.account, amount: leg.amount })),
    { type: REQUEST_LIST },
  );
}

function returnOperation(
  input: ReturnEnvelopeInput,
  authorization: xdr.SorobanAuthorizationEntry[],
): xdr.Operation {
  const shared = authorizedArguments(input);
  return Operation.invokeContractFunction({
    contract: input.adapterContractId,
    function: 'withdraw',
    args: [...shared.slice(0, 4), poolCall(input)],
    auth: authorization,
  });
}

const REQUEST_LIST = [
  {
    position: ['symbol', 'address'],
    amount: ['symbol', 'i128'],
  },
] as const;
