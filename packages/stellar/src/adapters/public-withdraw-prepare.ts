import type { PublicWithdrawIntent } from '@arcanetech/privacy-sdk-core';
import { insufficientStateError } from '@arcanetech/privacy-sdk-core';
import type {
  StellarAddress,
  StellarAssetId,
  StellarPoolMerkleState,
  StellarPreparedOperation,
  StellarStorageAdapter,
  StellarTransactEngine,
} from '../types.js';
import { findCommitmentLeafIndex } from '../transact/public-withdraw/field-element.js';
import { selectPublicWithdrawNote } from '../transact/public-withdraw/select-note.js';
import { buildPublicOutputSubmission } from '../transact/public-withdraw/submission.js';

export async function preparePublicWithdraw(
  intent: PublicWithdrawIntent<StellarAddress, StellarAssetId, bigint>,
  deps: {
    storage: StellarStorageAdapter;
    engine: StellarTransactEngine;
    poolContract: string;
    getPoolMerkleState: (
      poolContract: string,
    ) => Promise<StellarPoolMerkleState | undefined>;
  },
): Promise<StellarPreparedOperation> {
  const records = await deps.storage.listPrivateRecords({
    privateAddress: intent.from,
    asset: intent.asset,
  });
  const noteId = readPublicWithdrawNoteId(intent);
  const record = selectPublicWithdrawNote({
    records,
    asset: intent.asset,
    amount: intent.amount,
    ...(noteId === undefined ? {} : { noteId }),
  });
  const merkle = await deps.getPoolMerkleState(deps.poolContract);
  const leafIndex = requirePublicWithdrawLeafIndex(
    record.coinNote?.commitment,
    merkle?.commitments ?? [],
  );
  return deps.engine.prepare({
    kind: 'publicWithdraw',
    intent,
    consumedRecords: [record],
    outputRecords: [],
    submissionPayload: {
      operationId: crypto.randomUUID(),
      signed: false,
    },
    publicOutput: buildPublicOutputSubmission({
      record,
      leafIndex,
      to: intent.to,
    }),
  });
}

function requirePublicWithdrawLeafIndex(
  commitment: string | undefined,
  commitments: readonly string[],
): number {
  const leafIndex =
    commitment === undefined
      ? undefined
      : findCommitmentLeafIndex(commitments, commitment);
  if (leafIndex === undefined) {
    throw insufficientStateError(
      'missing_merkle_leaf',
      'Synced pool state does not contain this note.',
    );
  }
  return leafIndex;
}

function readPublicWithdrawNoteId(
  intent: PublicWithdrawIntent<StellarAddress, StellarAssetId, bigint>,
): string | undefined {
  if (!Object.hasOwn(intent, 'noteId')) {
    return undefined;
  }
  const noteId = (intent as { noteId?: unknown }).noteId;
  if (typeof noteId !== 'string') {
    return undefined;
  }
  const trimmed = noteId.trim();
  return trimmed === '' ? undefined : trimmed;
}
