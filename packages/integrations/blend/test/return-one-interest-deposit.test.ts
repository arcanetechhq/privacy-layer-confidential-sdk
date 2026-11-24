import {
  hash,
  Keypair,
  scValToNative,
  StrKey,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { buildAuthorizationEntryPreimage } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import {
  deriveInterestDepositSeed,
  interestDepositAccount,
  nextInterestDeposit,
  returnTransaction,
  type ReturnLeg,
} from '../src/index.js';

const SPEND_SCALAR = new Uint8Array(32).fill(1);
const OTHER_SCALAR = new Uint8Array(32).fill(5);
const BLEND_POOL = new Uint8Array(32).fill(2);
const TOKEN = new Uint8Array(32).fill(3);
const CHAIN_INDEX_0_ACCOUNT =
  'GBRS2YFQI36FCWICQNEJPB7D6EJWQL62ME7GHBNSFK2TIQWQPE6A6IUT';
const CHAIN_INDEX_1_ACCOUNT =
  'GB2MQYCMOF5GP3Q53Q4JCJHJLKDUH6BD5QN6AZEN2WSOW67GMZXI3RQ6';

describe('return one Interest Deposit', () => {
  it('does not reuse a zero record chain index', async () => {
    const recorded = new Set([CHAIN_INDEX_0_ACCOUNT]);
    const next = await nextInterestDeposit({
      spendScalar: SPEND_SCALAR,
      blendPoolContractId: BLEND_POOL,
      tokenContractId: TOKEN,
      recorded: (account) => Promise.resolve(recorded.has(account)),
    });

    expect(next).toEqual({
      chainIndex: 1,
      account: CHAIN_INDEX_1_ACCOUNT,
    });
  });

  it('returns the full underlying in a relay-paid deposit signed only by that G', async () => {
    const proof = utf8('return-proof-not-in-the-signature');
    await expect(
      returnTransaction(returnInput([leg(SPEND_SCALAR, 0, 10n)], proof, 1n)),
    ).rejects.toThrow('Public deposit is not the requested underlying.');

    const returned = await returnTransaction(
      returnInput([leg(SPEND_SCALAR, 0, 10n)], proof, 10n),
    );
    const transaction = TransactionBuilder.fromXDR(returned.envelope, NETWORK);

    expect(returned.accounts).toEqual([CHAIN_INDEX_0_ACCOUNT]);
    expect(transaction.source).toBe(RELAY_ACCOUNT);
    expect(transaction.operations.map((operation) => operation.type)).toEqual([
      'invokeHostFunction',
    ]);
    expect(envelopeHasAccount(returned.envelope, WALLET_ACCOUNT)).toBe(false);
    expect(signatureVerifies(returned.envelope, CHAIN_INDEX_0_ACCOUNT, 0)).toBe(true);
    expect(signatureVerifies(returned.envelope, WALLET_ACCOUNT, 0)).toBe(false);
    expect(requestsOf(returned.envelope)).toEqual([
      { position: CHAIN_INDEX_0_ACCOUNT, amount: 10n },
    ]);
    expect(authArgs(returned.envelope, 0).includes(proof)).toBe(false);
    expect(Buffer.from(invoke(returned.envelope).toXDR()).includes(proof)).toBe(true);
  });

  it('returns two Interest Deposits when each G signs the same list', async () => {
    const other = interestDepositAccount(
      await deriveInterestDepositSeed({
        spendScalar: OTHER_SCALAR,
        blendPoolContractId: BLEND_POOL,
        tokenContractId: TOKEN,
        chainIndex: 0,
      }),
    );
    const returned = await returnTransaction(
      returnInput(
        [leg(SPEND_SCALAR, 0, 10n), leg(OTHER_SCALAR, 0, 4n)],
        utf8('two-return-proof'),
        14n,
      ),
    );

    expect(returned.accounts).toEqual([CHAIN_INDEX_0_ACCOUNT, other]);
    expect(other).not.toBe(CHAIN_INDEX_0_ACCOUNT);
    expect(requestsOf(returned.envelope)).toEqual([
      { position: CHAIN_INDEX_0_ACCOUNT, amount: 10n },
      { position: other, amount: 4n },
    ]);
    expect(authArgs(returned.envelope, 0).equals(authArgs(returned.envelope, 1))).toBe(
      true,
    );
    expect(signatureVerifies(returned.envelope, CHAIN_INDEX_0_ACCOUNT, 0)).toBe(true);
    expect(signatureVerifies(returned.envelope, other, 1)).toBe(true);
    expect(signatureVerifies(returned.envelope, CHAIN_INDEX_0_ACCOUNT, 1)).toBe(false);
    expect(envelopeHasAccount(returned.envelope, WALLET_ACCOUNT)).toBe(false);
    expect(TransactionBuilder.fromXDR(returned.envelope, NETWORK).source).toBe(
      RELAY_ACCOUNT,
    );
  });
});

const NETWORK = 'Test SDF Network ; September 2015';
const EXPIRATION_LEDGER = 1000;
const SIGNAL_COUNT = 58;
const STATE_ROOT_INDEX = 44;
const PUBLIC_DEPOSIT_ASSET_HI_INDEX = 53;
const PUBLIC_DEPOSIT_ASSET_LO_INDEX = 54;
const PUBLIC_DEPOSIT_INDEX = 55;
const PUBLIC_WITHDRAWAL_INDEX = 56;
const RELAY_ACCOUNT = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 9)).publicKey();
const WALLET_ACCOUNT = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 8)).publicKey();
const ADAPTER = StrKey.encodeContract(Buffer.alloc(32, 4));
const BLEND_POOL_ADDRESS = StrKey.encodeContract(Buffer.from(BLEND_POOL));
const RESERVE_ADDRESS = StrKey.encodeContract(Buffer.from(TOKEN));
const POOL_ADDRESS = StrKey.encodeContract(Buffer.alloc(32, 5));

