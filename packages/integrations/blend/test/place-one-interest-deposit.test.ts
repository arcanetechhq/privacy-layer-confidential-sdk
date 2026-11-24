import { createInMemoryStateBridge } from '@arcanetech/privacy-sdk-state-memory';
import {
  readRelayTransactSupportedProfile,
  SIX_BY_SIX_BINDING_ZK_NONCE,
} from '@arcanetech/privacy-sdk-stellar/transact';
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
  deriveInterestDepositSeed,
  interestDepositAccount,
  listInterestDeposits,
  placementAuthorization,
  placementTransaction,
  saveInterestDeposit,
  signRelayPlacement,
  underlyingFromShares,
} from '../src/index.js';

const SPEND_SCALAR = new Uint8Array(32).fill(1);
const BLEND_POOL = new Uint8Array(32).fill(2);
const TOKEN = new Uint8Array(32).fill(3);
const NETWORK = 'Test SDF Network ; September 2015';
const EXPIRATION_LEDGER = 1000;
const CHAIN_INDEX_0_ACCOUNT =
  'GBRS2YFQI36FCWICQNEJPB7D6EJWQL62ME7GHBNSFK2TIQWQPE6A6IUT';
const SIGNAL_COUNT = 58;
const STATE_ROOT_INDEX = 44;
const WITHDRAW_ADDRESS_HI_INDEX = 45;
const WITHDRAW_ADDRESS_LO_INDEX = 46;
const PUBLIC_DEPOSIT_INDEX = 55;
const PUBLIC_WITHDRAWAL_INDEX = 56;
const PLACED_AMOUNT = 10n;
const PROOF = utf8('placement-proof-not-in-the-signature');
const REBUILT_PROOF = utf8('placement-proof-rebuilt-for-a-new-root');
const CIPHERTEXT = field(8);
const RELAY_SEED = Buffer.alloc(32, 9);
const RELAY_ACCOUNT = Keypair.fromRawEd25519Seed(RELAY_SEED).publicKey();
const RELAY_SECRET = Keypair.fromRawEd25519Seed(RELAY_SEED).secret();
const RELAY_ACCOUNT_SEQUENCE = '42';
const WALLET_ACCOUNT = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 8)).publicKey();
const ADAPTER = StrKey.encodeContract(Buffer.alloc(32, 4));
const BLEND_POOL_ADDRESS = StrKey.encodeContract(Buffer.from(BLEND_POOL));
const RESERVE_ADDRESS = StrKey.encodeContract(Buffer.from(TOKEN));
const POOL_ADDRESS = StrKey.encodeContract(Buffer.alloc(32, 5));

