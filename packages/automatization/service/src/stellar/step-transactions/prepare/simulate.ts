import { kytAuthorizationScValue } from '@arcanetech/privacy-sdk-stellar/transact';
import {
  Account,
  Address,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';
import { stripHexPrefix, type StellarPoolNetwork } from '../../shared/index.js';
import { signerOf, walletPreimage } from '../auth/index.js';

const TRANSACTION_FEE = '10000000';
const AUTH_EXPIRATION_LEDGERS = 100;

export interface PackedTransaction {
  readonly txXdr: string;
  readonly minResourceFee: string;
  readonly transactionData: string;
  readonly auth: readonly string[];
  readonly signIndexes: readonly number[];
  readonly retval: string;
  readonly latestLedger: number;
}

export interface ProvedTransact {
  readonly from: string;
  readonly proofHex: string;
  readonly publicHex: string;
  readonly ciphertextHex: string;
  readonly kytExpirationLedger: number;
  readonly kytSignature: string;
}

export interface SimulateContext {
  readonly server: rpc.Server;
  readonly network: StellarPoolNetwork;
  readonly serviceAccount: string;
  readonly zkConfigNonce: bigint;
}

function hexBuffer(hex: string): Buffer {
  return Buffer.from(stripHexPrefix(hex), 'hex');
}

function signatureBytes(signature: string): Buffer {
  const clean = signature.trim();
  if (/^(0x)?[\da-f]{128}$/iu.test(clean)) {
    return hexBuffer(clean);
  }
  return Buffer.from(clean, 'base64');
}

async function transactTransaction(context: SimulateContext, proved: ProvedTransact) {
  let source: Account;
  try {
    const loaded = await context.server.getAccount(context.serviceAccount);
    source = new Account(context.serviceAccount, loaded.sequenceNumber());
  } catch {
    throw new Error('Service account is not funded');
  }
  return new TransactionBuilder(source, {
    fee: TRANSACTION_FEE,
    networkPassphrase: context.network.networkPassphrase,
  })
    .addOperation(
      new Contract(context.network.poolContract).call(
        'transact',
        new Address(proved.from).toScVal(),
        nativeToScVal(context.zkConfigNonce, { type: 'u64' }),
        xdr.ScVal.scvBytes(hexBuffer(proved.proofHex)),
        xdr.ScVal.scvBytes(hexBuffer(proved.publicHex)),
        xdr.ScVal.scvBytes(hexBuffer(proved.ciphertextHex)),
        kytAuthorizationScValue({
          expirationLedger: proved.kytExpirationLedger,
          signature: signatureBytes(proved.kytSignature),
        }),
      ),
    )
    .setTimeout(300)
    .build();
}

function externalSigner(from: string, context: SimulateContext): boolean {
  return from !== context.serviceAccount;
}

function stampExpiration(
  entry: xdr.SorobanAuthorizationEntry,
  from: string,
  ledger: number,
): void {
  const credentials = entry.credentials();
  if (
    credentials.switch() === xdr.SorobanCredentialsType.sorobanCredentialsAddress() &&
    Address.fromScAddress(credentials.address().address()).toString() === from &&
    credentials.address().signatureExpirationLedger() === 0
  ) {
    credentials.address().signatureExpirationLedger(ledger);
  }
}

export async function simulateTransact(
  context: SimulateContext,
  proved: ProvedTransact,
): Promise<{
  readonly authEntries: readonly string[];
  readonly packed: PackedTransaction;
}> {
  const transaction = await transactTransaction(context, proved);
  const simulated = await context.server.simulateTransaction(transaction);
  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(simulated.error);
  }
  if (!simulated.result) {
    throw new Error('Pool transact simulation returned no result');
  }
  const external = externalSigner(proved.from, context);
  const auth = simulated.result.auth.map((entry) => {
    if (external) {
      stampExpiration(
        entry,
        proved.from,
        simulated.latestLedger + AUTH_EXPIRATION_LEDGERS,
      );
    }
    return entry.toXDR('base64');
  });
  const signIndexes = auth.flatMap((entry, index) =>
    external && signerOf(entry) === proved.from ? [index] : [],
  );
  return {
    authEntries: signIndexes.map((index) =>
      walletPreimage(auth[index] ?? '', context.network.networkPassphrase),
    ),
    packed: {
      txXdr: transaction.toXDR(),
      minResourceFee: simulated.minResourceFee,
      transactionData: simulated.transactionData.build().toXDR('base64'),
      auth,
      signIndexes,
      retval: simulated.result.retval.toXDR('base64'),
      latestLedger: simulated.latestLedger,
    },
  };
}
