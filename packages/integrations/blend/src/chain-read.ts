import {
  Address,
  Contract,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { underlyingFromShares } from './underlying.js';

const SIMULATION_FEE = '100';
const SIMULATION_TIMEOUT_SECONDS = 30;

export async function readRelayClock(input: {
  sorobanRpcUrl: string;
  sourceAccount: string;
}): Promise<{ ledger: number; sourceSequence: string }> {
  const server = relayServer(input.sorobanRpcUrl);
  const [latest, account] = await Promise.all([
    server.getLatestLedger(),
    server.getAccount(input.sourceAccount),
  ]);
  return {
    ledger: latest.sequence,
    sourceSequence: account.sequenceNumber(),
  };
}

export async function readInterestDepositUnderlying(input: {
  sorobanRpcUrl: string;
  networkPassphrase: string;
  sourceAccount: string;
  adapterContractId: string;
  position: string;
  blendPool: string;
  reserve: string;
}): Promise<bigint> {
  const shares = await readPositionShares(input);
  const rate = await readReserveExchangeRate(input);
  return underlyingFromShares(shares, rate);
}

export async function readPositionRecorded(input: PositionRead): Promise<boolean> {
  const recorded = await simulateMethod({
    ...input,
    contractId: input.adapterContractId,
    method: 'recorded',
    args: addressArguments([input.position, input.blendPool, input.reserve]),
  });
  return recorded === true;
}

export async function readPositionShares(input: PositionRead): Promise<bigint> {
  return asBigint(
    await simulateMethod({
      ...input,
      contractId: input.adapterContractId,
      method: 'shares',
      args: addressArguments([input.position, input.blendPool, input.reserve]),
    }),
  );
}

export async function readReserveExchangeRate(input: {
  sorobanRpcUrl: string;
  networkPassphrase: string;
  sourceAccount: string;
  blendPool: string;
  reserve: string;
}): Promise<bigint> {
  const reserveState = await simulateMethod({
    ...input,
    contractId: input.blendPool,
    method: 'get_reserve',
    args: addressArguments([input.reserve]),
  });
  return exchangeRate(reserveState);
}

type PositionRead = {
  sorobanRpcUrl: string;
  networkPassphrase: string;
  sourceAccount: string;
  adapterContractId: string;
  position: string;
  blendPool: string;
  reserve: string;
};

function relayServer(sorobanRpcUrl: string): rpc.Server {
  return new rpc.Server(sorobanRpcUrl, {
    allowHttp: sorobanRpcUrl.startsWith('http://'),
  });
}

async function simulateMethod(input: {
  sorobanRpcUrl: string;
  networkPassphrase: string;
  sourceAccount: string;
  contractId: string;
  method: string;
  args: xdr.ScVal[];
}): Promise<unknown> {
  const server = relayServer(input.sorobanRpcUrl);
  const account = await server.getAccount(input.sourceAccount);
  const built = new TransactionBuilder(account, {
    fee: SIMULATION_FEE,
    networkPassphrase: input.networkPassphrase,
  })
    .addOperation(new Contract(input.contractId).call(input.method, ...input.args))
    .setTimeout(SIMULATION_TIMEOUT_SECONDS)
    .build();
  const simulated = await server.simulateTransaction(built);
  if (rpc.Api.isSimulationError(simulated) || !simulated.result?.retval) {
    throw new Error('Blend placement could not be read back.');
  }
  return scValToNative(simulated.result.retval);
}

function addressArguments(addresses: string[]): xdr.ScVal[] {
  return addresses.map((address) => new Address(address).toScVal());
}

function exchangeRate(value: unknown): bigint {
  if (!isRecord(value) || !isRecord(value.data)) {
    throw new Error('Blend reserve did not return an exchange rate.');
  }
  return asBigint(value.data.b_rate);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asBigint(value: unknown): bigint {
  if (
    typeof value === 'bigint' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return BigInt(value);
  }
  throw new Error('Blend placement could not be read back.');
}
