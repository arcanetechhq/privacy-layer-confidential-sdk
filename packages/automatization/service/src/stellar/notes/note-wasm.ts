export interface NoteWasm {
  initSync(input: { module: ArrayBuffer | Uint8Array }): unknown;
  poseidon1Decimal(value: string): string;
  commitmentChainHexWithAccumulator(
    value: string,
    secret: string,
    nullifier: string,
    ownerX: string,
    ownerY: string,
    ownerMode: string,
    assetHi: string,
    assetLo: string,
    applicationId: string,
    accumulator: string,
  ): string;
  calculateNullifierHash(nullifier: string, ownerScalar: string): string;
  ecdhEphemeralPublicKeyFromScalarHex(scalarHex: string): { x: string; y: string };
}

const REQUIRED_FUNCTIONS = [
  'initSync',
  'poseidon1Decimal',
  'commitmentChainHexWithAccumulator',
  'calculateNullifierHash',
  'ecdhEphemeralPublicKeyFromScalarHex',
] as const;

function assertNoteWasm(module: Partial<Record<string, unknown>>): void {
  const missing = REQUIRED_FUNCTIONS.filter(
    (name) => typeof module[name] !== 'function',
  );
  if (missing.length > 0) {
    throw new Error(
      `The installed @arcanetech/stellar-privacy-pool-zk-sdk does not support note accumulators (missing ${missing.join(', ')}).`,
    );
  }
}

export async function loadNoteWasm(
  sdkWasm: ArrayBuffer | Uint8Array,
): Promise<NoteWasm> {
  const module =
    (await import('@arcanetech/stellar-privacy-pool-zk-sdk/pkg/client_sdk_wasm.js')) as unknown as Partial<
      Record<string, unknown>
    >;
  assertNoteWasm(module);
  const wasm = module as unknown as NoteWasm;
  try {
    wasm.initSync({ module: sdkWasm });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already initialized/iu.test(message)) {
      throw error;
    }
  }
  return wasm;
}
