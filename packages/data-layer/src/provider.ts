import {
  authorizePrivateData,
  dataAuthorizationChallengeSchema,
  type DataAuthorizationChallenge,
  type DataAuthorizer,
} from '@arcanetech/privacy-sdk-core';
import type { ZodType } from 'zod';
import { postPrivateData, PRIVATE_DATA_PATH } from './transport.js';

function parseRecordList<TRecord>(
  payload: unknown,
  schema: ZodType<TRecord>,
): readonly TRecord[] {
  if (!Array.isArray(payload)) {
    throw new TypeError('Private data records are not a list.');
  }
  return payload.map((item) => schema.parse(item));
}

async function findPrivateDataRecords<TRecord>(
  input: {
    origin: string;
    dataType: string;
    recordSchema: ZodType<TRecord>;
    fetch?: typeof globalThis.fetch;
  },
  attributes: Readonly<Record<string, string>>,
): Promise<readonly TRecord[]> {
  const payload = await postPrivateData({
    origin: input.origin,
    path: PRIVATE_DATA_PATH.records,
    body: {
      dataType: input.dataType,
      attributes,
    },
    fetchImpl: input.fetch,
  });
  return parseRecordList(payload, input.recordSchema);
}

export type PrivateDataProvider<TRecord, TCompletion> = {
  find(attributes: Readonly<Record<string, string>>): Promise<readonly TRecord[]>;
  createChallenge(
    fields: Readonly<Record<string, string>>,
  ): Promise<DataAuthorizationChallenge>;
  completeChallenge(challenge: DataAuthorizationChallenge): Promise<TCompletion>;
};

export type CreatePrivateDataProviderInput<TRecord, TCompletion> = {
  origin: string;
  dataType: string;
  recordSchema: ZodType<TRecord>;
  completionSchema?: ZodType<TCompletion>;
  protocol?: string;
  authorizer?: DataAuthorizer;
  fetch?: typeof globalThis.fetch;
};

function requireAuthorizer(authorizer: DataAuthorizer | undefined): DataAuthorizer {
  if (!authorizer) {
    throw new Error('Private data authorizer is not configured.');
  }
  return authorizer;
}

function requireProtocol(protocol: string | undefined): string {
  if (!protocol) {
    throw new Error('Private data protocol is not configured.');
  }
  return protocol;
}

async function createPrivateDataChallenge<TRecord, TCompletion>(
  input: CreatePrivateDataProviderInput<TRecord, TCompletion>,
  fields: Readonly<Record<string, string>>,
): Promise<DataAuthorizationChallenge> {
  requireCompletionSchema(input.completionSchema);
  const payload = await postPrivateData({
    origin: input.origin,
    path: PRIVATE_DATA_PATH.challenges,
    body: {
      dataType: input.dataType,
      protocol: requireProtocol(input.protocol),
      fields,
    },
    fetchImpl: input.fetch,
  });
  return dataAuthorizationChallengeSchema.parse(payload);
}

function requireCompletionSchema<TCompletion>(
  schema: ZodType<TCompletion> | undefined,
): ZodType<TCompletion> {
  if (!schema) {
    throw new Error('Private data completion is not configured.');
  }
  return schema;
}

async function completePrivateDataChallenge<TRecord, TCompletion>(
  input: CreatePrivateDataProviderInput<TRecord, TCompletion>,
  challenge: DataAuthorizationChallenge,
): Promise<TCompletion> {
  const completionSchema = requireCompletionSchema(input.completionSchema);
  const proof = await authorizePrivateData(
    requireAuthorizer(input.authorizer),
    challenge,
  );
  const payload = await postPrivateData({
    origin: input.origin,
    path: PRIVATE_DATA_PATH.completions,
    body: {
      dataType: input.dataType,
      protocol: proof.protocol,
      fields: proof.fields,
    },
    fetchImpl: input.fetch,
  });
  return completionSchema.parse(payload);
}

export function createPrivateDataProvider<TRecord, TCompletion>(
  input: CreatePrivateDataProviderInput<TRecord, TCompletion>,
): PrivateDataProvider<TRecord, TCompletion> {
  return {
    find(attributes) {
      return findPrivateDataRecords(input, attributes);
    },
    createChallenge(fields) {
      return createPrivateDataChallenge(input, fields);
    },
    completeChallenge(challenge) {
      return completePrivateDataChallenge(input, challenge);
    },
  };
}
