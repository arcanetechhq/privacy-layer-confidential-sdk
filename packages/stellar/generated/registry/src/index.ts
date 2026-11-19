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
  /**
   * Reserved: role checks use OpenZeppelin `AccessControlError`. Do not reuse.
   */
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
  8: {message:"PublicKeyAlreadyRegistered"},
  /**
   * A coordinate is not a canonical BN254 scalar (it is greater than or equal to `r`).
   */
  9: {message:"InvalidPrivateAddressKey"},
  /**
   * The EdDSA-Poseidon signature does not prove knowledge of this public key for this owner.
   */
  10: {message:"InvalidRegistrationSignature"}
}



export interface PrivateAddressRecord {
  owner: string;
  public_key_x: Buffer;
  public_key_y: Buffer;
  updated_at_ledger: u32;
}


export interface PrivateAddressRegistration {
  owner: string;
  public_key_x: Buffer;
  public_key_y: Buffer;
}


/**
 * EdDSA-Poseidon signature of the registry binding under the private-address spend scalar.
 */
export interface PrivateAddressRegistrationSignature {
  r8_x: Buffer;
  r8_y: Buffer;
  s: Buffer;
}

export const UpgradeError = {
  3001: {message:"UpgradesDisabled"},
  3002: {message:"MigrationInProgress"},
  3003: {message:"MigrationNotActive"},
  3004: {message:"MigrationIncomplete"},
  3005: {message:"MigrationRootMismatch"},
  3006: {message:"InvalidMigrationVersion"},
  3007: {message:"RenounceDuringMigration"}
}

export const RoleTransferError = {
  2200: {message:"NoPendingTransfer"},
  2201: {message:"InvalidLiveUntilLedger"},
  2202: {message:"InvalidPendingAccount"},
  2203: {message:"TransferExpired"}
}





export const AccessControlError = {
  2000: {message:"Unauthorized"},
  2001: {message:"AdminNotSet"},
  2002: {message:"IndexOutOfBounds"},
  2003: {message:"AdminRoleNotFound"},
  2004: {message:"RoleCountIsNotZero"},
  2005: {message:"RoleNotFound"},
  2006: {message:"AdminAlreadySet"},
  2007: {message:"RoleNotHeld"},
  2008: {message:"RoleIsEmpty"},
  2009: {message:"TransferInProgress"},
  2010: {message:"MaxRolesExceeded"}
}



