import type {
  StateBridge,
  StateBridgeDefinition,
} from '@arcanetech/privacy-sdk-core/state';
import { z } from 'zod';

const INTEREST_DEPOSITS = '$.blend.interestDeposits';

export const interestDepositSchema = z
  .object({
    chainIndex: z.number().int().nonnegative(),
    account: z.string().min(1),
    blendPool: z.string().min(1),
    reserve: z.string().min(1),
  })
  .strict();

export type InterestDeposit = z.infer<typeof interestDepositSchema>;

const saveInterestDepositSchema = z
  .object({
    type: z.literal('blend.saveInterestDeposit'),
    record: interestDepositSchema,
  })
  .transform(({ type, record }) => ({
    type,
    operations: [
      {
        opType: 'recordSet' as const,
        jsonPath: INTEREST_DEPOSITS,
        key: interestDepositKey(record),
        value: record,
      },
    ],
  }));

const listInterestDepositsSchema = z
  .object({
    type: z.literal('blend.listInterestDeposits'),
  })
  .transform(({ type }) => ({
    type,
    operations: [
      {
        opType: 'recordValues' as const,
        jsonPath: INTEREST_DEPOSITS,
      },
    ],
  }));

export const blendInterestDepositDefinitions: StateBridgeDefinition[] = [
  {
    type: 'blend.saveInterestDeposit',
    mode: 'write',
    schema: saveInterestDepositSchema,
  },
  {
    type: 'blend.listInterestDeposits',
    mode: 'read',
    schema: listInterestDepositsSchema,
  },
];

export function bindBlendInterestDeposits(bridge: Pick<StateBridge, 'register'>): void {
  bridge.register(blendInterestDepositDefinitions);
}

export async function saveInterestDeposit(
  bridge: StateBridge,
  record: InterestDeposit,
): Promise<void> {
  await bridge.write({ type: 'blend.saveInterestDeposit', record });
}

export async function listInterestDeposits(
  bridge: StateBridge,
): Promise<InterestDeposit[]> {
  return bridge.read<InterestDeposit[]>({ type: 'blend.listInterestDeposits' });
}

function interestDepositKey(record: InterestDeposit): string {
  return `${record.blendPool}:${record.reserve}:${String(record.chainIndex)}:${record.account}`;
}
