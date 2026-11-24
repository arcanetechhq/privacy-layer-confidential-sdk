import { Keypair, Transaction, xdr } from '@stellar/stellar-sdk';

const KYT_FIELD = 'kyt_authorization';
const EXPIRATION_FIELD = 'expiration_ledger';
const SIGNATURE_FIELD = 'signature';

export function signRelayPlacement(input: {
  envelope: string;
  relaySecret: string;
  sourceSequence: string;
  networkPassphrase: string;
  kytExpirationLedger: number;
  kytSignature: Uint8Array;
}): string {
  const parsed = new Transaction(input.envelope, input.networkPassphrase);
  const body = parsed.toEnvelope().v1().tx();
  const rebuilt = new xdr.Transaction({
    sourceAccount: body.sourceAccount(),
    fee: body.fee(),
    seqNum: xdr.Int64.fromString(nextSequence(input.sourceSequence)),
    cond: body.cond(),
    memo: body.memo(),
    operations: body.operations().map((operation) => patchOperation(operation, input)),
    ext: body.ext(),
  });
  const signed = new Transaction(
    xdr.TransactionEnvelope.envelopeTypeTx(
      new xdr.TransactionV1Envelope({ tx: rebuilt, signatures: [] }),
    ).toXDR('base64'),
    input.networkPassphrase,
  );
  signed.sign(Keypair.fromSecret(input.relaySecret));
  return signed.toXDR();
}

function nextSequence(sourceSequence: string): string {
  return (BigInt(sourceSequence) + 1n).toString();
}

function patchOperation(
  operation: xdr.Operation,
  input: { kytExpirationLedger: number; kytSignature: Uint8Array },
): xdr.Operation {
  if (operation.body().switch().name !== 'invokeHostFunction') {
    return operation;
  }
  const invoke = operation.body().invokeHostFunctionOp();
  const host = invoke.hostFunction();
  if (host.switch().name !== 'hostFunctionTypeInvokeContract') {
    return operation;
  }
  const contract = host.invokeContract();
  return new xdr.Operation({
    sourceAccount: operation.sourceAccount(),
    body: xdr.OperationBody.invokeHostFunction(
      new xdr.InvokeHostFunctionOp({
        hostFunction: xdr.HostFunction.hostFunctionTypeInvokeContract(
          new xdr.InvokeContractArgs({
            contractAddress: contract.contractAddress(),
            functionName: contract.functionName(),
            args: contract.args().map((argument) => patchPoolCall(argument, input)),
          }),
        ),
        auth: invoke.auth(),
      }),
    ),
  });
}

function patchPoolCall(
  value: xdr.ScVal,
  input: { kytExpirationLedger: number; kytSignature: Uint8Array },
): xdr.ScVal {
  if (value.switch().name !== 'scvMap') {
    return value;
  }
  const entries = value.map() ?? [];
  if (!entries.some((entry) => symbolName(entry.key()) === KYT_FIELD)) {
    return value;
  }
  return xdr.ScVal.scvMap(
    entries.map((entry) =>
      symbolName(entry.key()) === KYT_FIELD
        ? new xdr.ScMapEntry({ key: entry.key(), val: patchKyt(entry.val(), input) })
        : entry,
    ),
  );
}

function patchKyt(
  value: xdr.ScVal,
  input: { kytExpirationLedger: number; kytSignature: Uint8Array },
): xdr.ScVal {
  return xdr.ScVal.scvMap(
    (value.map() ?? []).map((entry) => {
      const name = symbolName(entry.key());
      if (name === EXPIRATION_FIELD) {
        return mapEntry(entry.key(), xdr.ScVal.scvU32(input.kytExpirationLedger));
      }
      if (name === SIGNATURE_FIELD) {
        return mapEntry(
          entry.key(),
          xdr.ScVal.scvBytes(Buffer.from(input.kytSignature)),
        );
      }
      return entry;
    }),
  );
}

function mapEntry(key: xdr.ScVal, value: xdr.ScVal): xdr.ScMapEntry {
  return new xdr.ScMapEntry({ key, val: value });
}

function symbolName(key: xdr.ScVal): string | undefined {
  return key.sym()?.toString();
}