export interface Client {
  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Replaces this contract's WASM. When `start_migration` is set, the same
   * call opens a migration to the next schema version before the new code
   * is scheduled. The `upgrade` role is sufficient.
   */
  upgrade: ({new_wasm_hash, start_migration, operator}: {new_wasm_hash: Buffer, start_migration: boolean, operator: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a has_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns `Some(index)` if the account has the specified role,
   * where `index` is the position of the account for that role,
   * and can be used to query [`AccessControl::get_role_member()`].
   * Returns `None` if the account does not have the specified role.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * * `account` - The account to check.
   * * `role` - The role to check for.
   */
  has_role: ({account, role}: {account: string, role: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<u32>>>

  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the admin account.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   */
  get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a grant_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Grants a role to an account.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * * `account` - The account to grant the role to.
   * * `role` - The role to grant.
   * * `caller` - The address of the caller, must be the admin or have the
   * `RoleAdmin` for the `role`.
   * 
   * # Errors
   * 
   * * [`AccessControlError::Unauthorized`] - If the caller does not have
   * enough privileges.
   * * [`AccessControlError::MaxRolesExceeded`] - If adding a new role would
   * exceed the maximum allowed number of roles.
   * 
   * # Events
   * 
   * * topics - `["role_granted", role: Symbol, account: Address]`
   * * data - `[caller: Address]`
   */
  grant_role: ({account, role, caller}: {account: string, role: string, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a revoke_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Revokes a role from an account.
   * To revoke the caller's own role, use
   * [`AccessControl::renounce_role()`] instead.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * * `account` - The account to revoke the role from.
   * * `role` - The role to revoke.
   * * `caller` - The address of the caller, must be the admin or has the
   * `RoleAdmin` for the `role`.
   * 
   * # Errors
   * 
   * * [`AccessControlError::Unauthorized`] - If the `caller` does not have
   * enough privileges.
   * * [`AccessControlError::RoleNotHeld`] - If the `account` doesn't have
   * the role.
   * * [`AccessControlError::RoleIsEmpty`] - If the role has no members.
   * 
   * # Events
   * 
   * * topics - `["role_revoked", role: Symbol, account: Address]`
   * * data - `[caller: Address]`
   */
  revoke_role: ({account, role, caller}: {account: string, role: string, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a renounce_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  renounce_role: ({role, caller}: {role: string, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_role_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the admin role for a specific role.
   * If no admin role is explicitly set, returns `None`.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * * `role` - The role to query the admin role for.
   */
  get_role_admin: ({role}: {role: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a renounce_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Allows the current admin to renounce their role, making the contract
   * permanently admin-less. This is useful for decentralization purposes
   * or when the admin role is no longer needed. Once the admin is
   * renounced, it cannot be reinstated.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * 
   * # Errors
   * 
   * * [`AccessControlError::AdminNotSet`] - If no admin account is set.
   * 
   * # Events
   * 
   * * topics - `["admin_renounced", admin: Address]`
   * * data - `[]`
   * 
   * # Notes
   * 
   * * Authorization for the current admin is required.
   */
  renounce_admin: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_role_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sets `admin_role` as the admin role of `role`.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * * `role` - The role to set the admin for.
   * * `admin_role` - The new admin role.
   * 
   * # Events
   * 
   * * topics - `["role_admin_changed", role: Symbol]`
   * * data - `[previous_admin_role: Symbol, new_admin_role: Symbol]`
   * 
   * # Errors
   * 
   * * [`AccessControlError::AdminNotSet`] - If admin account is not set.
   * 
   * # Notes
   * 
   * * Authorization for the current admin is required.
   */
  set_role_admin: ({role, admin_role}: {role: string, admin_role: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a abort_migration transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  abort_migration: ({operator}: {operator: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a begin_migration transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  begin_migration: ({to_version, operator}: {to_version: u32, operator: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_role_member transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the account at the specified index for a given role.
   * 
   * A function to get all members of a role is not provided because that
   * would be unbounded. To enumerate all members of a role, use
   * [`AccessControl::get_role_member_count()`] to get the total number of
   * members and then use [`AccessControl::get_role_member()`] to retrieve
   * each member one by one.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * * `role` - The role to query.
   * * `index` - The index of the account to retrieve.
   * 
   * # Errors
   * 
   * * [`AccessControlError::IndexOutOfBounds`] - If the index is out of
   * bounds for the role's member list.
   */
  get_role_member: ({role, index}: {role: string, index: u32}, options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a disable_upgrades transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  disable_upgrades: ({operator}: {operator: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a upgrades_enabled transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrades_enabled: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a finalize_migration transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  finalize_migration: ({operator}: {operator: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_existing_roles transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns a vector containing all existing roles.
   * Defaults to empty vector if no roles exist.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * 
   * # Notes
   * 
   * This function returns all roles that currently have at least one member.
   * The maximum number of roles is limited by [`MAX_ROLES`].
   */
  get_existing_roles: (options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a get_migrated_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_migrated_count: (options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a get_schema_version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_schema_version: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_private_address transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_private_address: ({owner}: {owner: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<PrivateAddressRecord>>>

  /**
   * Construct and simulate a transfer_admin_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initiates the admin role transfer.
   * Admin privileges for the current admin are not revoked until the
   * recipient accepts the transfer.
   * Overrides the previous pending transfer if there is one.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * * `new_admin` - The account to transfer the admin privileges to.
   * * `live_until_ledger` - The ledger number at which the pending transfer
   * expires. If `live_until_ledger` is `0`, the pending transfer is
   * cancelled. `live_until_ledger` argument is implicitly bounded by the
   * maximum allowed TTL extension for a temporary storage entry and
   * specifying a higher value will cause the code to panic.
   * 
   * # Errors
   * 
   * * [`crate::role_transfer::RoleTransferError::NoPendingTransfer`] - If
   * trying to cancel a transfer that doesn't exist.
   * * [`crate::role_transfer::RoleTransferError::InvalidLiveUntilLedger`] -
   * If the specified ledger is in the past.
   * * [`crate::role_transfer::RoleTransferError::InvalidPendingAccount`] -
   * If the specified pending account is not the same as the provided `new`
   * address.
   * 
   */
  transfer_admin_role: ({new_admin, live_until_ledger}: {new_admin: string, live_until_ledger: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a seed_private_address transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Migration helper: seed forward and reverse indexes without the
   * private-address owner's auth. Requires the `seed_private_address` role.
   */
  seed_private_address: ({registration, updated_at_ledger, operator}: {registration: PrivateAddressRegistration, updated_at_ledger: u32, operator: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a accept_admin_transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Completes the 2-step admin transfer.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * 
   * # Events
   * 
   * * topics - `["admin_transfer_completed", new_admin: Address]`
   * * data - `[previous_admin: Address]`
   * 
   * # Errors
   * 
   * * [`crate::role_transfer::RoleTransferError::NoPendingTransfer`] - If
   * there is no pending transfer to accept.
   * * [`AccessControlError::AdminNotSet`] - If admin account is not set.
   */
  accept_admin_transfer: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_role_member_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the total number of accounts that have the specified role.
   * If the role does not exist, returns 0.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * * `role` - The role to get the count for.
   */
  get_role_member_count: ({role}: {role: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_owner_by_public_key transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Resolve the Stellar G-address owner from a registered private-address public key.
   */
  get_owner_by_public_key: ({public_key_x, public_key_y}: {public_key_x: Buffer, public_key_y: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a register_private_address transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Owner registers a permanent private address directly.
   * 
   * `signature` is an EdDSA-Poseidon proof of the spend scalar for
   * `(public_key_x, public_key_y)`, bound to `owner` and this contract.
   */
  register_private_address: ({owner, public_key_x, public_key_y, signature}: {owner: string, public_key_x: Buffer, public_key_y: Buffer, signature: PrivateAddressRegistrationSignature}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a migrate_private_addresses transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Copies private-address records for the supplied owners. Missing owners
   * and repeats are no-ops. The stored key is read from the old record, not
   * from the caller.
   */
  migrate_private_addresses: ({owners}: {owners: Array<string>}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

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
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACgAAAEpSZXNlcnZlZDogcm9sZSBjaGVja3MgdXNlIE9wZW5aZXBwZWxpbiBgQWNjZXNzQ29udHJvbEVycm9yYC4gRG8gbm90IHJldXNlLgAAAAAACU9ubHlBZG1pbgAAAAAAAAEAAAA+UmVzZXJ2ZWQ6IHRydXN0ZWQtcG9vbCBjb3VwbGluZyByZW1vdmVkIChOMi9ONikuIERvIG5vdCByZXVzZS4AAAAAAA9VbnRydXN0ZWRDYWxsZXIAAAAAAgAAADhSZXNlcnZlZDogcGVuZGluZy1ub3RlIGluZGV4IHJlbW92ZWQgKE4yKS4gRG8gbm90IHJldXNlLgAAABlEdXBsaWNhdGVQZW5kaW5nTnVsbGlmaWVyAAAAAAAAAwAAADpSZXNlcnZlZDogcGVuZGluZy1ub3RlIHBheWxvYWQgcmVtb3ZlZCAoTTEpLiBEbyBub3QgcmV1c2UuAAAAAAAYRm9yYmlkZGVuRXBoZW1lcmFsU2NhbGFyAAAABAAAADpSZXNlcnZlZDogcGVuZGluZy1ub3RlIHBheWxvYWQgcmVtb3ZlZCAoTjYpLiBEbyBub3QgcmV1c2UuAAAAAAAKRW1wdHlOb3RlcwAAAAAABQAAAH1BIHJlcXVpcmVkIGNvbnN0cnVjdG9yLXNldCBjb25maWcgdmFsdWUgaXMgbWlzc2luZzsgb25seSByZWFjaGFibGUgaWYgdGhlCmNvbnRyYWN0IGlzIHF1ZXJpZWQgYmVmb3JlIGBfX2NvbnN0cnVjdG9yYCBoYXMgcnVuLgAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAABgAAAJJPd25lciBhbHJlYWR5IGhhcyBhIHJlZ2lzdGVyZWQgcHJpdmF0ZSBhZGRyZXNzIHdpdGggYSBkaWZmZXJlbnQgcHVibGljIGtleTsgcHJpdmF0ZQphZGRyZXNzZXMgYXJlIHBlcm1hbmVudCBhbmQgY2Fubm90IGJlIGNoYW5nZWQgb25jZSByZWdpc3RlcmVkLgAAAAAAF1ByaXZhdGVBZGRyZXNzSW1tdXRhYmxlAAAAAAcAAABAVGhlIGdpdmVuIHB1YmxpYyBrZXkgaXMgYWxyZWFkeSByZWdpc3RlcmVkIHRvIGEgZGlmZmVyZW50IG93bmVyLgAAABpQdWJsaWNLZXlBbHJlYWR5UmVnaXN0ZXJlZAAAAAAACAAAAFJBIGNvb3JkaW5hdGUgaXMgbm90IGEgY2Fub25pY2FsIEJOMjU0IHNjYWxhciAoaXQgaXMgZ3JlYXRlciB0aGFuIG9yIGVxdWFsIHRvIGByYCkuAAAAAAAYSW52YWxpZFByaXZhdGVBZGRyZXNzS2V5AAAACQAAAFhUaGUgRWREU0EtUG9zZWlkb24gc2lnbmF0dXJlIGRvZXMgbm90IHByb3ZlIGtub3dsZWRnZSBvZiB0aGlzIHB1YmxpYyBrZXkgZm9yIHRoaXMgb3duZXIuAAAAHEludmFsaWRSZWdpc3RyYXRpb25TaWduYXR1cmUAAAAK",
        "AAAAAAAAALxSZXBsYWNlcyB0aGlzIGNvbnRyYWN0J3MgV0FTTS4gV2hlbiBgc3RhcnRfbWlncmF0aW9uYCBpcyBzZXQsIHRoZSBzYW1lCmNhbGwgb3BlbnMgYSBtaWdyYXRpb24gdG8gdGhlIG5leHQgc2NoZW1hIHZlcnNpb24gYmVmb3JlIHRoZSBuZXcgY29kZQppcyBzY2hlZHVsZWQuIFRoZSBgdXBncmFkZWAgcm9sZSBpcyBzdWZmaWNpZW50LgAAAAd1cGdyYWRlAAAAAAMAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAAAAAAPc3RhcnRfbWlncmF0aW9uAAAAAAEAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAA=",
        "AAAAAAAAAXJSZXR1cm5zIGBTb21lKGluZGV4KWAgaWYgdGhlIGFjY291bnQgaGFzIHRoZSBzcGVjaWZpZWQgcm9sZSwKd2hlcmUgYGluZGV4YCBpcyB0aGUgcG9zaXRpb24gb2YgdGhlIGFjY291bnQgZm9yIHRoYXQgcm9sZSwKYW5kIGNhbiBiZSB1c2VkIHRvIHF1ZXJ5IFtgQWNjZXNzQ29udHJvbDo6Z2V0X3JvbGVfbWVtYmVyKClgXS4KUmV0dXJucyBgTm9uZWAgaWYgdGhlIGFjY291bnQgZG9lcyBub3QgaGF2ZSB0aGUgc3BlY2lmaWVkIHJvbGUuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWNjb3VudCB0byBjaGVjay4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byBjaGVjayBmb3IuAAAAAAAIaGFzX3JvbGUAAAACAAAAAAAAAAdhY2NvdW50AAAAABMAAAAAAAAABHJvbGUAAAARAAAAAQAAA+gAAAAE",
        "AAAAAAAAAE9SZXR1cm5zIHRoZSBhZG1pbiBhY2NvdW50LgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuAAAAAAlnZXRfYWRtaW4AAAAAAAAAAAAAAQAAA+gAAAAT",
        "AAAABQAAAOhFbWl0dGVkIGJ5IFtgUHJpdmF0ZUFkZHJlc3NSZWdpc3RyeTo6dXBzZXJ0X3ByaXZhdGVfYWRkcmVzc19yZWNvcmRgXSAob3duZXIgc2VsZi1yZWdpc3RyYXRpb24KdmlhIFtgUHJpdmF0ZUFkZHJlc3NSZWdpc3RyeTo6cmVnaXN0ZXJfcHJpdmF0ZV9hZGRyZXNzYF0sIG9yIHRoZSBhZG1pbiBtaWdyYXRpb24gaGVscGVyCltgUHJpdmF0ZUFkZHJlc3NSZWdpc3RyeTo6c2VlZF9wcml2YXRlX2FkZHJlc3NgXSkuAAAAAAAAABhQcml2YXRlQWRkcmVzc1JlZ2lzdGVyZWQAAAACAAAAD3ByaXZhdGVfYWRkcmVzcwAAAAAKcmVnaXN0ZXJlZAAAAAAAAQAAAAAAAAAFb3duZXIAAAAAAAATAAAAAQAAAAA=",
        "AAAAAAAAAj5HcmFudHMgYSByb2xlIHRvIGFuIGFjY291bnQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWNjb3VudCB0byBncmFudCB0aGUgcm9sZSB0by4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byBncmFudC4KKiBgY2FsbGVyYCAtIFRoZSBhZGRyZXNzIG9mIHRoZSBjYWxsZXIsIG11c3QgYmUgdGhlIGFkbWluIG9yIGhhdmUgdGhlCmBSb2xlQWRtaW5gIGZvciB0aGUgYHJvbGVgLgoKIyBFcnJvcnMKCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlVuYXV0aG9yaXplZGBdIC0gSWYgdGhlIGNhbGxlciBkb2VzIG5vdCBoYXZlCmVub3VnaCBwcml2aWxlZ2VzLgoqIFtgQWNjZXNzQ29udHJvbEVycm9yOjpNYXhSb2xlc0V4Y2VlZGVkYF0gLSBJZiBhZGRpbmcgYSBuZXcgcm9sZSB3b3VsZApleGNlZWQgdGhlIG1heGltdW0gYWxsb3dlZCBudW1iZXIgb2Ygcm9sZXMuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJyb2xlX2dyYW50ZWQiLCByb2xlOiBTeW1ib2wsIGFjY291bnQ6IEFkZHJlc3NdYAoqIGRhdGEgLSBgW2NhbGxlcjogQWRkcmVzc11gAAAAAAAKZ3JhbnRfcm9sZQAAAAAAAwAAAAAAAAAHYWNjb3VudAAAAAATAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAArdSZXZva2VzIGEgcm9sZSBmcm9tIGFuIGFjY291bnQuClRvIHJldm9rZSB0aGUgY2FsbGVyJ3Mgb3duIHJvbGUsIHVzZQpbYEFjY2Vzc0NvbnRyb2w6OnJlbm91bmNlX3JvbGUoKWBdIGluc3RlYWQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWNjb3VudCB0byByZXZva2UgdGhlIHJvbGUgZnJvbS4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byByZXZva2UuCiogYGNhbGxlcmAgLSBUaGUgYWRkcmVzcyBvZiB0aGUgY2FsbGVyLCBtdXN0IGJlIHRoZSBhZG1pbiBvciBoYXMgdGhlCmBSb2xlQWRtaW5gIGZvciB0aGUgYHJvbGVgLgoKIyBFcnJvcnMKCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlVuYXV0aG9yaXplZGBdIC0gSWYgdGhlIGBjYWxsZXJgIGRvZXMgbm90IGhhdmUKZW5vdWdoIHByaXZpbGVnZXMuCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlJvbGVOb3RIZWxkYF0gLSBJZiB0aGUgYGFjY291bnRgIGRvZXNuJ3QgaGF2ZQp0aGUgcm9sZS4KKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6Um9sZUlzRW1wdHlgXSAtIElmIHRoZSByb2xlIGhhcyBubyBtZW1iZXJzLgoKIyBFdmVudHMKCiogdG9waWNzIC0gYFsicm9sZV9yZXZva2VkIiwgcm9sZTogU3ltYm9sLCBhY2NvdW50OiBBZGRyZXNzXWAKKiBkYXRhIC0gYFtjYWxsZXI6IEFkZHJlc3NdYAAAAAALcmV2b2tlX3JvbGUAAAAAAwAAAAAAAAAHYWNjb3VudAAAAAATAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAANcmVub3VuY2Vfcm9sZQAAAAAAAAIAAAAAAAAABHJvbGUAAAARAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAAMVSZXR1cm5zIHRoZSBhZG1pbiByb2xlIGZvciBhIHNwZWNpZmljIHJvbGUuCklmIG5vIGFkbWluIHJvbGUgaXMgZXhwbGljaXRseSBzZXQsIHJldHVybnMgYE5vbmVgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHJvbGVgIC0gVGhlIHJvbGUgdG8gcXVlcnkgdGhlIGFkbWluIHJvbGUgZm9yLgAAAAAAAA5nZXRfcm9sZV9hZG1pbgAAAAAAAQAAAAAAAAAEcm9sZQAAABEAAAABAAAD6AAAABE=",
        "AAAAAAAAAfZBbGxvd3MgdGhlIGN1cnJlbnQgYWRtaW4gdG8gcmVub3VuY2UgdGhlaXIgcm9sZSwgbWFraW5nIHRoZSBjb250cmFjdApwZXJtYW5lbnRseSBhZG1pbi1sZXNzLiBUaGlzIGlzIHVzZWZ1bCBmb3IgZGVjZW50cmFsaXphdGlvbiBwdXJwb3NlcwpvciB3aGVuIHRoZSBhZG1pbiByb2xlIGlzIG5vIGxvbmdlciBuZWVkZWQuIE9uY2UgdGhlIGFkbWluIGlzCnJlbm91bmNlZCwgaXQgY2Fubm90IGJlIHJlaW5zdGF0ZWQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KCiMgRXJyb3JzCgoqIFtgQWNjZXNzQ29udHJvbEVycm9yOjpBZG1pbk5vdFNldGBdIC0gSWYgbm8gYWRtaW4gYWNjb3VudCBpcyBzZXQuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJhZG1pbl9yZW5vdW5jZWQiLCBhZG1pbjogQWRkcmVzc11gCiogZGF0YSAtIGBbXWAKCiMgTm90ZXMKCiogQXV0aG9yaXphdGlvbiBmb3IgdGhlIGN1cnJlbnQgYWRtaW4gaXMgcmVxdWlyZWQuAAAAAAAOcmVub3VuY2VfYWRtaW4AAAAAAAAAAAAA",
        "AAAAAAAAAb1TZXRzIGBhZG1pbl9yb2xlYCBhcyB0aGUgYWRtaW4gcm9sZSBvZiBgcm9sZWAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byBzZXQgdGhlIGFkbWluIGZvci4KKiBgYWRtaW5fcm9sZWAgLSBUaGUgbmV3IGFkbWluIHJvbGUuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJyb2xlX2FkbWluX2NoYW5nZWQiLCByb2xlOiBTeW1ib2xdYAoqIGRhdGEgLSBgW3ByZXZpb3VzX2FkbWluX3JvbGU6IFN5bWJvbCwgbmV3X2FkbWluX3JvbGU6IFN5bWJvbF1gCgojIEVycm9ycwoKKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6QWRtaW5Ob3RTZXRgXSAtIElmIGFkbWluIGFjY291bnQgaXMgbm90IHNldC4KCiMgTm90ZXMKCiogQXV0aG9yaXphdGlvbiBmb3IgdGhlIGN1cnJlbnQgYWRtaW4gaXMgcmVxdWlyZWQuAAAAAAAADnNldF9yb2xlX2FkbWluAAAAAAACAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAKYWRtaW5fcm9sZQAAAAAAEQAAAAA=",
        "AAAAAAAAAAAAAAAPYWJvcnRfbWlncmF0aW9uAAAAAAEAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAPYmVnaW5fbWlncmF0aW9uAAAAAAIAAAAAAAAACnRvX3ZlcnNpb24AAAAAAAQAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAA=",
        "AAAAAAAAAllSZXR1cm5zIHRoZSBhY2NvdW50IGF0IHRoZSBzcGVjaWZpZWQgaW5kZXggZm9yIGEgZ2l2ZW4gcm9sZS4KCkEgZnVuY3Rpb24gdG8gZ2V0IGFsbCBtZW1iZXJzIG9mIGEgcm9sZSBpcyBub3QgcHJvdmlkZWQgYmVjYXVzZSB0aGF0CndvdWxkIGJlIHVuYm91bmRlZC4gVG8gZW51bWVyYXRlIGFsbCBtZW1iZXJzIG9mIGEgcm9sZSwgdXNlCltgQWNjZXNzQ29udHJvbDo6Z2V0X3JvbGVfbWVtYmVyX2NvdW50KClgXSB0byBnZXQgdGhlIHRvdGFsIG51bWJlciBvZgptZW1iZXJzIGFuZCB0aGVuIHVzZSBbYEFjY2Vzc0NvbnRyb2w6OmdldF9yb2xlX21lbWJlcigpYF0gdG8gcmV0cmlldmUKZWFjaCBtZW1iZXIgb25lIGJ5IG9uZS4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgoqIGByb2xlYCAtIFRoZSByb2xlIHRvIHF1ZXJ5LgoqIGBpbmRleGAgLSBUaGUgaW5kZXggb2YgdGhlIGFjY291bnQgdG8gcmV0cmlldmUuCgojIEVycm9ycwoKKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6SW5kZXhPdXRPZkJvdW5kc2BdIC0gSWYgdGhlIGluZGV4IGlzIG91dCBvZgpib3VuZHMgZm9yIHRoZSByb2xlJ3MgbWVtYmVyIGxpc3QuAAAAAAAAD2dldF9yb2xlX21lbWJlcgAAAAACAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAFaW5kZXgAAAAAAAAEAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAQZGlzYWJsZV91cGdyYWRlcwAAAAEAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAQdXBncmFkZXNfZW5hYmxlZAAAAAAAAAABAAAAAQ==",
        "AAAAAAAAAAAAAAASZmluYWxpemVfbWlncmF0aW9uAAAAAAABAAAAAAAAAAhvcGVyYXRvcgAAABMAAAAA",
        "AAAAAAAAARxSZXR1cm5zIGEgdmVjdG9yIGNvbnRhaW5pbmcgYWxsIGV4aXN0aW5nIHJvbGVzLgpEZWZhdWx0cyB0byBlbXB0eSB2ZWN0b3IgaWYgbm8gcm9sZXMgZXhpc3QuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KCiMgTm90ZXMKClRoaXMgZnVuY3Rpb24gcmV0dXJucyBhbGwgcm9sZXMgdGhhdCBjdXJyZW50bHkgaGF2ZSBhdCBsZWFzdCBvbmUgbWVtYmVyLgpUaGUgbWF4aW11bSBudW1iZXIgb2Ygcm9sZXMgaXMgbGltaXRlZCBieSBbYE1BWF9ST0xFU2BdLgAAABJnZXRfZXhpc3Rpbmdfcm9sZXMAAAAAAAAAAAABAAAD6gAAABE=",
        "AAAAAAAAAAAAAAASZ2V0X21pZ3JhdGVkX2NvdW50AAAAAAAAAAAAAQAAAAY=",
        "AAAAAAAAAAAAAAASZ2V0X3NjaGVtYV92ZXJzaW9uAAAAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAATZ2V0X3ByaXZhdGVfYWRkcmVzcwAAAAABAAAAAAAAAAVvd25lcgAAAAAAABMAAAABAAAD6AAAB9AAAAAUUHJpdmF0ZUFkZHJlc3NSZWNvcmQ=",
        "AAAAAAAABABJbml0aWF0ZXMgdGhlIGFkbWluIHJvbGUgdHJhbnNmZXIuCkFkbWluIHByaXZpbGVnZXMgZm9yIHRoZSBjdXJyZW50IGFkbWluIGFyZSBub3QgcmV2b2tlZCB1bnRpbCB0aGUKcmVjaXBpZW50IGFjY2VwdHMgdGhlIHRyYW5zZmVyLgpPdmVycmlkZXMgdGhlIHByZXZpb3VzIHBlbmRpbmcgdHJhbnNmZXIgaWYgdGhlcmUgaXMgb25lLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYG5ld19hZG1pbmAgLSBUaGUgYWNjb3VudCB0byB0cmFuc2ZlciB0aGUgYWRtaW4gcHJpdmlsZWdlcyB0by4KKiBgbGl2ZV91bnRpbF9sZWRnZXJgIC0gVGhlIGxlZGdlciBudW1iZXIgYXQgd2hpY2ggdGhlIHBlbmRpbmcgdHJhbnNmZXIKZXhwaXJlcy4gSWYgYGxpdmVfdW50aWxfbGVkZ2VyYCBpcyBgMGAsIHRoZSBwZW5kaW5nIHRyYW5zZmVyIGlzCmNhbmNlbGxlZC4gYGxpdmVfdW50aWxfbGVkZ2VyYCBhcmd1bWVudCBpcyBpbXBsaWNpdGx5IGJvdW5kZWQgYnkgdGhlCm1heGltdW0gYWxsb3dlZCBUVEwgZXh0ZW5zaW9uIGZvciBhIHRlbXBvcmFyeSBzdG9yYWdlIGVudHJ5IGFuZApzcGVjaWZ5aW5nIGEgaGlnaGVyIHZhbHVlIHdpbGwgY2F1c2UgdGhlIGNvZGUgdG8gcGFuaWMuCgojIEVycm9ycwoKKiBbYGNyYXRlOjpyb2xlX3RyYW5zZmVyOjpSb2xlVHJhbnNmZXJFcnJvcjo6Tm9QZW5kaW5nVHJhbnNmZXJgXSAtIElmCnRyeWluZyB0byBjYW5jZWwgYSB0cmFuc2ZlciB0aGF0IGRvZXNuJ3QgZXhpc3QuCiogW2BjcmF0ZTo6cm9sZV90cmFuc2Zlcjo6Um9sZVRyYW5zZmVyRXJyb3I6OkludmFsaWRMaXZlVW50aWxMZWRnZXJgXSAtCklmIHRoZSBzcGVjaWZpZWQgbGVkZ2VyIGlzIGluIHRoZSBwYXN0LgoqIFtgY3JhdGU6OnJvbGVfdHJhbnNmZXI6OlJvbGVUcmFuc2ZlckVycm9yOjpJbnZhbGlkUGVuZGluZ0FjY291bnRgXSAtCklmIHRoZSBzcGVjaWZpZWQgcGVuZGluZyBhY2NvdW50IGlzIG5vdCB0aGUgc2FtZSBhcyB0aGUgcHJvdmlkZWQgYG5ld2AKYWRkcmVzcy4KAAAAE3RyYW5zZmVyX2FkbWluX3JvbGUAAAAAAgAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAAAAAARbGl2ZV91bnRpbF9sZWRnZXIAAAAAAAAEAAAAAA==",
        "AAAAAAAAAIZNaWdyYXRpb24gaGVscGVyOiBzZWVkIGZvcndhcmQgYW5kIHJldmVyc2UgaW5kZXhlcyB3aXRob3V0IHRoZQpwcml2YXRlLWFkZHJlc3Mgb3duZXIncyBhdXRoLiBSZXF1aXJlcyB0aGUgYHNlZWRfcHJpdmF0ZV9hZGRyZXNzYCByb2xlLgAAAAAAFHNlZWRfcHJpdmF0ZV9hZGRyZXNzAAAAAwAAAAAAAAAMcmVnaXN0cmF0aW9uAAAH0AAAABpQcml2YXRlQWRkcmVzc1JlZ2lzdHJhdGlvbgAAAAAAAAAAABF1cGRhdGVkX2F0X2xlZGdlcgAAAAAAAAQAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAA=",
        "AAAAAAAAAYVDb21wbGV0ZXMgdGhlIDItc3RlcCBhZG1pbiB0cmFuc2Zlci4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgoKIyBFdmVudHMKCiogdG9waWNzIC0gYFsiYWRtaW5fdHJhbnNmZXJfY29tcGxldGVkIiwgbmV3X2FkbWluOiBBZGRyZXNzXWAKKiBkYXRhIC0gYFtwcmV2aW91c19hZG1pbjogQWRkcmVzc11gCgojIEVycm9ycwoKKiBbYGNyYXRlOjpyb2xlX3RyYW5zZmVyOjpSb2xlVHJhbnNmZXJFcnJvcjo6Tm9QZW5kaW5nVHJhbnNmZXJgXSAtIElmCnRoZXJlIGlzIG5vIHBlbmRpbmcgdHJhbnNmZXIgdG8gYWNjZXB0LgoqIFtgQWNjZXNzQ29udHJvbEVycm9yOjpBZG1pbk5vdFNldGBdIC0gSWYgYWRtaW4gYWNjb3VudCBpcyBub3Qgc2V0LgAAAAAAABVhY2NlcHRfYWRtaW5fdHJhbnNmZXIAAAAAAAAAAAAAAA==",
        "AAAAAAAAAMhSZXR1cm5zIHRoZSB0b3RhbCBudW1iZXIgb2YgYWNjb3VudHMgdGhhdCBoYXZlIHRoZSBzcGVjaWZpZWQgcm9sZS4KSWYgdGhlIHJvbGUgZG9lcyBub3QgZXhpc3QsIHJldHVybnMgMC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgoqIGByb2xlYCAtIFRoZSByb2xlIHRvIGdldCB0aGUgY291bnQgZm9yLgAAABVnZXRfcm9sZV9tZW1iZXJfY291bnQAAAAAAAABAAAAAAAAAARyb2xlAAAAEQAAAAEAAAAE",
        "AAAAAAAAAFFSZXNvbHZlIHRoZSBTdGVsbGFyIEctYWRkcmVzcyBvd25lciBmcm9tIGEgcmVnaXN0ZXJlZCBwcml2YXRlLWFkZHJlc3MgcHVibGljIGtleS4AAAAAAAAXZ2V0X293bmVyX2J5X3B1YmxpY19rZXkAAAAAAgAAAAAAAAAMcHVibGljX2tleV94AAAD7gAAACAAAAAAAAAADHB1YmxpY19rZXlfeQAAA+4AAAAgAAAAAQAAA+gAAAAT",
        "AAAAAAAAALlPd25lciByZWdpc3RlcnMgYSBwZXJtYW5lbnQgcHJpdmF0ZSBhZGRyZXNzIGRpcmVjdGx5LgoKYHNpZ25hdHVyZWAgaXMgYW4gRWREU0EtUG9zZWlkb24gcHJvb2Ygb2YgdGhlIHNwZW5kIHNjYWxhciBmb3IKYChwdWJsaWNfa2V5X3gsIHB1YmxpY19rZXlfeSlgLCBib3VuZCB0byBgb3duZXJgIGFuZCB0aGlzIGNvbnRyYWN0LgAAAAAAABhyZWdpc3Rlcl9wcml2YXRlX2FkZHJlc3MAAAAEAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAADHB1YmxpY19rZXlfeAAAA+4AAAAgAAAAAAAAAAxwdWJsaWNfa2V5X3kAAAPuAAAAIAAAAAAAAAAJc2lnbmF0dXJlAAAAAAAH0AAAACNQcml2YXRlQWRkcmVzc1JlZ2lzdHJhdGlvblNpZ25hdHVyZQAAAAAA",
        "AAAAAAAAAJ9Db3BpZXMgcHJpdmF0ZS1hZGRyZXNzIHJlY29yZHMgZm9yIHRoZSBzdXBwbGllZCBvd25lcnMuIE1pc3Npbmcgb3duZXJzCmFuZCByZXBlYXRzIGFyZSBuby1vcHMuIFRoZSBzdG9yZWQga2V5IGlzIHJlYWQgZnJvbSB0aGUgb2xkIHJlY29yZCwgbm90CmZyb20gdGhlIGNhbGxlci4AAAAAGW1pZ3JhdGVfcHJpdmF0ZV9hZGRyZXNzZXMAAAAAAAABAAAAAAAAAAZvd25lcnMAAAAAA+oAAAATAAAAAQAAAAQ=",
        "AAAAAQAAAAAAAAAAAAAAFFByaXZhdGVBZGRyZXNzUmVjb3JkAAAABAAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAxwdWJsaWNfa2V5X3gAAAPuAAAAIAAAAAAAAAAMcHVibGljX2tleV95AAAD7gAAACAAAAAAAAAAEXVwZGF0ZWRfYXRfbGVkZ2VyAAAAAAAABA==",
        "AAAAAQAAAAAAAAAAAAAAGlByaXZhdGVBZGRyZXNzUmVnaXN0cmF0aW9uAAAAAAADAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAADHB1YmxpY19rZXlfeAAAA+4AAAAgAAAAAAAAAAxwdWJsaWNfa2V5X3kAAAPuAAAAIA==",
        "AAAAAQAAAFhFZERTQS1Qb3NlaWRvbiBzaWduYXR1cmUgb2YgdGhlIHJlZ2lzdHJ5IGJpbmRpbmcgdW5kZXIgdGhlIHByaXZhdGUtYWRkcmVzcyBzcGVuZCBzY2FsYXIuAAAAAAAAACNQcml2YXRlQWRkcmVzc1JlZ2lzdHJhdGlvblNpZ25hdHVyZQAAAAADAAAAAAAAAARyOF94AAAD7gAAACAAAAAAAAAABHI4X3kAAAPuAAAAIAAAAAAAAAABcwAAAAAAA+4AAAAg",
        "AAAABAAAAAAAAAAAAAAADFVwZ3JhZGVFcnJvcgAAAAcAAAAAAAAAEFVwZ3JhZGVzRGlzYWJsZWQAAAu5AAAAAAAAABNNaWdyYXRpb25JblByb2dyZXNzAAAAC7oAAAAAAAAAEk1pZ3JhdGlvbk5vdEFjdGl2ZQAAAAALuwAAAAAAAAATTWlncmF0aW9uSW5jb21wbGV0ZQAAAAu8AAAAAAAAABVNaWdyYXRpb25Sb290TWlzbWF0Y2gAAAAAAAu9AAAAAAAAABdJbnZhbGlkTWlncmF0aW9uVmVyc2lvbgAAAAu+AAAAAAAAABdSZW5vdW5jZUR1cmluZ01pZ3JhdGlvbgAAAAu/",
        "AAAABAAAAAAAAAAAAAAAEVJvbGVUcmFuc2ZlckVycm9yAAAAAAAABAAAAAAAAAARTm9QZW5kaW5nVHJhbnNmZXIAAAAAAAiYAAAAAAAAABZJbnZhbGlkTGl2ZVVudGlsTGVkZ2VyAAAAAAiZAAAAAAAAABVJbnZhbGlkUGVuZGluZ0FjY291bnQAAAAAAAiaAAAAAAAAAA9UcmFuc2ZlckV4cGlyZWQAAAAImw==",
        "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gYSByb2xlIGlzIGdyYW50ZWQuAAAAAAAAAAAAAAtSb2xlR3JhbnRlZAAAAAABAAAADHJvbGVfZ3JhbnRlZAAAAAMAAAAAAAAABHJvbGUAAAARAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAI=",
        "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gYSByb2xlIGlzIHJldm9rZWQuAAAAAAAAAAAAAAtSb2xlUmV2b2tlZAAAAAABAAAADHJvbGVfcmV2b2tlZAAAAAMAAAAAAAAABHJvbGUAAAARAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAI=",
        "AAAABQAAAC9FdmVudCBlbWl0dGVkIHdoZW4gdGhlIGFkbWluIHJvbGUgaXMgcmVub3VuY2VkLgAAAAAAAAAADkFkbWluUmVub3VuY2VkAAAAAAABAAAAD2FkbWluX3Jlbm91bmNlZAAAAAABAAAAAAAAAAVhZG1pbgAAAAAAABMAAAABAAAAAg==",
        "AAAABQAAACtFdmVudCBlbWl0dGVkIHdoZW4gYSByb2xlIGFkbWluIGlzIGNoYW5nZWQuAAAAAAAAAAAQUm9sZUFkbWluQ2hhbmdlZAAAAAEAAAAScm9sZV9hZG1pbl9jaGFuZ2VkAAAAAAADAAAAAAAAAARyb2xlAAAAEQAAAAEAAAAAAAAAE3ByZXZpb3VzX2FkbWluX3JvbGUAAAAAEQAAAAAAAAAAAAAADm5ld19hZG1pbl9yb2xlAAAAAAARAAAAAAAAAAI=",
        "AAAABAAAAAAAAAAAAAAAEkFjY2Vzc0NvbnRyb2xFcnJvcgAAAAAACwAAAAAAAAAMVW5hdXRob3JpemVkAAAH0AAAAAAAAAALQWRtaW5Ob3RTZXQAAAAH0QAAAAAAAAAQSW5kZXhPdXRPZkJvdW5kcwAAB9IAAAAAAAAAEUFkbWluUm9sZU5vdEZvdW5kAAAAAAAH0wAAAAAAAAASUm9sZUNvdW50SXNOb3RaZXJvAAAAAAfUAAAAAAAAAAxSb2xlTm90Rm91bmQAAAfVAAAAAAAAAA9BZG1pbkFscmVhZHlTZXQAAAAH1gAAAAAAAAALUm9sZU5vdEhlbGQAAAAH1wAAAAAAAAALUm9sZUlzRW1wdHkAAAAH2AAAAAAAAAASVHJhbnNmZXJJblByb2dyZXNzAAAAAAfZAAAAAAAAABBNYXhSb2xlc0V4Y2VlZGVkAAAH2g==",
        "AAAABQAAADJFdmVudCBlbWl0dGVkIHdoZW4gYW4gYWRtaW4gdHJhbnNmZXIgaXMgY29tcGxldGVkLgAAAAAAAAAAABZBZG1pblRyYW5zZmVyQ29tcGxldGVkAAAAAAABAAAAGGFkbWluX3RyYW5zZmVyX2NvbXBsZXRlZAAAAAIAAAAAAAAACW5ld19hZG1pbgAAAAAAABMAAAABAAAAAAAAAA5wcmV2aW91c19hZG1pbgAAAAAAEwAAAAAAAAAC",
        "AAAABQAAADJFdmVudCBlbWl0dGVkIHdoZW4gYW4gYWRtaW4gdHJhbnNmZXIgaXMgaW5pdGlhdGVkLgAAAAAAAAAAABZBZG1pblRyYW5zZmVySW5pdGlhdGVkAAAAAAABAAAAGGFkbWluX3RyYW5zZmVyX2luaXRpYXRlZAAAAAMAAAAAAAAADWN1cnJlbnRfYWRtaW4AAAAAAAATAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAAAAAAAAAAAEWxpdmVfdW50aWxfbGVkZ2VyAAAAAAAABAAAAAAAAAAC" ]),
      options
    )
  }
  public readonly fromJSON = {
    upgrade: this.txFromJSON<null>,
        has_role: this.txFromJSON<Option<u32>>,
        get_admin: this.txFromJSON<Option<string>>,
        grant_role: this.txFromJSON<null>,
        revoke_role: this.txFromJSON<null>,
        renounce_role: this.txFromJSON<null>,
        get_role_admin: this.txFromJSON<Option<string>>,
        renounce_admin: this.txFromJSON<null>,
        set_role_admin: this.txFromJSON<null>,
        abort_migration: this.txFromJSON<null>,
        begin_migration: this.txFromJSON<null>,
        get_role_member: this.txFromJSON<string>,
        disable_upgrades: this.txFromJSON<null>,
        upgrades_enabled: this.txFromJSON<boolean>,
        finalize_migration: this.txFromJSON<null>,
        get_existing_roles: this.txFromJSON<Array<string>>,
        get_migrated_count: this.txFromJSON<u64>,
        get_schema_version: this.txFromJSON<u32>,
        get_private_address: this.txFromJSON<Option<PrivateAddressRecord>>,
        transfer_admin_role: this.txFromJSON<null>,
        seed_private_address: this.txFromJSON<null>,
        accept_admin_transfer: this.txFromJSON<null>,
        get_role_member_count: this.txFromJSON<u32>,
        get_owner_by_public_key: this.txFromJSON<Option<string>>,
        register_private_address: this.txFromJSON<null>,
        migrate_private_addresses: this.txFromJSON<u32>
  }
}