import type {
  DepositIntent,
  NetworkAdapter,
  WithdrawIntent,
} from '@arcanetech/privacy-sdk-core';
import { submitPreparedOperation } from '../transact/engine/execution/submit-prepared.js';
import type {
  StellarAddress,
  StellarAssetId,
  StellarOperationReceipt,
  StellarPoolMerkleState,
  StellarPreparedOperation,
  StellarPrivateRecord,
  StellarStorageAdapter,
  StellarTransactEngine,
  StellarTransferFromAddress,
  StellarTransferIntent,
  StellarWalletAdapter,
} from '../types.js';
import {
  buildSpendOutputRecords,
  selectPrivateRecords,
  sumRecordAmounts,
} from './record-selection.js';
import { preparePublicWithdraw } from './public-withdraw-prepare.js';
import { prepareTransferOperation } from './transfer-prepare.js';

type StellarIntent =
  | DepositIntent<StellarAddress, StellarAssetId, bigint>
  | StellarTransferIntent
  | WithdrawIntent<StellarAddress, StellarAssetId, bigint>;

export function createStellarNetworkAdapter(deps: {
  storage: StellarStorageAdapter;
  wallet: StellarWalletAdapter;
  engine: StellarTransactEngine;
  poolContract: string;
  getPoolMerkleState: (
    poolContract: string,
  ) => Promise<StellarPoolMerkleState | undefined>;
  checkNullifierSpent?: (input: {
    nullifier: string;
    walletPublicKey: string;
  }) => Promise<boolean>;
}): NetworkAdapter<
  StellarAddress,
  StellarAssetId,
  bigint,
  StellarPreparedOperation,
  StellarOperationReceipt
> {
  return {
    prepareDeposit: async (intent) =>
      prepareOperation({ kind: 'deposit', intent, ...deps }),
    prepareTransfer: async (intent) => prepareTransferOperation(intent, deps),
    prepareWithdraw: async (intent) =>
      prepareOperation({ kind: 'withdraw', intent, ...deps }),
    preparePublicWithdraw: async (intent) => preparePublicWithdraw(intent, deps),
    submit: async (prepared, options) => {
      const submissionInput = {
        prepared,
        storage: deps.storage,
        wallet: deps.wallet,
        engine: deps.engine,
      };
      if (options !== undefined) {
        return submitPreparedOperation({ ...submissionInput, options });
      }
      return submitPreparedOperation(submissionInput);
    },
  };
}

async function loadSpendSelectionWalletPublicKey(
  wallet: StellarWalletAdapter,
): Promise<string> {
  const walletAddress = await wallet.getAddress();
  return walletAddress.trim();
}

async function prepareWithdrawRecords(input: {
  storage: StellarStorageAdapter;
  intent: WithdrawIntent<StellarAddress, StellarAssetId, bigint>;
  walletPublicKey: string;
  checkNullifierSpent?: (parameters: {
    nullifier: string;
    walletPublicKey: string;
  }) => Promise<boolean>;
}): Promise<StellarPrivateRecord[]> {
  return selectPrivateRecords({
    storage: input.storage,
    kind: 'withdraw',
    intent: input.intent,
    walletPublicKey: input.walletPublicKey,
    ...(input.checkNullifierSpent
      ? { checkNullifierSpent: input.checkNullifierSpent }
      : {}),
  });
}

async function resolvePrepareConsumedRecords(input: {
  kind: 'deposit' | 'withdraw';
  intent: StellarIntent;
  storage: StellarStorageAdapter;
  wallet: StellarWalletAdapter;
  checkNullifierSpent?: (parameters: {
    nullifier: string;
    walletPublicKey: string;
  }) => Promise<boolean>;
}): Promise<StellarPrivateRecord[]> {
  if (input.kind === 'deposit') {
    return [];
  }
  return prepareWithdrawRecords({
    storage: input.storage,
    intent: input.intent as WithdrawIntent<StellarAddress, StellarAssetId, bigint>,
    walletPublicKey: await loadSpendSelectionWalletPublicKey(input.wallet),
    ...(input.checkNullifierSpent
      ? { checkNullifierSpent: input.checkNullifierSpent }
      : {}),
  });
}

function buildDepositOrWithdrawPrepared(input: {
  kind: 'deposit' | 'withdraw';
  intent: StellarIntent;
  consumedRecords: StellarPrivateRecord[];
  walletPublicKey: StellarAddress;
}): StellarPreparedOperation {
  const consumedTotal = sumRecordAmounts(input.consumedRecords);
  const withdrawIntent = input.intent as WithdrawIntent<
    StellarAddress,
    StellarAssetId,
    bigint
  >;
  return {
    kind: input.kind,
    intent: input.intent,
    consumedRecords: input.consumedRecords,
    outputRecords: buildSpendOutputRecords({
      kind: input.kind,
      from: withdrawIntent.from as StellarTransferFromAddress,
      to: input.intent.to,
      asset: input.intent.asset,
      amount: input.intent.amount,
      consumedTotal,
      recipientDisclosedPublicly:
        input.kind === 'withdraw' &&
        withdrawIntent.disclosure.recipientAddress === 'public',
      walletPublicKey: input.walletPublicKey,
    }),
    submissionPayload: {
      operationId: crypto.randomUUID(),
      signed: false,
    },
  };
}

async function prepareOperation(input: {
  kind: 'deposit' | 'withdraw';
  intent: StellarIntent;
  storage: StellarStorageAdapter;
  engine: StellarTransactEngine;
  wallet: StellarWalletAdapter;
  checkNullifierSpent?: (parameters: {
    nullifier: string;
    walletPublicKey: string;
  }) => Promise<boolean>;
}): Promise<StellarPreparedOperation> {
  const consumedRecords = await resolvePrepareConsumedRecords(input);
  const walletPublicKey =
    input.kind === 'deposit'
      ? (input.intent.from as StellarAddress)
      : await loadSpendSelectionWalletPublicKey(input.wallet);
  const prepared = buildDepositOrWithdrawPrepared({
    kind: input.kind,
    intent: input.intent,
    consumedRecords,
    walletPublicKey,
  });
  return input.engine.prepare(prepared);
}
