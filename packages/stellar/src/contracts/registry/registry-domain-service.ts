import { Buffer } from 'buffer';
import type { StellarAddress, StellarRegistryLookup } from '../../types.js';
import {
  decodePrivateAddress,
  encodePrivateAddressFromHexCoordinates,
} from '../../transact/private-address/codec.js';
import { runTtlPreflight } from '../../transact/submit/ttl-preflight.js';
import type { StellarContractContext } from '../contract-context.js';
import type { PrivateAddressRecord } from './create-registry-client.js';

const COORDINATE_HEX_LENGTH = 64;

function readCoordinateBytes(value: unknown): Buffer | undefined {
  if (value instanceof Buffer) {
    return value;
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  return undefined;
}

function normalizePrivateAddressRecord(
  value: unknown,
): PrivateAddressRecord | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const publicKeyX = readCoordinateBytes(record.public_key_x);
  const publicKeyY = readCoordinateBytes(record.public_key_y);
  if (typeof record.owner !== 'string' || !publicKeyX || !publicKeyY) {
    return undefined;
  }
  return {
    owner: record.owner,
    public_key_x: publicKeyX,
    public_key_y: publicKeyY,
    updated_at_ledger: Number(record.updated_at_ledger ?? 0),
  };
}

function parseOptionSomeRecord(result: unknown): PrivateAddressRecord | undefined {
  if (!result || typeof result !== 'object' || !('tag' in result)) {
    return undefined;
  }
  const option = result as { tag?: unknown; values?: unknown };
  if (option.tag !== 'Some' || !Array.isArray(option.values)) {
    return undefined;
  }
  return normalizePrivateAddressRecord(option.values[0]);
}

function parseRegistryLookupRecord(result: unknown): PrivateAddressRecord | undefined {
  const directRecord = normalizePrivateAddressRecord(result);
  if (directRecord) {
    return directRecord;
  }
  return parseOptionSomeRecord(result);
}

function recordToLookupResult(record: PrivateAddressRecord): StellarRegistryLookup {
  const publicKeyXHex = Buffer.from(record.public_key_x).toString('hex');
  const publicKeyYHex = Buffer.from(record.public_key_y).toString('hex');
  return {
    owner: record.owner,
    status: 'registered',
    privateAddressStpl1: encodePrivateAddressFromHexCoordinates(
      publicKeyXHex,
      publicKeyYHex,
    ),
    publicKeyXHex,
    publicKeyYHex,
    updatedAtLedger: record.updated_at_ledger,
    cachedAt: new Date().toISOString(),
  };
}

export async function readRegistryLookupFromChain(input: {
  contractContext: StellarContractContext;
  owner: StellarAddress;
  walletPublicKey: string;
}): Promise<StellarRegistryLookup> {
  const owner = input.owner.trim();
  const client = input.contractContext.createRegistryClient({
    contractId: input.contractContext.network.registryContract,
    walletPublicKey: input.walletPublicKey,
    networkPassphrase: input.contractContext.network.networkPassphrase,
    sorobanRpcUrl: input.contractContext.network.rpcUrl,
  });
  const read = await client.get_private_address({ owner });
  const record = parseRegistryLookupRecord(read.result);
  if (!record) {
    return {
      owner,
      status: 'unregistered',
      cachedAt: new Date().toISOString(),
    };
  }
  return recordToLookupResult(record);
}

export async function registerPrivateAddressOnChain(input: {
  contractContext: StellarContractContext;
  owner: StellarAddress;
  walletPublicKey: string;
  privateAddressStpl1: string;
}): Promise<string> {
  const decoded = decodePrivateAddress(input.privateAddressStpl1.trim());
  const client = input.contractContext.createRegistryClient({
    contractId: input.contractContext.network.registryContract,
    walletPublicKey: input.walletPublicKey,
    networkPassphrase: input.contractContext.network.networkPassphrase,
    sorobanRpcUrl: input.contractContext.network.rpcUrl,
  });
  const assembled = await client.register_private_address({
    owner: input.owner.trim(),
    public_key_x: Buffer.from(decoded.x.padStart(COORDINATE_HEX_LENGTH, '0'), 'hex'),
    public_key_y: Buffer.from(decoded.y.padStart(COORDINATE_HEX_LENGTH, '0'), 'hex'),
  });
  await runTtlPreflight(assembled);
  const sent = await assembled.signAndSend();
  const transactionHash = sent.sendTransactionResponse?.hash ?? '';
  if (!transactionHash) {
    throw new Error('Registry registration transaction failed');
  }
  return transactionHash;
}
