import { createInMemoryStateBridge } from '@arcanetech/privacy-sdk-state-memory';
import {
  Address,
  hash,
  Keypair,
  StrKey,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { buildAuthorizationEntryPreimage } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import {
  blendInterestDepositDefinitions,
  listInterestDeposits,
  nextInterestDeposit,
  placementTransaction,
  saveInterestDeposit,
} from '../src/index.js';

const SPEND_SCALAR = new Uint8Array(32).fill(1);
const BLEND_POOL = new Uint8Array(32).fill(2);
const TOKEN = new Uint8Array(32).fill(3);
const CHAIN_INDEX_0_ACCOUNT =
  'GBRS2YFQI36FCWICQNEJPB7D6EJWQL62ME7GHBNSFK2TIQWQPE6A6IUT';
const CHAIN_INDEX_1_ACCOUNT =
  'GB2MQYCMOF5GP3Q53Q4JCJHJLKDUH6BD5QN6AZEN2WSOW67GMZXI3RQ6';
const FIRST_SHARE_BALANCE = 42n;

describe('a second Interest Deposit', () => {
  it('takes the next free chain index and leaves the first share balance unchanged', async () => {
    const shares = new Map<string, bigint>([
      [CHAIN_INDEX_0_ACCOUNT, FIRST_SHARE_BALANCE],
    ]);

    const next = await nextInterestDeposit({
      spendScalar: SPEND_SCALAR,
      blendPoolContractId: BLEND_POOL,
      tokenContractId: TOKEN,
      sharesOf: (account) => Promise.resolve(shares.get(account) ?? 0n),
    });

    expect(next).toEqual({
      chainIndex: 1,
      account: CHAIN_INDEX_1_ACCOUNT,
    });
    expect(shares.get(CHAIN_INDEX_0_ACCOUNT)).toBe(FIRST_SHARE_BALANCE);
  });

  it('places that Interest Deposit in a separate transaction signed only by its G', async () => {
    const first = await placementTransaction(
      placementInput(CHAIN_INDEX_0_ACCOUNT, 0, 10n, utf8('first-placement-proof')),
    );
    const second = await placementTransaction(
      placementInput(CHAIN_INDEX_1_ACCOUNT, 1, 4n, utf8('second-placement-proof')),
    );
    const { bridge } = createInMemoryStateBridge();
    bridge.init(blendInterestDepositDefinitions);
    await saveInterestDeposit(bridge, interestDeposit(first));
    const recordedFirst = await listInterestDeposits(bridge);
    await saveInterestDeposit(bridge, interestDeposit(second));

    expect(first.chainIndex).toBe(0);
    expect(first.account).toBe(CHAIN_INDEX_0_ACCOUNT);
    expect(second.chainIndex).toBe(1);
    expect(second.account).toBe(CHAIN_INDEX_1_ACCOUNT);
    expect(second.envelope).not.toBe(first.envelope);
    expect(recordedFirst).toEqual([
      interestDeposit({ chainIndex: 0, account: CHAIN_INDEX_0_ACCOUNT }),
    ]);
    expect(await listInterestDeposits(bridge)).toEqual([
      ...recordedFirst,
      interestDeposit({ chainIndex: 1, account: CHAIN_INDEX_1_ACCOUNT }),
    ]);
    expect(placedPosition(second.envelope)).toEqual({
      account: CHAIN_INDEX_1_ACCOUNT,
      transferFrom: CHAIN_INDEX_1_ACCOUNT,
    });
    expect(signatureVerifies(first.envelope, CHAIN_INDEX_0_ACCOUNT)).toBe(true);
    expect(signatureVerifies(first.envelope, CHAIN_INDEX_1_ACCOUNT)).toBe(false);
    expect(signatureVerifies(second.envelope, CHAIN_INDEX_1_ACCOUNT)).toBe(true);
    expect(signatureVerifies(second.envelope, CHAIN_INDEX_0_ACCOUNT)).toBe(false);
    expect(envelopeHasAccount(second.envelope, CHAIN_INDEX_0_ACCOUNT)).toBe(false);
    expect(envelopeHasAccount(first.envelope, CHAIN_INDEX_1_ACCOUNT)).toBe(false);
    expect(envelopeHasAccount(first.envelope, WALLET_ACCOUNT)).toBe(false);
    expect(envelopeHasAccount(second.envelope, WALLET_ACCOUNT)).toBe(false);
    expect(envelopeSource(first.envelope)).toBe(RELAY_ACCOUNT);
    expect(envelopeSource(second.envelope)).toBe(RELAY_ACCOUNT);
  });
});

const NETWORK = 'Test SDF Network ; September 2015';
const EXPIRATION_LEDGER = 1000;
const SIGNAL_COUNT = 58;
const STATE_ROOT_INDEX = 44;
const WITHDRAW_ADDRESS_HI_INDEX = 45;
const WITHDRAW_ADDRESS_LO_INDEX = 46;
const PUBLIC_DEPOSIT_INDEX = 55;
const PUBLIC_WITHDRAWAL_INDEX = 56;
const RELAY_ACCOUNT = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 9)).publicKey();
const WALLET_ACCOUNT = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 8)).publicKey();
const ADAPTER = StrKey.encodeContract(Buffer.alloc(32, 4));
const BLEND_POOL_ADDRESS = StrKey.encodeContract(Buffer.from(BLEND_POOL));
const RESERVE_ADDRESS = StrKey.encodeContract(Buffer.from(TOKEN));
const POOL_ADDRESS = StrKey.encodeContract(Buffer.alloc(32, 5));

