import { Buffer } from 'buffer';
import {
  Account,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';
import {
  commitmentBufferToDecimal,
  fieldElementToBytes,
} from './commitment-decimal.js';
import {
  commitmentBytesFromContractDataValue,
  leafIndexFromContractDataKey,
  treeLeafLedgerKey,
} from './leaf-keys.js';
import type { PoolView } from '../pool-view/index.js';

const LEDGER_BATCH = 100;

export function createSorobanPoolView(options: {
  rpcUrl: string;
  contractId: string;
  networkPassphrase?: string;
}): PoolView {
  const server = new rpc.Server(options.rpcUrl, { allowHttp: true });
  const passphrase = options.networkPassphrase ?? Networks.TESTNET;
  return {
    merkleRoot: () => readRoot(server, options.contractId, passphrase),
    isNullifierConsumed: (nullifierHash) =>
      readNullifier(server, options.contractId, passphrase, nullifierHash),
    commitmentsInTree: () => readTree(server, options.contractId, passphrase),
  };
}

async function readRoot(
  server: rpc.Server,
  contractId: string,
  passphrase: string,
): Promise<string> {
  const value = await simulate({
    server,
    contractId,
    networkPassphrase: passphrase,
    method: 'get_merkle_root',
    args: [],
  });
  return bytesValue(value).toString('hex');
}

async function readNullifier(
  server: rpc.Server,
  contractId: string,
  passphrase: string,
  nullifierHash: string,
): Promise<boolean> {
  const value = await simulate({
    server,
    contractId,
    networkPassphrase: passphrase,
    method: 'is_nulifier_hash_consumed',
    args: [xdr.ScVal.scvBytes(fieldElementToBytes(nullifierHash))],
  });
  if (value.switch() !== xdr.ScValType.scvBool()) {
    throw new Error('Pool nullifier read did not return a boolean');
  }
  return value.b();
}

async function readTree(
  server: rpc.Server,
  contractId: string,
  passphrase: string,
): Promise<string[]> {
  const countValue = await simulate({
    server,
    contractId,
    networkPassphrase: passphrase,
    method: 'get_commitment_count',
    args: [],
  });
  if (countValue.switch() !== xdr.ScValType.scvU32()) {
    throw new Error('Pool commitment count did not return a u32');
  }
  return readCommitments(server, contractId, countValue.u32());
}

async function simulate(input: {
  server: rpc.Server;
  contractId: string;
  networkPassphrase: string;
  method: string;
  args: xdr.ScVal[];
}): Promise<xdr.ScVal> {
  const source = new Account(Keypair.random().publicKey(), '0');
  const transaction = new TransactionBuilder(source, {
    fee: '100',
    networkPassphrase: input.networkPassphrase,
  })
    .addOperation(new Contract(input.contractId).call(input.method, ...input.args))
    .setTimeout(30)
    .build();
  const simulated = await input.server.simulateTransaction(transaction);
  if (rpc.Api.isSimulationError(simulated) || simulated.result === undefined) {
    throw new Error(`Pool ${input.method} simulation failed`);
  }
  return simulated.result.retval;
}

async function readCommitments(
  server: rpc.Server,
  contractId: string,
  count: number,
): Promise<string[]> {
  const byIndex = new Map<number, Buffer>();
  for (let start = 0; start < count; start += LEDGER_BATCH) {
    const end = Math.min(count, start + LEDGER_BATCH);
    const keys = leafKeys(contractId, start, end);
    const response = await server.getLedgerEntries(...keys);
    collectLeafBuffers(response.entries, byIndex);
  }
  return commitmentsInIndexOrder(byIndex, count);
}

function leafKeys(contractId: string, start: number, end: number): xdr.LedgerKey[] {
  const keys: xdr.LedgerKey[] = [];
  for (let index = start; index < end; index += 1) {
    keys.push(treeLeafLedgerKey(contractId, index));
  }
  return keys;
}

function collectLeafBuffers(
  entries: readonly rpc.Api.LedgerEntryResult[],
  byIndex: Map<number, Buffer>,
): void {
  for (const entry of entries) {
    if (entry.val.switch() !== xdr.LedgerEntryType.contractData()) {
      continue;
    }
    const data = entry.val.contractData();
    const leafIndex = leafIndexFromContractDataKey(data.key());
    const bytes = commitmentBytesFromContractDataValue(data.val());
    if (leafIndex === undefined || bytes === undefined) {
      continue;
    }
    byIndex.set(leafIndex, bytes);
  }
}

function commitmentsInIndexOrder(
  byIndex: Map<number, Buffer>,
  count: number,
): string[] {
  const commitments: string[] = [];
  for (let leafIndex = 0; leafIndex < count; leafIndex += 1) {
    const bytes = byIndex.get(leafIndex);
    if (bytes === undefined) {
      throw new Error(`Missing Merkle leaf ${String(leafIndex)} in pool storage.`);
    }
    commitments.push(commitmentBufferToDecimal(bytes));
  }
  return commitments;
}

function bytesValue(value: xdr.ScVal): Buffer {
  if (value.switch() !== xdr.ScValType.scvBytes()) {
    throw new Error('Pool root did not return bytes');
  }
  return Buffer.from(value.bytes());
}