describe('one Interest Deposit placement', () => {
  it('derives the chain address from the spend scalar, pool, token, and index', async () => {
    const seed = await deriveInterestDepositSeed({
      spendScalar: SPEND_SCALAR,
      blendPoolContractId: BLEND_POOL,
      tokenContractId: TOKEN,
      chainIndex: 4,
    });

    expect(Buffer.from(seed).toString('hex')).toBe(
      '0d468e5932b9e25cef6fb00e193f694aefd089e5feb0fc17461b351039978669',
    );
  });

  it('keeps the G signature and the KYT signal hash when only stateRoot changes', async () => {
    const older = await placementAuthorization({
      publicSignals: [field(1), field(9), field(4)],
      stateRootIndex: 1,
      ciphertext: field(8),
    });
    const newer = await placementAuthorization({
      publicSignals: [field(1), field(2), field(4)],
      stateRootIndex: 1,
      ciphertext: field(8),
    });

    expect(older.zkConfigNonce).toBe(SIX_BY_SIX_BINDING_ZK_NONCE);
    expect(newer).toEqual(older);
    expect(Buffer.from(older.kytSignalHash).toString('hex')).toBe(
      'b8f667fb68087479dd70fbb5757bad68ea9ca5d3e227404736b35110e0d1edd5',
    );
    expect('proof' in older).toBe(false);

    const changedAmount = await placementAuthorization({
      publicSignals: [field(1), field(9), field(5)],
      stateRootIndex: 1,
      ciphertext: field(8),
    });
    expect(changedAmount.kytSignalHash).not.toEqual(older.kytSignalHash);
  });

  it('records one Interest Deposit without a share balance and shows underlying', async () => {
    const { bridge } = createInMemoryStateBridge();
    bridge.init(blendInterestDepositDefinitions);
    const account = interestDepositAccount(SPEND_SCALAR);
    await saveInterestDeposit(bridge, {
      chainIndex: 0,
      account,
      blendPool: 'CBLEND',
      reserve: 'CTOKEN',
    });

    expect(await listInterestDeposits(bridge)).toEqual([
      {
        chainIndex: 0,
        account,
        blendPool: 'CBLEND',
        reserve: 'CTOKEN',
      },
    ]);
    expect(underlyingFromShares(42n, 2_000_000_000_000n)).toBe(84n);
  });

  it('places chain index 0 through the public-withdrawal relay without signing the proof', async () => {
    const placed = await placementTransaction(placementInput(PROOF, 9));
    const rebuilt = await placementTransaction(placementInput(REBUILT_PROOF, 2));
    const changedAmount = await placementTransaction({
      ...placementInput(PROOF, 9),
      publicSignals: publicSignals({ stateRoot: 9, amount: 11n }),
      amount: 11n,
    });

    expect(placed.chainIndex).toBe(0);
    expect(placed.account).toBe(CHAIN_INDEX_0_ACCOUNT);
    expect(placed.underlying).toBe(84n);
    expect(envelopeSource(placed.envelope)).toBe(RELAY_ACCOUNT);
    expect(envelopeBytes(placed.envelope).includes(rawPublicKey(WALLET_ACCOUNT))).toBe(
      false,
    );

    const call = depositCall(placed.envelope);
    expect(call.contract).toBe(ADAPTER);
    expect(call.functionName).toBe('deposit');
    expect(call.hostFunction.includes(PROOF)).toBe(true);
    expect(call.authorization.includes(PROOF)).toBe(false);
    expect(call.authorization.includes(REBUILT_PROOF)).toBe(false);
    expect(depositCall(rebuilt.envelope).authorization.equals(call.authorization)).toBe(
      true,
    );
    expect(
      depositCall(changedAmount.envelope).authorization.equals(call.authorization),
    ).toBe(false);
    expect(signatureVerifies(placed.envelope)).toBe(true);

    const profile = readRelayTransactSupportedProfile(placed.relay);
    expect(profile.publicLegContext.publicDepositAmount).toBe('0');
    expect(profile.publicLegContext.publicWithdrawalAmount).toBe(
      PLACED_AMOUNT.toString(),
    );
    expect(profile.publicLegContext.withdrawAddressHi).toBe(
      addressField(CHAIN_INDEX_0_ACCOUNT, 0),
    );
    expect(profile.publicLegContext.withdrawAddressLo).toBe(
      addressField(CHAIN_INDEX_0_ACCOUNT, 16),
    );
    expect(placed.relay.proofBytes).toBe(PROOF.toString('hex'));
  });

  it('submits one relay-signed placement that creates the G and deposits', async () => {
    const unsigned = await placementTransaction(placementInput(PROOF, 9));
    const transaction = TransactionBuilder.fromXDR(unsigned.envelope, NETWORK);
    expect(transaction.sequence).toBe('43');
    expect(transaction.signatures).toHaveLength(0);
    expect(transaction.operations.map((operation) => operation.type)).toEqual([
      'createAccount',
      'invokeHostFunction',
    ]);
    expect(createdAccount(unsigned.envelope)).toEqual({
      destination: CHAIN_INDEX_0_ACCOUNT,
      startingBalance: '1.0000000',
    });
    expect(transferCall(unsigned.envelope)).toEqual({
      contract: RESERVE_ADDRESS,
      functionName: 'transfer',
      from: CHAIN_INDEX_0_ACCOUNT,
      to: ADAPTER,
      amount: '10',
    });

    const relayKyt = Buffer.alloc(64, 9);
    const signed = signRelayPlacement({
      envelope: unsigned.envelope,
      relaySecret: RELAY_SECRET,
      sourceSequence: '100',
      networkPassphrase: NETWORK,
      kytExpirationLedger: 77,
      kytSignature: relayKyt,
    });
    const submitted = TransactionBuilder.fromXDR(signed, NETWORK);
    const signature = submitted.signatures[0]?.signature();
    expect(submitted.sequence).toBe('101');
    expect(submitted.source).toBe(RELAY_ACCOUNT);
    expect(signature).toBeTruthy();
    expect(
      Keypair.fromSecret(RELAY_SECRET).verify(
        submitted.hash(),
        signature ?? Buffer.alloc(0),
      ),
    ).toBe(true);
    const call = depositCall(signed);
    expect(call.functionName).toBe('deposit');
    expect(call.hostFunction.includes(relayKyt)).toBe(true);
    expect(call.authorization.includes(relayKyt)).toBe(false);
    expect(
      call.authorization.equals(depositCall(unsigned.envelope).authorization),
    ).toBe(true);
    expect(call.hostFunction.includes(PROOF)).toBe(true);
    expect(envelopeBytes(signed).includes(rawPublicKey(WALLET_ACCOUNT))).toBe(false);
  });
});

function field(value: number): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes[31] = value;
  return bytes;
}

function utf8(value: string): Buffer {
  return Buffer.from(value, 'utf8');
}

function placementInput(proof: Buffer, stateRoot: number) {
  return {
    spendScalar: SPEND_SCALAR,
    blendPoolContractId: BLEND_POOL,
    tokenContractId: TOKEN,
    publicSignals: publicSignals({ stateRoot, amount: PLACED_AMOUNT }),
    ciphertext: CIPHERTEXT,
    proof,
    amount: PLACED_AMOUNT,
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
    recordedShares: 42n,
    exchangeRate: 2_000_000_000_000n,
    sourceSequence: RELAY_ACCOUNT_SEQUENCE,
    chainIndex: 0,
  };
}

