import { z } from 'zod';

export const paginationSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  hasMore: z.boolean(),
});

const stellarPrivateCoinNoteSchema = z.object({
  value: z.string(),
  nullifier: z.string(),
  secret: z.string(),
  commitment: z.string(),
  asset_hi: z.string(),
  asset_lo: z.string(),
  application_id: z.string().optional(),
});

export const privateRecordSchema = z.object({
  id: z.string().min(1),
  owner: z.string().min(1),
  asset: z.string().min(1),
  amount: z.coerce.bigint(),
  consumed: z.boolean(),
  status: z.enum(['pending', 'finalized', 'spent']).optional(),
  poolContract: z.string().optional(),
  commitmentHex: z.string().optional(),
  nullifierHex: z.string().optional(),
  amountDisplay: z.number().optional(),
  deliveryId: z.number().int().optional(),
  privateAddress: z.string().optional(),
  txHash: z.string().optional(),
  coinNote: stellarPrivateCoinNoteSchema.optional(),
  depositScalarHex: z.string().optional(),
  precommitementHex: z.string().optional(),
});

export const assetSchema = z.object({
  id: z.number().int(),
  assetId: z.string().min(1),
  name: z.string().min(1),
  logoUrl: z.string().nullable(),
  issuerAddress: z.string().nullable(),
  clientContract: z.string().nullable(),
  poolContracts: z.array(z.string()),
  poolContract: z.string().min(1),
  mintable: z.boolean(),
  mintAmount: z.string().nullable(),
  decimals: z.number().int().nullable().optional(),
});

export const publicBalanceSchema = z.object({
  owner: z.string().min(1),
  asset: z.string().min(1),
  balance: z.string(),
  trustlineStatus: z.enum(['active', 'inactive', 'none']),
});

export const registryLookupSchema = z.object({
  owner: z.string().min(1),
  status: z.enum(['registered', 'unregistered']),
  privateAddressStpl1: z.string().optional(),
  publicKeyXHex: z.string().optional(),
  publicKeyYHex: z.string().optional(),
  updatedAtLedger: z.number().int().optional(),
  cachedAt: z.string().optional(),
});

export const walletPrivateAddressScalarSchema = z.object({
  owner: z.string().min(1),
  nonce: z.string().min(1),
  scalarHex: z.string().min(1),
  updatedAt: z.string().optional(),
});

export const walletPrivateAddressRecordSchema = z.object({
  owner: z.string().min(1),
  nonce: z.string().min(1),
  privateAddress: z.string().min(1),
  createdAt: z.number(),
});

export const leanImtNodeSchema = z.object({
  level: z.number().int().nonnegative(),
  index: z.number().int().nonnegative(),
  value: z.string().min(1),
});

export const poolMerkleStateSchema = z.object({
  poolContract: z.string().min(1),
  commitments: z.array(z.string()),
  commitmentCount: z.number().int().nonnegative(),
  merkleRootHex: z.string().min(1),
  updatedAt: z.number(),
  syncedLedger: z.number().int().optional(),
  nodes: z.array(leanImtNodeSchema).optional(),
});

export const leafEphemeralSchema = z.object({
  poolContract: z.string().min(1),
  leafIndex: z.number().int().nonnegative(),
  xHex: z.string().min(1),
  yHex: z.string().min(1),
  cachedAt: z.string().optional(),
});

export const incomingDeliverySchema = z.object({
  id: z.number().int(),
  privateAddress: z.string().min(1),
  asset: z.string().min(1),
  ciphertextBase64: z.string().min(1),
  ephemeralKey: z.string().min(1),
  tagBase64: z.string().min(1),
  createdAt: z.string().min(1),
  processed: z.boolean().optional(),
});

export const deliverySyncStateSchema = z.object({
  privateAddress: z.string().min(1),
  asset: z.string().min(1),
  bloomM: z.number().int().positive(),
  bloomK: z.number().int().positive(),
  bloomBitsBase64: z.string().optional(),
  lastPage: z.number().int().positive().optional(),
  lastPolledAt: z.string().optional(),
});

export const transactionStatusSchema = z.object({
  txHash: z.string().min(1),
  status: z.enum(['pending', 'success', 'failed']),
  ledger: z.number().int().optional(),
  createdAt: z.string().optional(),
});
