import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CoinData,
  DepositObject,
  DepositSlot,
} from '@arcanetech/stellar-privacy-pool-zk-sdk';
import {
  BINDING_ZK_NONCE,
  SIX_BY_SIX_BINDING_ZK_NONCE,
  configurePrivacyPoolService,
  prepareRelayTransactPackage,
  type PrivacyPoolService,
} from '../src/transact/index.js';
import { buildRecipientAndOptionalChangeDeposits } from '../src/transact/proofs/confidential/recipient-change-deposits.js';
import type { AlignedDepositSlot } from '../src/transact/pool/proof-types.js';
import { appendFeeOutputSlot } from '../src/transact/fees/append-fee-output.js';
import { quoteRequiredFee } from '../src/transact/fees/quote-required-fee.js';
import { shouldAttachFeeOutput } from '../src/transact/fees/should-attach-fee-output.js';
import { zkConfigNonceForFeeBearingKind } from '../src/transact/fees/zk-config-nonce-for-kind.js';
import { withdrawDepositsWithFee } from '../src/transact/proofs/withdraw/fee-deposits.js';
import type { StellarTransactEnvironment } from '../src/transact/environment/types.js';

const SENDER_STPL1 = 'stpl1sendersregisteredaddress';
const RECIPIENT_STPL1 = 'stpl1bobregisteredaddress';
const COLLECTOR_STPL1 = 'stpl1feecollectorprivateaddress';
const TOKEN = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const APPLICATION_ID = '101';
const FEE_RATE = '0.01';
const DEPOSIT_INSTRUCTED = 1_000_000_000n;
const DEPOSIT_FEE = 10_000_000n;
const TRANSFER_INSTRUCTED = 400_000_000n;
const TRANSFER_FEE = 4_000_000n;
const NOTE_AFTER_DEPOSIT = 990_000_000n;
const TRANSFER_CHANGE = 586_000_000n;
const WITHDRAW_FEE = 2_000_000n;
const WITHDRAW_CHANGE = 384_000_000n;
const FIELD_BYTES = 32;
const BINDING_SIGNAL_COUNT = 30;
const SIX_BY_SIX_BINDING_SIGNAL_COUNT = 58;

type DepositCall = {
  privateAddressStpl1: string;
  amountStroops: bigint;
  tokenAddress: string;
};

const depositCalls: DepositCall[] = [];

function slotFromCall(input: DepositCall): AlignedDepositSlot {
  const deposit: DepositObject = {
    value: input.amountStroops.toString(),
    nullifier: 'n',
    ephemeralKeyScalar: '1',
    asset: ['0', '0'],
    applicationId: APPLICATION_ID,
    recipientPublicKeys: ['11', '22'],
  };
  const coin: CoinData = {
    value: input.amountStroops.toString(),
    nullifier: 'n',
    secret: `spend:${input.privateAddressStpl1}`,
    commitment: 'c',
    asset_hi: '0',
    asset_lo: '0',
  };
  return {
    deposit,
    commitment_hex: `cc:${input.privateAddressStpl1}:${input.amountStroops.toString()}`,
    coin,
    depositScalarHex: 'aa',
    precommitementHex: 'bb',
  };
}

function installRecordingPoolService(): void {
  depositCalls.length = 0;
  configurePrivacyPoolService({
    buildAlignedDepositSlot: async (input: DepositCall) => {
      depositCalls.push(input);
      return slotFromCall(input);
    },
  } as unknown as PrivacyPoolService);
}

function liveDepositValue(slot: DepositSlot | undefined): string | undefined {
  if (slot === undefined || slot === 'dummy') {
    return undefined;
  }
  return slot.value;
}

function transactEnvironment(): StellarTransactEnvironment {
  return {
    network: {
      id: 'stellar-testnet',
      rpcUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015',
      poolContract: TOKEN,
      registryContract: TOKEN,
      applicationId: APPLICATION_ID,
    },
    kyt: {
      apiBaseUrl: 'http://transfers.test/api',
      kytPassageRegistryContract: TOKEN,
    },
  };
}

afterEach(() => {
  depositCalls.length = 0;
  vi.unstubAllGlobals();
});

