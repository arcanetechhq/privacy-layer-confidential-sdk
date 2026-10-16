import { z } from 'zod';

const stringFieldMapSchema = z.record(z.string());

export const dataAuthorizationChallengeSchema = z.object({
  protocol: z.string().min(1),
  message: z.string().min(1),
  fields: stringFieldMapSchema,
});

export const dataAuthorizationProofSchema = z.object({
  protocol: z.string().min(1),
  fields: stringFieldMapSchema,
});

export type DataAuthorizationChallenge = z.infer<
  typeof dataAuthorizationChallengeSchema
>;
export type DataAuthorizationProof = z.infer<typeof dataAuthorizationProofSchema>;

export type DataAuthorizer = {
  authorize(challenge: DataAuthorizationChallenge): Promise<DataAuthorizationProof>;
};

export async function authorizePrivateData(
  authorizer: DataAuthorizer,
  challenge: unknown,
): Promise<DataAuthorizationProof> {
  const parsedChallenge = dataAuthorizationChallengeSchema.parse(challenge);
  const proof = await authorizer.authorize(parsedChallenge);
  return dataAuthorizationProofSchema.parse(proof);
}
