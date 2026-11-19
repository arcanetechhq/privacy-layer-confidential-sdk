import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export const Errors = {
  1: {message:"OnlyAdmin"},
  /**
   * Reserved: trusted-pool coupling removed (N2/N6). Do not reuse.
   */
  2: {message:"UntrustedCaller"},
  /**
   * Reserved: pending-note index removed (N2). Do not reuse.
   */
  3: {message:"DuplicatePendingNullifier"},
  /**
   * Reserved: pending-note payload removed (M1). Do not reuse.
   */
  4: {message:"ForbiddenEphemeralScalar"},
  /**
   * Reserved: pending-note payload removed (N6). Do not reuse.
   */
  5: {message:"EmptyNotes"},
  /**
   * A required constructor-set config value is missing; only reachable if the
   * contract is queried before `__constructor` has run.
   */
  6: {message:"NotInitialized"},
  /**
   * Owner already has a registered private address with a different public key; private
   * addresses are permanent and cannot be changed once registered.
   */
  7: {message:"PrivateAddressImmutable"},
  /**
   * The given public key is already registered to a different owner.
   */
  8: {message:"PublicKeyAlreadyRegistered"}
}



export interface KytPassageRecord {
  consumed: boolean;
  expires_at_ledger: u32;
}


export interface PrivateAddressRecord {
  owner: string;
  public_key_x: Buffer;
  public_key_y: Buffer;
  updated_at_ledger: u32;
}


export interface KytPassageAuthorization {
  expiration_ledger: u32;
  signature: Buffer;
}


export interface PrivateAddressRegistration {
  owner: string;
  public_key_x: Buffer;
  public_key_y: Buffer;
}