function publicSignals(input: { stateRoot: number; amount: bigint }): string {
  const body = Buffer.alloc(4 + SIGNAL_COUNT * 32);
  body.writeUInt32BE(SIGNAL_COUNT, 0);
  writeField(body, STATE_ROOT_INDEX, field(input.stateRoot));
  writeField(
    body,
    WITHDRAW_ADDRESS_HI_INDEX,
    Buffer.from(addressField(CHAIN_INDEX_0_ACCOUNT, 0), 'hex'),
  );
  writeField(
    body,
    WITHDRAW_ADDRESS_LO_INDEX,
    Buffer.from(addressField(CHAIN_INDEX_0_ACCOUNT, 16), 'hex'),
  );
  writeField(body, PUBLIC_WITHDRAWAL_INDEX, amountField(input.amount));
  writeField(body, PUBLIC_DEPOSIT_INDEX, amountField(0n));
  return body.toString('hex');
}

function writeField(body: Buffer, index: number, value: Uint8Array): void {
  body.set(value, 4 + index * 32);
}

function amountField(amount: bigint): Buffer {
  const fieldBytes = Buffer.alloc(32);
  fieldBytes.writeBigUInt64BE(amount, 24);
  return fieldBytes;
}

function addressField(account: string, offset: number): string {
  const raw = rawPublicKey(account);
  return `${'00'.repeat(16)}${raw.subarray(offset, offset + 16).toString('hex')}`;
}

function rawPublicKey(account: string): Buffer {
  return Keypair.fromPublicKey(account).rawPublicKey();
}

function envelopeBytes(envelope: string): Buffer {
  return Buffer.from(envelope, 'base64');
}

function createdAccount(envelope: string): {
  destination: string;
  startingBalance: string;
} {
  const transaction = TransactionBuilder.fromXDR(envelope, NETWORK);
  const operation = transaction.operations.find(
    (item) => item.type === 'createAccount',
  );
  if (!operation || operation.type !== 'createAccount') {
    throw new Error('Placement envelope does not create the G account');
  }
  return {
    destination: operation.destination,
    startingBalance: operation.startingBalance,
  };
}

function transferCall(envelope: string): {
  contract: string;
  functionName: string;
  from: string;
  to: string;
  amount: string;
} {
  const invocation = depositEntry(envelope).rootInvocation().subInvocations()[0];
  if (!invocation) {
    throw new Error('Placement authorization has no transfer');
  }
  const invoked = invocation.function().contractFn();
  const args = invoked.args();
  return {
    contract: Address.fromScAddress(invoked.contractAddress()).toString(),
    functionName: invoked.functionName().toString(),
    from: Address.fromScVal(args[0]!).toString(),
    to: Address.fromScVal(args[1]!).toString(),
    amount: args[2]!.i128().lo().toString(),
  };
}

function depositEntry(envelope: string): xdr.SorobanAuthorizationEntry {
  const transaction = TransactionBuilder.fromXDR(envelope, NETWORK);
  const operation = transaction.operations.find(
    (item) => item.type === 'invokeHostFunction',
  ) as { auth?: xdr.SorobanAuthorizationEntry[] } | undefined;
  const entry = operation?.auth?.[0];
  if (!entry) {
    throw new Error('Placement envelope has no authorization');
  }
  return entry;
}

function envelopeSource(envelope: string): string {
  return TransactionBuilder.fromXDR(envelope, NETWORK).source;
}

function depositCall(envelope: string): {
  contract: string;
  functionName: string;
  hostFunction: Buffer;
  authorization: Buffer;
} {
  const transaction = TransactionBuilder.fromXDR(envelope, NETWORK);
  const operation = transaction.operations.find(
    (item) => item.type === 'invokeHostFunction',
  ) as {
    type: string;
    func: xdr.HostFunction;
    auth: xdr.SorobanAuthorizationEntry[];
  };
  const invoked = operation.func.invokeContract();
  const authorization = operation.auth[0]?.rootInvocation().toXDR();
  if (!authorization) {
    throw new Error('Placement envelope has no authorization');
  }
  return {
    contract: Address.fromScAddress(invoked.contractAddress()).toString(),
    functionName: invoked.functionName().toString(),
    hostFunction: operation.func.toXDR(),
    authorization,
  };
}

function signatureVerifies(envelope: string): boolean {
  const transaction = TransactionBuilder.fromXDR(envelope, NETWORK);
  const operation = transaction.operations.find(
    (item) => item.type === 'invokeHostFunction',
  ) as {
    auth: xdr.SorobanAuthorizationEntry[];
  };
  const entry = operation.auth[0];
  if (!entry) {
    return false;
  }
  const preimage = buildAuthorizationEntryPreimage(entry, EXPIRATION_LEDGER, NETWORK);
  const payload = hash(preimage.toXDR());
  return Keypair.fromPublicKey(CHAIN_INDEX_0_ACCOUNT).verify(
    payload,
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