function leg(spendScalar: Uint8Array, chainIndex: number, amount: bigint): ReturnLeg {
  return { spendScalar, chainIndex, amount };
}

function returnInput(legs: ReturnLeg[], proof: Buffer, depositAmount: bigint) {
  return {
    legs,
    blendPoolContractId: BLEND_POOL,
    tokenContractId: TOKEN,
    publicSignals: publicSignals(depositAmount),
    ciphertext: field(8),
    proof,
    adapterContractId: ADAPTER,
    blendPool: BLEND_POOL_ADDRESS,
    reserve: RESERVE_ADDRESS,
    poolContractId: POOL_ADDRESS,
    relayAccount: RELAY_ACCOUNT,
    networkPassphrase: NETWORK,
    sourceSequence: '42',
    signatureExpirationLedger: EXPIRATION_LEDGER,
    kytExpirationLedger: EXPIRATION_LEDGER,
    kytSignature: Buffer.alloc(64, 7),
    applicationIdHints: ['1', '1', '0', '0'],
  };
}

function publicSignals(amount: bigint): string {
  const body = Buffer.alloc(4 + SIGNAL_COUNT * 32);
  body.writeUInt32BE(SIGNAL_COUNT, 0);
  writeField(body, STATE_ROOT_INDEX, field(9));
  writeField(body, PUBLIC_DEPOSIT_ASSET_HI_INDEX, addressHalf(RESERVE_ADDRESS, 0));
  writeField(body, PUBLIC_DEPOSIT_ASSET_LO_INDEX, addressHalf(RESERVE_ADDRESS, 16));
  writeField(body, PUBLIC_DEPOSIT_INDEX, amountField(amount));
  writeField(body, PUBLIC_WITHDRAWAL_INDEX, amountField(0n));
  return body.toString('hex');
}

function writeField(body: Buffer, index: number, value: Uint8Array): void {
  body.set(value, 4 + index * 32);
}

function field(value: number): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes[31] = value;
  return bytes;
}

function utf8(value: string): Buffer {
  return Buffer.from(value, 'utf8');
}

function amountField(amount: bigint): Buffer {
  const fieldBytes = Buffer.alloc(32);
  fieldBytes.writeBigUInt64BE(amount, 24);
  return fieldBytes;
}

function addressHalf(contractId: string, offset: number): Buffer {
  const raw = Buffer.from(StrKey.decodeContract(contractId));
  return Buffer.concat([Buffer.alloc(16), raw.subarray(offset, offset + 16)]);
}

function invoke(envelope: string): xdr.InvokeContractArgs {
  const transaction = TransactionBuilder.fromXDR(envelope, NETWORK);
  const operation = transaction.operations.find(
    (item) => item.type === 'invokeHostFunction',
  ) as { func: xdr.HostFunction };
  return operation.func.invokeContract();
}

function requestsOf(envelope: string): { position: string; amount: bigint }[] {
  const decoded = scValToNative(invoke(envelope).args()[0]!) as {
    position: string;
    amount: bigint;
  }[];
  return decoded;
}

function authArgs(envelope: string, index: number): Buffer {
  const args = authEntry(envelope, index)
    ?.rootInvocation()
    .function()
    .contractFn()
    .args();
  return Buffer.concat((args ?? []).map((argument) => Buffer.from(argument.toXDR())));
}

function authEntry(
  envelope: string,
  index: number,
): xdr.SorobanAuthorizationEntry | undefined {
  const transaction = TransactionBuilder.fromXDR(envelope, NETWORK);
  const operation = transaction.operations.find(
    (item) => item.type === 'invokeHostFunction',
  ) as { auth: xdr.SorobanAuthorizationEntry[] };
  return operation.auth.find((_entry, offset) => offset === index);
}

function envelopeHasAccount(envelope: string, account: string): boolean {
  return Buffer.from(envelope, 'base64').includes(
    Keypair.fromPublicKey(account).rawPublicKey(),
  );
}

function signatureVerifies(envelope: string, account: string, index: number): boolean {
  const entry = authEntry(envelope, index);
  if (!entry) {
    return false;
  }
  const preimage = buildAuthorizationEntryPreimage(entry, EXPIRATION_LEDGER, NETWORK);
  return Keypair.fromPublicKey(account).verify(
    hash(preimage.toXDR()),
    signatureOf(entry),
  );
}

function signatureOf(entry: xdr.SorobanAuthorizationEntry): Buffer {
  const signed = entry.credentials().address().signature().vec()?.[0]?.map();
  const signature = signed?.find(
    (item) => item.key().sym()?.toString() === 'signature',
  );
  const bytes = signature?.val().bytes();
  if (!bytes) {
    throw new Error('Return authorization has no signature');
  }
  return bytes;
}
