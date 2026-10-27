import type { ExecuteOptions } from '@arcanetech/privacy-sdk-core';
import {
  assertNotAborted,
  createOperationEventId,
  emitOperationEvent,
  executionError,
  isPrivacySdkError,
  measureStage,
  userRejectedError,
} from '@arcanetech/privacy-sdk-core';
import type {
  StellarOperationReceipt,
  StellarPreparedOperation,
  StellarStorageAdapter,
  StellarSubmissionPayload,
  StellarTransactEngine,
  StellarWalletAdapter,
} from '../../../types.js';

const PRE_SUBMISSION_STAGES = [
  'validation',
  'stateRead',
  'authorization',
  'preparation',
  'policyCheck',
] as const;

interface SubmitPreparedOperationInput {
  prepared: StellarPreparedOperation;
  storage: StellarStorageAdapter;
  wallet: StellarWalletAdapter;
  engine: StellarTransactEngine;
  options?: ExecuteOptions;
}

export async function submitPreparedOperation(
  input: SubmitPreparedOperationInput,
): Promise<StellarOperationReceipt> {
  const eventId = createOperationEventId();

  try {
    emitPreSubmissionStages(input.options, eventId);
    const receipt = await measureStage('submit', async () => {
      const signedPayload = await signSubmissionPayload(input.wallet, input.prepared);
      return submitAndConfirm(input, eventId, signedPayload);
    });
    try {
      await commitStorageChanges(input, eventId, receipt);
    } catch (error) {
      handleStorageCommitFailure(error, input.options, eventId, receipt);
    }
    return receipt;
  } catch (error) {
    handleSubmissionFailure(error, input.options, eventId);
  }
}

function emitPreSubmissionStages(
  options: ExecuteOptions | undefined,
  eventId: string,
): void {
  for (const stage of PRE_SUBMISSION_STAGES) {
    assertNotAborted(options?.signal);
    emitOperationEvent(options, { id: eventId, stage, status: 'begin' });
    emitOperationEvent(options, { id: eventId, stage, status: 'end' });
  }
}

async function signSubmissionPayload(
  wallet: StellarWalletAdapter,
  prepared: StellarPreparedOperation,
): Promise<StellarSubmissionPayload> {
  try {
    return await measureStage('sign', () =>
      wallet.signTransactionPayload(prepared.submissionPayload),
    );
  } catch (error) {
    throw userRejectedError(
      error instanceof Error ? error.message : 'Wallet rejected the transaction.',
    );
  }
}

async function submitAndConfirm(
  input: SubmitPreparedOperationInput,
  eventId: string,
  signedPayload: StellarSubmissionPayload,
): Promise<StellarOperationReceipt> {
  assertNotAborted(input.options?.signal);
  emitOperationEvent(input.options, {
    id: eventId,
    stage: 'submission',
    status: 'begin',
  });

  const receipt = await input.engine.submit(input.prepared, signedPayload);
  emitOperationEvent(input.options, {
    id: eventId,
    stage: 'submission',
    status: 'end',
  });
  emitOperationEvent(input.options, {
    id: eventId,
    stage: 'confirmation',
    status: 'begin',
  });
  emitOperationEvent(input.options, {
    id: eventId,
    stage: 'confirmation',
    status: 'end',
  });
  return receipt;
}

async function commitStorageChanges(
  input: SubmitPreparedOperationInput,
  eventId: string,
  receipt: StellarOperationReceipt,
): Promise<void> {
  emitOperationEvent(input.options, {
    id: eventId,
    stage: 'storageCommit',
    status: 'begin',
  });
  if (input.prepared.outputRecords.length > 0) {
    await input.storage.savePrivateRecords(
      input.prepared.outputRecords.map((record) => {
        const nextStatus = receipt.confirmed ? 'finalized' : record.status;
        return {
          ...record,
          txHash: receipt.operationId,
          ...(nextStatus === undefined ? {} : { status: nextStatus }),
        };
      }),
    );
  }
  if (input.prepared.consumedRecords.length > 0) {
    await input.storage.markPrivateRecordsUsed(input.prepared.consumedRecords);
  }
  emitOperationEvent(input.options, {
    id: eventId,
    stage: 'storageCommit',
    status: 'end',
  });
}

function toSubmissionError(error: unknown) {
  if (isPrivacySdkError(error)) {
    return error;
  }
  const message = error instanceof Error ? error.message : 'Execution failed.';
  return executionError(message, 'submission');
}

function storageCommitFailureMessage(error: unknown): string {
  if (isPrivacySdkError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Storage commit failed.';
}

function handleStorageCommitFailure(
  error: unknown,
  options: ExecuteOptions | undefined,
  eventId: string,
  receipt: StellarOperationReceipt,
): never {
  const sdkError = executionError(storageCommitFailureMessage(error), 'storageCommit', {
    receipt,
  });
  emitOperationEvent(options, {
    id: eventId,
    stage: 'storageCommit',
    status: 'error',
    error: sdkError,
  });
  throw sdkError;
}

function handleSubmissionFailure(
  error: unknown,
  options: ExecuteOptions | undefined,
  eventId: string,
): never {
  const sdkError = toSubmissionError(error);
  emitOperationEvent(options, {
    id: eventId,
    stage: 'submission',
    status: 'error',
    error: sdkError,
  });
  throw sdkError;
}