export interface Client {
  /**
   * Construct and simulate a get_private_address transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_private_address: ({owner}: {owner: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<PrivateAddressRecord>>>

  /**
   * Construct and simulate a seed_private_address transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin-only migration helper: seed forward and reverse indexes without owner auth.
   */
  seed_private_address: ({registration, updated_at_ledger}: {registration: PrivateAddressRegistration, updated_at_ledger: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_owner_by_public_key transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Resolve the Stellar G-address owner from a registered private-address public key.
   */
  get_owner_by_public_key: ({public_key_x, public_key_y}: {public_key_x: Buffer, public_key_y: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a register_private_address transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Owner registers a permanent private address directly.
   */
  register_private_address: ({owner, public_key_x, public_key_y}: {owner: string, public_key_x: Buffer, public_key_y: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin}: {admin: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACAAAAAAAAAAJT25seUFkbWluAAAAAAAAAQAAAD5SZXNlcnZlZDogdHJ1c3RlZC1wb29sIGNvdXBsaW5nIHJlbW92ZWQgKE4yL042KS4gRG8gbm90IHJldXNlLgAAAAAAD1VudHJ1c3RlZENhbGxlcgAAAAACAAAAOFJlc2VydmVkOiBwZW5kaW5nLW5vdGUgaW5kZXggcmVtb3ZlZCAoTjIpLiBEbyBub3QgcmV1c2UuAAAAGUR1cGxpY2F0ZVBlbmRpbmdOdWxsaWZpZXIAAAAAAAADAAAAOlJlc2VydmVkOiBwZW5kaW5nLW5vdGUgcGF5bG9hZCByZW1vdmVkIChNMSkuIERvIG5vdCByZXVzZS4AAAAAABhGb3JiaWRkZW5FcGhlbWVyYWxTY2FsYXIAAAAEAAAAOlJlc2VydmVkOiBwZW5kaW5nLW5vdGUgcGF5bG9hZCByZW1vdmVkIChONikuIERvIG5vdCByZXVzZS4AAAAAAApFbXB0eU5vdGVzAAAAAAAFAAAAfUEgcmVxdWlyZWQgY29uc3RydWN0b3Itc2V0IGNvbmZpZyB2YWx1ZSBpcyBtaXNzaW5nOyBvbmx5IHJlYWNoYWJsZSBpZiB0aGUKY29udHJhY3QgaXMgcXVlcmllZCBiZWZvcmUgYF9fY29uc3RydWN0b3JgIGhhcyBydW4uAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAAGAAAAkk93bmVyIGFscmVhZHkgaGFzIGEgcmVnaXN0ZXJlZCBwcml2YXRlIGFkZHJlc3Mgd2l0aCBhIGRpZmZlcmVudCBwdWJsaWMga2V5OyBwcml2YXRlCmFkZHJlc3NlcyBhcmUgcGVybWFuZW50IGFuZCBjYW5ub3QgYmUgY2hhbmdlZCBvbmNlIHJlZ2lzdGVyZWQuAAAAAAAXUHJpdmF0ZUFkZHJlc3NJbW11dGFibGUAAAAABwAAAEBUaGUgZ2l2ZW4gcHVibGljIGtleSBpcyBhbHJlYWR5IHJlZ2lzdGVyZWQgdG8gYSBkaWZmZXJlbnQgb3duZXIuAAAAGlB1YmxpY0tleUFscmVhZHlSZWdpc3RlcmVkAAAAAAAI",
        "AAAABQAAAOhFbWl0dGVkIGJ5IFtgUHJpdmF0ZUFkZHJlc3NSZWdpc3RyeTo6dXBzZXJ0X3ByaXZhdGVfYWRkcmVzc19yZWNvcmRgXSAob3duZXIgc2VsZi1yZWdpc3RyYXRpb24KdmlhIFtgUHJpdmF0ZUFkZHJlc3NSZWdpc3RyeTo6cmVnaXN0ZXJfcHJpdmF0ZV9hZGRyZXNzYF0sIG9yIHRoZSBhZG1pbiBtaWdyYXRpb24gaGVscGVyCltgUHJpdmF0ZUFkZHJlc3NSZWdpc3RyeTo6c2VlZF9wcml2YXRlX2FkZHJlc3NgXSkuAAAAAAAAABhQcml2YXRlQWRkcmVzc1JlZ2lzdGVyZWQAAAACAAAAD3ByaXZhdGVfYWRkcmVzcwAAAAAKcmVnaXN0ZXJlZAAAAAAAAQAAAAAAAAAFb3duZXIAAAAAAAATAAAAAQAAAAA=",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAATZ2V0X3ByaXZhdGVfYWRkcmVzcwAAAAABAAAAAAAAAAVvd25lcgAAAAAAABMAAAABAAAD6AAAB9AAAAAUUHJpdmF0ZUFkZHJlc3NSZWNvcmQ=",
        "AAAAAAAAAFFBZG1pbi1vbmx5IG1pZ3JhdGlvbiBoZWxwZXI6IHNlZWQgZm9yd2FyZCBhbmQgcmV2ZXJzZSBpbmRleGVzIHdpdGhvdXQgb3duZXIgYXV0aC4AAAAAAAAUc2VlZF9wcml2YXRlX2FkZHJlc3MAAAACAAAAAAAAAAxyZWdpc3RyYXRpb24AAAfQAAAAGlByaXZhdGVBZGRyZXNzUmVnaXN0cmF0aW9uAAAAAAAAAAAAEXVwZGF0ZWRfYXRfbGVkZ2VyAAAAAAAABAAAAAA=",
        "AAAAAAAAAFFSZXNvbHZlIHRoZSBTdGVsbGFyIEctYWRkcmVzcyBvd25lciBmcm9tIGEgcmVnaXN0ZXJlZCBwcml2YXRlLWFkZHJlc3MgcHVibGljIGtleS4AAAAAAAAXZ2V0X293bmVyX2J5X3B1YmxpY19rZXkAAAAAAgAAAAAAAAAMcHVibGljX2tleV94AAAD7gAAACAAAAAAAAAADHB1YmxpY19rZXlfeQAAA+4AAAAgAAAAAQAAA+gAAAAT",
        "AAAAAAAAADVPd25lciByZWdpc3RlcnMgYSBwZXJtYW5lbnQgcHJpdmF0ZSBhZGRyZXNzIGRpcmVjdGx5LgAAAAAAABhyZWdpc3Rlcl9wcml2YXRlX2FkZHJlc3MAAAADAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAADHB1YmxpY19rZXlfeAAAA+4AAAAgAAAAAAAAAAxwdWJsaWNfa2V5X3kAAAPuAAAAIAAAAAA=",
        "AAAAAQAAAAAAAAAAAAAAEEt5dFBhc3NhZ2VSZWNvcmQAAAACAAAAAAAAAAhjb25zdW1lZAAAAAEAAAAAAAAAEWV4cGlyZXNfYXRfbGVkZ2VyAAAAAAAABA==",
        "AAAAAQAAAAAAAAAAAAAAFFByaXZhdGVBZGRyZXNzUmVjb3JkAAAABAAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAxwdWJsaWNfa2V5X3gAAAPuAAAAIAAAAAAAAAAMcHVibGljX2tleV95AAAD7gAAACAAAAAAAAAAEXVwZGF0ZWRfYXRfbGVkZ2VyAAAAAAAABA==",
        "AAAAAQAAAAAAAAAAAAAAF0t5dFBhc3NhZ2VBdXRob3JpemF0aW9uAAAAAAIAAAAAAAAAEWV4cGlyYXRpb25fbGVkZ2VyAAAAAAAABAAAAAAAAAAJc2lnbmF0dXJlAAAAAAAD7gAAAEA=",
        "AAAAAQAAAAAAAAAAAAAAGlByaXZhdGVBZGRyZXNzUmVnaXN0cmF0aW9uAAAAAAADAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAADHB1YmxpY19rZXlfeAAAA+4AAAAgAAAAAAAAAAxwdWJsaWNfa2V5X3kAAAPuAAAAIA==" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_private_address: this.txFromJSON<Option<PrivateAddressRecord>>,
        seed_private_address: this.txFromJSON<null>,
        get_owner_by_public_key: this.txFromJSON<Option<string>>,
        register_private_address: this.txFromJSON<null>
  }
}