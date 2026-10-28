import { Buffer } from 'buffer';
import { Address, xdr } from '@stellar/stellar-sdk';

export function treeLeafLedgerKey(
  contractId: string,
  leafIndex: number,
): xdr.LedgerKey {
  return xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: new Address(contractId).toScAddress(),
      key: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Leaf'), xdr.ScVal.scvU32(leafIndex)]),
      durability: xdr.ContractDataDurability.persistent(),
    }),
  );
}

export function leafIndexFromContractDataKey(key: xdr.ScVal): number | undefined {
  if (key.switch() !== xdr.ScValType.scvVec()) {
    return undefined;
  }
  const fields = key.vec();
  if (!fields || fields.length !== 2) {
    return undefined;
  }
  const tag = fields[0];
  const indexValue = fields[1];
  if (
    !tag ||
    tag.switch() !== xdr.ScValType.scvSymbol() ||
    tag.sym().toString() !== 'Leaf'
  ) {
    return undefined;
  }
  if (!indexValue || indexValue.switch() !== xdr.ScValType.scvU32()) {
    return undefined;
  }
  return indexValue.u32();
}

export function commitmentBytesFromContractDataValue(
  value: xdr.ScVal,
): Buffer | undefined {
  if (value.switch() !== xdr.ScValType.scvBytes()) {
    return undefined;
  }
  return Buffer.from(value.bytes());
}
