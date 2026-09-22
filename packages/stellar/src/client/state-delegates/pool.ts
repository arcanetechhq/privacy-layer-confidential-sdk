import type { StellarStateService } from '../../state/index.js';
import {
  appendPoolMerkleCommitments,
  writePoolMerkleState,
} from '../../transact/merkle/write-snapshot.js';

export function createPoolStateDelegates(state: StellarStateService) {
  return {
    getPoolMerkleState: (
      poolContract: Parameters<StellarStateService['getPoolMerkleState']>[0],
    ) => state.getPoolMerkleState(poolContract),
    setPoolMerkleState: (
      poolState: Parameters<StellarStateService['setPoolMerkleState']>[0],
    ) =>
      writePoolMerkleState({
        setPoolMerkleState: (next) => state.setPoolMerkleState(next),
        state: poolState,
      }),
    appendPoolCommitments: (
      input: Parameters<StellarStateService['appendPoolCommitments']>[0],
    ) =>
      appendPoolMerkleCommitments({
        getPoolMerkleState: (poolContract) => state.getPoolMerkleState(poolContract),
        appendPoolCommitments: (payload) => state.appendPoolCommitments(payload),
        payload: input,
      }),
    getLeafEphemeral: (input: Parameters<StellarStateService['getLeafEphemeral']>[0]) =>
      state.getLeafEphemeral(input),
    setLeafEphemeral: (
      ephemeral: Parameters<StellarStateService['setLeafEphemeral']>[0],
    ) => state.setLeafEphemeral(ephemeral),
  };
}
