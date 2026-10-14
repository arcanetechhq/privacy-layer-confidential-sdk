import type { CoinData } from '@arcanetech/stellar-privacy-pool-zk-sdk';
import type {
  StellarPrivateCoinNote,
  StellarPrivateRecord,
} from '../../state/domain/types.js';

export function requireCoinNoteFromRecord(record: StellarPrivateRecord): CoinData {
  if (!record.coinNote) {
    throw new Error(`Private record ${record.id} is missing coin note data.`);
  }
  return record.coinNote;
}

function commitmentInteger(value: string): bigint | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
      return BigInt(trimmed);
    }
    if (/[a-fA-F]/.test(trimmed)) {
      return BigInt(`0x${trimmed}`);
    }
    return BigInt(trimmed);
  } catch {
    return undefined;
  }
}

export function findCommitmentLeafIndex(
  commitments: string[],
  commitment: string,
): number {
  const target = commitmentInteger(commitment);
  if (target === undefined) {
    return commitments.indexOf(commitment);
  }
  return commitments.findIndex((leaf) => commitmentInteger(leaf) === target);
}

export function buildPrivateRecordFromDeposit(input: {
  owner: string;
  privateAddress: string;
  assetId: string;
  poolContract: string;
  amount: bigint;
  amountDisplay: number;
  commitmentHex: string;
  coin: CoinData;
  depositScalarHex: string;
  precommitementHex: string;
  txHash?: string;
  status?: StellarPrivateRecord['status'];
}): StellarPrivateRecord {
  return {
    id: input.commitmentHex,
    owner: input.owner,
    asset: input.assetId,
    amount: input.amount,
    consumed: false,
    status: input.status ?? 'pending',
    poolContract: input.poolContract,
    commitmentHex: input.commitmentHex,
    privateAddress: input.privateAddress,
    amountDisplay: input.amountDisplay,
    coinNote: input.coin as StellarPrivateCoinNote,
    depositScalarHex: input.depositScalarHex,
    precommitementHex: input.precommitementHex,
    ...(input.txHash ? { txHash: input.txHash } : {}),
  };
}
