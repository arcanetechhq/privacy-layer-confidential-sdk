import { measureStage } from '@arcanetech/privacy-sdk-core';
import { pollPendingOperation } from './poll-pending-operation.js';
import { isTerminalRelayStatus } from './poll-pending-operation.js';
import { toSubmitResult } from './complete-succeeded-operation.js';
import {
  shouldSubmitDirect,
  submitPreparedPrivateOperation,
} from './submit-prepared-private-operation.js';
import {
  PENDING_OPERATION_PHASE,
  type NewPrivateOperation,
  type PendingPrivateOperation,
  type ProtocolRelayPorts,
  type SubmitPrivateOperationResult,
} from './types.js';

export const DEFAULT_SETTLEMENT_POLL_INTERVAL_MS = 2000;
export const DEFAULT_SETTLEMENT_MAX_ATTEMPTS = 15;
const DEFAULT_SETTLEMENT_BACKOFF_MULTIPLIER = 2;
const DEFAULT_SETTLEMENT_MAX_INTERVAL_MS = 30_000;

type SettlementPollBounds = {
  ports: ProtocolRelayPorts;
  walletPublicKey: string;
  operationId: string;
  pollIntervalMs: number;
  maxAttempts: number;
  backoffMultiplier: number;
  maxPollIntervalMs: number;
  delay: (ms: number) => Promise<void>;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isSettled(result: SubmitPrivateOperationResult): boolean {
  return (
    result.outcome === PENDING_OPERATION_PHASE.succeeded ||
    result.outcome === PENDING_OPERATION_PHASE.rejected ||
    result.outcome === PENDING_OPERATION_PHASE.failed ||
    result.outcome === PENDING_OPERATION_PHASE.admissionFailed ||
    result.outcome === PENDING_OPERATION_PHASE.settlementTimedOut ||
    isTerminalRelayStatus(result.operation.relayStatus)
  );
}

function nextPollDelayMs(input: {
  attemptIndex: number;
  pollIntervalMs: number;
  backoffMultiplier: number;
  maxPollIntervalMs: number;
}): number {
  return Math.min(
    input.pollIntervalMs * input.backoffMultiplier ** input.attemptIndex,
    input.maxPollIntervalMs,
  );
}

async function markSettlementTimedOut(input: {
  ports: ProtocolRelayPorts;
  operation: PendingPrivateOperation;
}): Promise<SubmitPrivateOperationResult> {
  const timedOut: PendingPrivateOperation = {
    ...input.operation,
    phase: PENDING_OPERATION_PHASE.settlementTimedOut,
  };
  await input.ports.store.save(timedOut);
  return toSubmitResult(timedOut);
}

async function pollUntilBound(
  input: SettlementPollBounds,
): Promise<SubmitPrivateOperationResult> {
  let result = await pollPendingOperation(input);
  let attemptIndex = 0;
  while (!isSettled(result) && attemptIndex + 1 < input.maxAttempts) {
    await input.delay(
      nextPollDelayMs({
        attemptIndex,
        pollIntervalMs: input.pollIntervalMs,
        backoffMultiplier: input.backoffMultiplier,
        maxPollIntervalMs: input.maxPollIntervalMs,
      }),
    );
    result = await pollPendingOperation(input);
    attemptIndex += 1;
  }
  return result;
}

function resolvePollBounds(input: {
  ports: ProtocolRelayPorts;
  walletPublicKey: string;
  operationId: string;
  pollIntervalMs?: number;
  maxAttempts?: number;
  backoffMultiplier?: number;
  maxPollIntervalMs?: number;
  delay?: (ms: number) => Promise<void>;
}): SettlementPollBounds {
  return {
    ports: input.ports,
    walletPublicKey: input.walletPublicKey,
    operationId: input.operationId,
    pollIntervalMs: input.pollIntervalMs ?? DEFAULT_SETTLEMENT_POLL_INTERVAL_MS,
    maxAttempts: input.maxAttempts ?? DEFAULT_SETTLEMENT_MAX_ATTEMPTS,
    backoffMultiplier: input.backoffMultiplier ?? DEFAULT_SETTLEMENT_BACKOFF_MULTIPLIER,
    maxPollIntervalMs: input.maxPollIntervalMs ?? DEFAULT_SETTLEMENT_MAX_INTERVAL_MS,
    delay: input.delay ?? delay,
  };
}

export async function awaitRelaySettlement(input: {
  ports: ProtocolRelayPorts;
  walletPublicKey: string;
  operationId: string;
  pollIntervalMs?: number;
  maxAttempts?: number;
  backoffMultiplier?: number;
  maxPollIntervalMs?: number;
  delay?: (ms: number) => Promise<void>;
}): Promise<SubmitPrivateOperationResult> {
  const result = await pollUntilBound(resolvePollBounds(input));
  if (isSettled(result)) {
    return result;
  }
  return markSettlementTimedOut({
    ports: input.ports,
    operation: result.operation,
  });
}

export async function submitAndAwaitPrivateOperation(input: {
  ports: ProtocolRelayPorts;
  operation: NewPrivateOperation;
  pollIntervalMs?: number;
  maxAttempts?: number;
}): Promise<SubmitPrivateOperationResult> {
  if (shouldSubmitDirect(input)) {
    return submitPreparedPrivateOperation(input);
  }
  return measureStage('submit', () => settleThroughRelay(input));
}

async function settleThroughRelay(input: {
  ports: ProtocolRelayPorts;
  operation: NewPrivateOperation;
  pollIntervalMs?: number;
  maxAttempts?: number;
}): Promise<SubmitPrivateOperationResult> {
  const submitted = await submitPreparedPrivateOperation(input);
  if (submitted.outcome !== PENDING_OPERATION_PHASE.relayAccepted) {
    return submitted;
  }
  return measureStage('settlement', () =>
    awaitRelaySettlement({
      ports: input.ports,
      walletPublicKey: input.operation.walletPublicKey,
      operationId: input.operation.id,
      ...(input.pollIntervalMs === undefined
        ? {}
        : { pollIntervalMs: input.pollIntervalMs }),
      ...(input.maxAttempts === undefined ? {} : { maxAttempts: input.maxAttempts }),
    }),
  );
}
