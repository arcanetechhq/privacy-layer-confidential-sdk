import type { StellarPoolMerkleState } from '../../../types.js';
import { withoutUndefinedFields } from '../../foundation/coerce.js';
import { normalizePoolMerkleState } from '../../read/normalize.js';
import { stellarStateCallTypes } from '../../bridge/call-types.js';
import type { StellarStateServiceBase } from '../base.js';

function isMissingStatePathError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.message.includes('Record path not found:') ||
    error.message.includes('JSONPath segment not found:')
  );
}

export function createPoolMerkleService(context: StellarStateServiceBase) {
  const { bridge } = context;

  return {
    async getPoolMerkleState(
      poolContract: string,
    ): Promise<StellarPoolMerkleState | undefined> {
      try {
        const value = await bridge.read<unknown>({
          type: stellarStateCallTypes.readPoolMerkleState,
          poolContract,
        });
        return normalizePoolMerkleState(value);
      } catch (error) {
        if (isMissingStatePathError(error)) {
          return undefined;
        }
        throw error;
      }
    },

    setPoolMerkleState(state: StellarPoolMerkleState): Promise<void> {
      return bridge.write({
        type: stellarStateCallTypes.setPoolMerkleState,
        state,
      });
    },

    async appendPoolCommitments(input: {
      poolContract: string;
      commitments: string[];
      merkleRootHex: string;
      syncedLedger?: number;
      nodes?: StellarPoolMerkleState['nodes'];
    }): Promise<void> {
      const current = await this.getPoolMerkleState(input.poolContract);
      const mergedCommitments = [...(current?.commitments ?? []), ...input.commitments];
      const nodes =
        input.nodes ?? (input.commitments.length === 0 ? current?.nodes : undefined);
      await this.setPoolMerkleState(
        withoutUndefinedFields({
          poolContract: input.poolContract,
          commitments: mergedCommitments,
          commitmentCount: mergedCommitments.length,
          merkleRootHex: input.merkleRootHex,
          updatedAt: Date.now(),
          syncedLedger: input.syncedLedger ?? current?.syncedLedger,
          nodes,
        }) as StellarPoolMerkleState,
      );
    },
  };
}