describe('Fee Quote Request', () => {
  it('returns Required Fee, Fee Asset, collector Private Address and Fee Rate without secrets', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
        Response.json(
          {
            requiredFee: DEPOSIT_FEE.toString(),
            feeAsset: TOKEN,
            feeCollectorPrivateAddress: COLLECTOR_STPL1,
            feeRate: FEE_RATE,
          },
          { status: 201, headers: { 'content-type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const quote = await quoteRequiredFee({
      transactEnvironment: transactEnvironment(),
      request: {
        feeAsset: TOKEN,
        publicDepositAmount: DEPOSIT_INSTRUCTED.toString(),
        spendsNotes: false,
      },
    });

    expect(quote).toEqual({
      requiredFee: DEPOSIT_FEE,
      feeAsset: TOKEN,
      feeCollectorPrivateAddress: COLLECTOR_STPL1,
      feeRate: FEE_RATE,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const quoteCall = fetchMock.mock.calls[0];
    if (quoteCall === undefined) {
      throw new Error('expected a Fee Quote request');
    }
    const [url, init] = quoteCall;
    expect(String(url)).toBe('http://transfers.test/api/kyt/fees/quote');
    const body = JSON.parse(String((init as RequestInit | undefined)?.body)) as Record<
      string,
      unknown
    >;
    expect(body).toEqual({
      feeAsset: TOKEN,
      publicDepositAmount: DEPOSIT_INSTRUCTED.toString(),
      spendsNotes: false,
    });
    expect(body).not.toHaveProperty('secret');
    expect(body).not.toHaveProperty('notes');
  });
});

describe('Fee Output prepare', () => {
  it('keeps deposit and withdraw on 2x2 and transfer with change on 6x6', () => {
    expect(zkConfigNonceForFeeBearingKind({ kind: 'deposit' })).toBe(BINDING_ZK_NONCE);
    expect(zkConfigNonceForFeeBearingKind({ kind: 'withdraw' })).toBe(BINDING_ZK_NONCE);
    expect(zkConfigNonceForFeeBearingKind({ kind: 'transfer' })).toBe(
      SIX_BY_SIX_BINDING_ZK_NONCE,
    );
    expect(
      zkConfigNonceForFeeBearingKind({ kind: 'transfer', spendSource: 'escrow' }),
    ).toBe(BINDING_ZK_NONCE);
    expect(
      zkConfigNonceForFeeBearingKind({
        kind: 'transfer',
        spendSource: 'escrow',
        escrowSend: true,
      }),
    ).toBe(SIX_BY_SIX_BINDING_ZK_NONCE);
  });

  it('uses the configured 6x6 nonce when the pool only registered that shape', () => {
    expect(
      zkConfigNonceForFeeBearingKind({
        kind: 'deposit',
        configuredNonce: SIX_BY_SIX_BINDING_ZK_NONCE,
      }),
    ).toBe(SIX_BY_SIX_BINDING_ZK_NONCE);
    expect(
      zkConfigNonceForFeeBearingKind({
        kind: 'withdraw',
        configuredNonce: SIX_BY_SIX_BINDING_ZK_NONCE,
      }),
    ).toBe(SIX_BY_SIX_BINDING_ZK_NONCE);
    expect(
      zkConfigNonceForFeeBearingKind({
        kind: 'transfer',
        spendSource: 'escrow',
        configuredNonce: SIX_BY_SIX_BINDING_ZK_NONCE,
      }),
    ).toBe(SIX_BY_SIX_BINDING_ZK_NONCE);
  });

  it('proves a transfer with recipient, change and Fee Output', async () => {
    installRecordingPoolService();
    const built = await buildRecipientAndOptionalChangeDeposits({
      recipientPrivateAddressStpl1: RECIPIENT_STPL1,
      transferStroops: TRANSFER_INSTRUCTED,
      changeStroops: TRANSFER_CHANGE,
      selfPrivateAddressStpl1ForChange: SENDER_STPL1,
      tokenAddress: TOKEN,
      feeOutput: {
        requiredFee: TRANSFER_FEE,
        feeCollectorPrivateAddress: COLLECTOR_STPL1,
      },
    });

    expect(built.deposits).toHaveLength(3);
    expect(liveDepositValue(built.deposits[0])).toBe(TRANSFER_INSTRUCTED.toString());
    expect(liveDepositValue(built.deposits[1])).toBe(TRANSFER_CHANGE.toString());
    expect(liveDepositValue(built.deposits[2])).toBe(TRANSFER_FEE.toString());
    expect(built.changeCoin?.coin.value).toBe(TRANSFER_CHANGE.toString());
    expect(built.feeCoin?.coin.secret).toBe(`spend:${COLLECTOR_STPL1}`);
    expect(
      depositCalls.map((call) => ({
        address: call.privateAddressStpl1,
        amount: call.amountStroops,
      })),
    ).toEqual([
      { address: RECIPIENT_STPL1, amount: TRANSFER_INSTRUCTED },
      { address: SENDER_STPL1, amount: TRANSFER_CHANGE },
      { address: COLLECTOR_STPL1, amount: TRANSFER_FEE },
    ]);
  });

  it('attaches a deposit Fee Output beside the user note on 2x2', async () => {
    installRecordingPoolService();
    const userSlot = slotFromCall({
      privateAddressStpl1: SENDER_STPL1,
      amountStroops: NOTE_AFTER_DEPOSIT,
      tokenAddress: TOKEN,
    });
    const withFee = await appendFeeOutputSlot({
      deposits: [userSlot.deposit],
      tokenAddress: TOKEN,
      buildAlignedDepositSlot: async (input) => {
        depositCalls.push(input);
        return slotFromCall(input);
      },
      feeOutput: {
        requiredFee: DEPOSIT_FEE,
        feeCollectorPrivateAddress: COLLECTOR_STPL1,
      },
    });
    expect(withFee.deposits).toHaveLength(2);
    expect(liveDepositValue(withFee.deposits[0])).toBe(NOTE_AFTER_DEPOSIT.toString());
    expect(liveDepositValue(withFee.deposits[1])).toBe(DEPOSIT_FEE.toString());
    expect(withFee.feeCoin?.coin.secret).toBe(`spend:${COLLECTOR_STPL1}`);
  });

  it('attaches withdraw change and Fee Output on 2x2', async () => {
    depositCalls.length = 0;
    const built = await withdrawDepositsWithFee({
      changeStroops: WITHDRAW_CHANGE,
      changePrivateAddressStpl1: SENDER_STPL1,
      buildAlignedDepositSlot: async (input) => {
        depositCalls.push(input);
        return slotFromCall(input);
      },
      tokenAddress: TOKEN,
      feeOutput: {
        requiredFee: WITHDRAW_FEE,
        feeCollectorPrivateAddress: COLLECTOR_STPL1,
      },
    });
    expect(built.deposits).toHaveLength(2);
    expect(liveDepositValue(built.deposits[0])).toBe(WITHDRAW_CHANGE.toString());
    expect(liveDepositValue(built.deposits[1])).toBe(WITHDRAW_FEE.toString());
    expect(built.changeCoin?.coin.value).toBe(WITHDRAW_CHANGE.toString());
    expect(built.feeCoin?.coin.secret).toBe(`spend:${COLLECTOR_STPL1}`);
  });

  it('does not attach a Fee Output to an escrow sweep', async () => {
    installRecordingPoolService();
    expect(shouldAttachFeeOutput({ kind: 'transfer', spendSource: 'escrow' })).toBe(
      false,
    );
    expect(
      shouldAttachFeeOutput({
        kind: 'transfer',
        spendSource: 'escrow',
        escrowSend: true,
      }),
    ).toBe(true);
    const built = await buildRecipientAndOptionalChangeDeposits({
      recipientPrivateAddressStpl1: RECIPIENT_STPL1,
      transferStroops: TRANSFER_INSTRUCTED,
      changeStroops: 0n,
      selfPrivateAddressStpl1ForChange: SENDER_STPL1,
      tokenAddress: TOKEN,
    });
    expect(built.deposits.filter((slot) => slot !== 'dummy')).toHaveLength(1);
    expect(built.feeCoin).toBeUndefined();
    expect(
      depositCalls.some((call) => call.privateAddressStpl1 === COLLECTOR_STPL1),
    ).toBe(false);
  });
});

describe('Relay package Fee Output', () => {
  it('carries the extra Fee Output application-id hint on 6x6', () => {
    const publicSignals = '00'.repeat(SIX_BY_SIX_BINDING_SIGNAL_COUNT * FIELD_BYTES);
    const applicationIdHints = [
      APPLICATION_ID,
      '0',
      '0',
      '0',
      '0',
      '0',
      APPLICATION_ID,
      APPLICATION_ID,
      APPLICATION_ID,
      '0',
      '0',
      '0',
    ];
    const prepared = prepareRelayTransactPackage({
      poolSelector: TOKEN,
      zkConfigNonce: SIX_BY_SIX_BINDING_ZK_NONCE,
      proofBytes: 'aabb',
      publicSignals,
      applicationIdHints,
    });
    expect(prepared.zkConfigNonce).toBe(SIX_BY_SIX_BINDING_ZK_NONCE);
    expect(prepared.applicationIdHints).toEqual(applicationIdHints);
    expect(
      prepared.applicationIdHints.filter((hint) => hint === APPLICATION_ID),
    ).toHaveLength(4);
  });

  it('carries deposit Fee Output on 2x2', () => {
    const publicSignals = '00'.repeat(BINDING_SIGNAL_COUNT * FIELD_BYTES);
    const applicationIdHints = ['0', '0', APPLICATION_ID, APPLICATION_ID];
    const prepared = prepareRelayTransactPackage({
      poolSelector: TOKEN,
      zkConfigNonce: BINDING_ZK_NONCE,
      proofBytes: 'aabb',
      publicSignals,
      applicationIdHints,
    });
    expect(prepared.zkConfigNonce).toBe(BINDING_ZK_NONCE);
    expect(prepared.applicationIdHints).toEqual(applicationIdHints);
  });
});
