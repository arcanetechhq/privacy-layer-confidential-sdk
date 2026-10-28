import {
  Address,
  Keypair,
  TransactionBuilder,
  authorizeEntry,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';
import { delay } from '../../shared/index.js';
import { withWalletSignature } from '../auth/index.js';
import type { PackedTransaction } from '../prepare/index.js';

const CONFIRMATION_TIMEOUT_MS = 90_000;
const CONFIRMATION_POLL_MS = 1000;
const AUTH_EXPIRATION_LEDGERS = 100;

export type SubmitOutcome =
  | { readonly ok: true; readonly transactionId: string }
  | { readonly ok: false; readonly drop: boolean };

export interface SubmitContext {
  readonly server: rpc.Server;
  readonly networkPassphrase: string;
  readonly signer: Keypair;
}

async function serviceSigned(
  context: SubmitContext,
  packed: PackedTransaction,
  entryXdr: string,
): Promise<string> {
  const parsed = xdr.SorobanAuthorizationEntry.fromXDR(entryXdr, 'base64');
  const credentials = parsed.credentials();
  if (credentials.switch() !== xdr.SorobanCredentialsType.sorobanCredentialsAddress()) {
    return entryXdr;
  }
  const signer = Address.fromScAddress(credentials.address().address()).toString();
  if (signer !== context.signer.publicKey()) {
    return entryXdr;
  }
  const expiration = credentials.address().signatureExpirationLedger();
  const signed = await authorizeEntry(
    parsed,
    context.signer,
    expiration > 0 ? expiration : packed.latestLedger + AUTH_EXPIRATION_LEDGERS,
    context.networkPassphrase,
  );
  return signed.toXDR('base64');
}

function signedAuth(
  context: SubmitContext,
  packed: PackedTransaction,
  walletSigned: readonly string[],
): Promise<string[]> {
  return Promise.all(
    packed.auth.map(async (entry, index) => {
      const signedAt = packed.signIndexes.indexOf(index);
      if (signedAt !== -1) {
        return withWalletSignature(entry, walletSigned[signedAt] ?? '');
      }
      return serviceSigned(context, packed, entry);
    }),
  );
}

async function waitForOutcome(
  server: rpc.Server,
  hash: string,
): Promise<SubmitOutcome> {
  const deadline = Date.now() + CONFIRMATION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const status = await server.getTransaction(hash);
    if (status.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { ok: true, transactionId: hash };
    }
    if (status.status === rpc.Api.GetTransactionStatus.FAILED) {
      return { ok: false, drop: true };
    }
    await delay(CONFIRMATION_POLL_MS);
  }
  return { ok: false, drop: false };
}

export async function submitPacked(
  context: SubmitContext,
  packed: PackedTransaction,
  walletSigned: readonly string[],
): Promise<SubmitOutcome> {
  if (walletSigned.length !== packed.signIndexes.length) {
    return { ok: false, drop: true };
  }
  const simulation: rpc.Api.RawSimulateTransactionResponse = {
    id: 'prepared',
    latestLedger: packed.latestLedger,
    events: [],
    transactionData: packed.transactionData,
    minResourceFee: packed.minResourceFee,
    results: [
      { auth: await signedAuth(context, packed, walletSigned), xdr: packed.retval },
    ],
  };
  const transaction = TransactionBuilder.fromXDR(
    packed.txXdr,
    context.networkPassphrase,
  );
  const assembled = rpc.assembleTransaction(transaction, simulation).build();
  assembled.sign(context.signer);
  const sent = await context.server.sendTransaction(assembled);
  if (sent.status === 'ERROR' || sent.hash.length === 0) {
    return { ok: false, drop: true };
  }
  return waitForOutcome(context.server, sent.hash);
}