function interestDeposit(record: { chainIndex: number; account: string }): {
  chainIndex: number;
  account: string;
  blendPool: string;
  reserve: string;
} {
  return {
    chainIndex: record.chainIndex,
    account: record.account,
    blendPool: BLEND_POOL_ADDRESS,
    reserve: RESERVE_ADDRESS,
  };
}

function placementInput(
  account: string,
  chainIndex: number,
  amount: bigint,
  proof: Buffer,
) {
  return {
    spendScalar: SPEND_SCALAR,
    blendPoolContractId: BLEND_POOL,
    tokenContractId: TOKEN,
    publicSignals: publicSignals(account, amount),
    ciphertext: field(8),
    proof,
    amount,
    adapterContractId: ADAPTER,
    blendPool: BLEND_POOL_ADDRESS,
    reserve: RESERVE_ADDRESS,
    poolContractId: POOL_ADDRESS,
    relayAccount: RELAY_ACCOUNT,
    networkPassphrase: NETWORK,
    signatureExpirationLedger: EXPIRATION_LEDGER,
    kytExpirationLedger: EXPIRATION_LEDGER,
    kytSignature: Buffer.alloc(64, 7),
    applicationIdHints: ['1', '1', '0', '0'],
    recordedShares: FIRST_SHARE_BALANCE,
    exchangeRate: 2_000_000_000_000n,
    sourceSequence: '42',
    chainIndex,
  };
}

function publicSignals(account: string, amount: bigint): string {
  const body = Buffer.alloc(4 + SIGNAL_COUNT * 32);
  body.writeUInt32BE(SIGNAL_COUNT, 0);
  writeField(body, STATE_ROOT_INDEX, field(9));
  writeField(body, WITHDRAW_ADDRESS_HI_INDEX, addressHalf(account, 0));
  writeField(body, WITHDRAW_ADDRESS_LO_INDEX, addressHalf(account, 16));
  writeField(body, PUBLIC_WITHDRAWAL_INDEX, amountField(amount));
  writeField(body, PUBLIC_DEPOSIT_INDEX, amountField(0n));
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

function addressHalf(account: string, offset: number): Buffer {
  const raw = rawPublicKey(account);
  return Buffer.concat([Buffer.alloc(16), raw.subarray(offset, offset + 16)]);
}

function rawPublicKey(account: string): Buffer {
  return Keypair.fromPublicKey(account).rawPublicKey();
}

function envelopeHasAccount(envelope: string, account: string): boolean {
  return Buffer.from(envelope, 'base64').includes(rawPublicKey(account));
}

function envelopeSource(envelope: string): string {
  return TransactionBuilder.fromXDR(envelope, NETWORK).source;
}

function placedPosition(envelope: string): { account: string; transferFrom: string } {
  const transaction = TransactionBuilder.fromXDR(envelope, NETWORK);
  const operation = transaction.operations.find(
    (item) => item.type === 'invokeHostFunction',
  ) as {
    func: xdr.HostFunction;
    auth: xdr.SorobanAuthorizationEntry[];
  };
  const args = operation.func.invokeContract().args();
  const transfer = operation.auth[0]?.rootInvocation().subInvocations()[0];
  return {
    account: Address.fromScVal(args[0]!).toString(),
    transferFrom: Address.fromScVal(
      transfer!.function().contractFn().args()[0]!,
    ).toString(),
  };
}

function signatureVerifies(envelope: string, account: string): boolean {
  const transaction = TransactionBuilder.fromXDR(envelope, NETWORK);
  const operation = transaction.operations.find(
    (item) => item.type === 'invokeHostFunction',
  ) as { auth: xdr.SorobanAuthorizationEntry[] };
  const entry = operation.auth[0];
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
    throw new Error('Placement authorization has no signature');
  }
  return bytes;
}
