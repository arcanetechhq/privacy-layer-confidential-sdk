import {
  Account,
  Contract,
  Keypair,
  TransactionBuilder,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';

export interface StellarPoolNetwork {
  readonly rpcUrl: string;
  readonly networkPassphrase: string;
  readonly poolContract: string;
}

export function sorobanServer(rpcUrl: string): rpc.Server {
  return new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
}

export async function simulateView(input: {
  readonly server: rpc.Server;
  readonly networkPassphrase: string;
  readonly contractId: string;
  readonly method: string;
  readonly args?: readonly xdr.ScVal[];
}): Promise<xdr.ScVal> {
  const source = new Account(Keypair.random().publicKey(), '0');
  const transaction = new TransactionBuilder(source, {
    fee: '100',
    networkPassphrase: input.networkPassphrase,
  })
    .addOperation(
      new Contract(input.contractId).call(input.method, ...(input.args ?? [])),
    )
    .setTimeout(30)
    .build();
  const simulated = await input.server.simulateTransaction(transaction);
  if (rpc.Api.isSimulationError(simulated) || simulated.result === undefined) {
    throw new Error(`Contract ${input.method} simulation failed`);
  }
  return simulated.result.retval;
}

export function bytesValue(value: xdr.ScVal, what: string): Buffer {
  if (value.switch() !== xdr.ScValType.scvBytes()) {
    throw new Error(`${what} did not return bytes`);
  }
  return Buffer.from(value.bytes());
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
