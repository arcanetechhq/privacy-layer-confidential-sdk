import {
  randomFrDecimal253,
  zeroBindingTagsInPublicSignals,
} from '@arcanetech/stellar-privacy-pool-zk-sdk';
import type { rpc } from '@stellar/stellar-sdk';
import { stripHexPrefix } from '../shared/index.js';
import { kytBaseUrl, kytHeaders, type StellarKytAccess } from './kyt-access.js';

export interface KytInspectRequest {
  readonly server: rpc.Server;
  readonly kyt: StellarKytAccess;
  readonly poolContract: string;
  readonly zkConfigNonce: bigint;
  readonly owner: string;
  readonly proofHex: string;
  readonly publicHex: string;
  readonly ciphertextHex: string;
  readonly outputNoteEphemeralScalars: readonly string[];
  readonly applicationIdHints: readonly string[];
}

export type KytInspectOutcome =
  | {
      readonly approved: true;
      readonly signature: string;
      readonly expiresAtLedger: number;
    }
  | { readonly approved: false; readonly reason: string };

interface KytInspectBody {
  readonly status?: string;
  readonly signature?: string;
  readonly expiresAtLedger?: number;
  readonly reasonCode?: string;
}

async function inspectBody(
  request: KytInspectRequest,
): Promise<{ ok: boolean; status: number; body: KytInspectBody }> {
  const latest = await request.server.getLatestLedger();
  const response = await fetch(`${kytBaseUrl(request.kyt)}/kyt/passages/inspect`, {
    method: 'POST',
    headers: kytHeaders(request.kyt),
    body: JSON.stringify({
      owner: request.owner,
      poolContract: request.poolContract,
      kytRegistry: request.kyt.passageRegistryContract,
      proofBytes: stripHexPrefix(request.proofHex),
      publicSignalsBytes: zeroBindingTagsInPublicSignals(
        request.publicHex,
        request.zkConfigNonce,
      ).toString('hex'),
      applicationIdsPlaintext: request.applicationIdHints,
      ciphertextBytes: stripHexPrefix(request.ciphertextHex),
      outputNoteEphemeralScalars: request.outputNoteEphemeralScalars,
      nonce: randomFrDecimal253(),
      zkConfigNonce: request.zkConfigNonce.toString(),
      currentLedger: latest.sequence,
    }),
  });
  return {
    ok: response.ok,
    status: response.status,
    body: (await response.json()) as KytInspectBody,
  };
}

export async function inspectPassage(
  request: KytInspectRequest,
): Promise<KytInspectOutcome> {
  const { ok, status, body } = await inspectBody(request);
  if (ok && body.status === 'approved' && body.signature && body.expiresAtLedger) {
    return {
      approved: true,
      signature: body.signature,
      expiresAtLedger: body.expiresAtLedger,
    };
  }
  const reason = body.reasonCode ?? body.status ?? `HTTP ${String(status)}`;
  return { approved: false, reason: `KYT refused this transaction: ${reason}` };
}
