import { Buffer } from 'buffer';
import { Address } from '@stellar/stellar-sdk';
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from '@stellar/stellar-sdk/contract';
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
} from '@stellar/stellar-sdk/contract';
export * from '@stellar/stellar-sdk';
export * as contract from '@stellar/stellar-sdk/contract';
export * as rpc from '@stellar/stellar-sdk/rpc';

if (typeof window !== 'undefined') {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}

export const Errors = {
  1: { message: 'NullifierUsed' },
  2: { message: 'InsufficientBalance' },
  3: { message: 'ProofVerificationFailed' },
  4: { message: 'OnlyAdmin' },
  5: { message: 'TreeAtCapacity' },
  6: { message: 'AssociationRootMismatch' },
  7: { message: 'InvalidPublicSignals' },
  8: { message: 'InvalidTokenAmount' },
  /**
   * Proof `state_root` is not in the recent root history window.
   */
  9: { message: 'UnknownRoot' },
  /**
   * Exactly one output commitment is non-zero; only zero/zero or two non-zero outputs are allowed.
   */
  10: { message: 'InvalidCommitmentPair' },
  /**
   * Stored Merkle frontier length does not match tree depth (corrupt or outdated storage layout).
   */
  11: { message: 'InvalidMerkleFrontier' },
  /**
   * KYT passage registry is not configured (required for the current layout).
   */
  12: { message: 'KytRegistryMissing' },
  /**
   * Reserved (H1): on-chain application audit-key allowlist removed. Do not reuse.
   */
  13: { message: 'UnknownAuditPublicKey' },
  /**
   * Reserved (H1): on-chain application audit-key allowlist removed. Do not reuse.
   */
  14: { message: 'InvalidAuditPublicKey' },
  /**
   * No `ZkConfig` is registered for the requested nonce.
   */
  15: { message: 'ZkConfigNotFound' },
  /**
   * The `ZkConfig` for the requested nonce has been deprecated by the admin.
   */
  16: { message: 'ZkConfigDeprecated' },
  /**
   * `add_zk_config` was called with a `nonce` that already has a config registered.
   */
  17: { message: 'ZkConfigAlreadyExists' },
  /**
   * `add_zk_config` shape parameters are inconsistent (odd `n_outs`, insufficient
   * `n_audit_slots`, an `audit_offset`/`output_note_offset` that doesn't match the
   * formula-derived value, or a VK whose `ic` length doesn't match the shape).
   */
  18: { message: 'InvalidZkConfig' },
  /**
   * `__constructor` was called with `tree_depth > MAX_TREE_DEPTH`.
   */
  19: { message: 'InvalidTreeDepth' },
  /**
   * Duplicate nullifier hashes appear in a single `transact` public-signal vector (C3).
   */
  20: { message: 'DuplicateNullifier' },
  /**
   * Calldata escrow recipient does not match the public-signal escrow limbs.
   */
  21: { message: 'EscrowRecipientMismatch' },
  /**
   * A sweep (non-zero public escrow recipient) requires a registry record for that account.
   */
  22: { message: 'SweepRequiresRegisteredRecipient' },
};

/**
 * Admin-managed, nonce-keyed ZK circuit configuration: verification key plus every dynamic
 * shape parameter of the `Transaction(...)` circuit instantiation used to verify a `transact`
 * call for that nonce (see `circuits/main.circom` / `libs/zk::ZkLayoutParams`).
 */
export interface ZkConfig {
  audit_offset: u32;
  deprecated: boolean;
  n_audit_slots: u32;
  n_ins: u32;
  n_outs: u32;
  note_audit_len: u32;
  note_output_len: u32;
  output_note_offset: u32;
  public_n_inputs: u32;
  public_n_outputs: u32;
  vk_bytes: Buffer;
}

/**
 * Storage key for tree leaves — each leaf stored by index for O(1) write on deposit.
 */
export type TreeDataKey =
  | { tag: 'Leaf'; values: readonly [u32] }
  | { tag: 'LeafCount'; values: void }
  | { tag: 'LeafEphemeral'; values: readonly [u32] }
  | { tag: 'PairwiseFrontier'; values: void };

/**
 * Persistent storage key for the per-nonce [`ZkConfig`] registry.
 */
export type ZkConfigKey = { tag: 'Config'; values: readonly [u64] };

/**
 * Ring buffer of historical Merkle roots (for proofs generated against recent states).
 */
export type RootHistoryKey =
  { tag: 'CurrentRootIndex'; values: void } | { tag: 'Root'; values: readonly [u32] };

/**
 * Storage key for nullifiers — each nullifier hash maps to bool (consumed or not).
 */
export type NulifierDataKey = { tag: 'Nulifier'; values: readonly [Buffer] };

/**
 * Ephemeral BabyJubJub / ECDH point (not hashed into the Merkle tree).
 */
export interface EphemeralKeyCoords {
  x: Buffer;
  y: Buffer;
}

export interface AuditSlotEventPayload {
  ciphertext: Buffer;
  ephemeral_x: Buffer;
  ephemeral_y: Buffer;
  tag: Buffer;
}

export interface OutputNoteEventPayload {
  ciphertext: Buffer;
  ephemeral_x: Buffer;
  ephemeral_y: Buffer;
  output_index: u32;
  tag: Buffer;
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

export interface NoteOpening {
  value: Buffer;
  secret: Buffer;
  nullifier: Buffer;
  owner_pub_x: Buffer;
  owner_pub_y: Buffer;
  owner_mode: Buffer;
  asset_hi: Buffer;
  asset_lo: Buffer;
  application_id: Buffer;
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

export const Groth16Error = {
  0: { message: 'MalformedVerifyingKey' },
  /**
   * `Proof::from_bytes` received a `proof_bytes` argument that is too short (or otherwise
   * fails to parse as `a || b || c`) for the fixed G1/G2 encoding lengths.
   */
  1: { message: 'MalformedProof' },
  /**
   * `PublicSignals::from_bytes` received a length prefix that does not match the remaining
   * payload (too short, truncated Fr limbs, or a claimed length that overflows).
   */
  2: { message: 'MalformedPublicSignals' },
};

export interface Client {
  /**
   * Construct and simulate a transact transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Single entrypoint: verifies `circuits/main.circom` Groth16 proof and public signals, checks
   * tree root and nullifiers, appends new output commitments (with ephemeral keys, not in Merkle),
   * then applies public token deposits / withdrawals: `publicDepositedAssets` + `publicDeposits`
   * pull from `from`, and `publicWithdrawnAssets` + `publicWithdrawals` send to the Stellar
   * account from `withdrawAddressHi` / `withdrawAddressLo`.
   *
   * The proof-bound escrow recipient reconstructed from public signals is the only
   * authorization subject. Both limbs zero means a non-sweep: both sweep output owner
   * coordinates must also be zero. A nonzero pair is a sweep: that account must
   * `require_auth()` (host account credentials, so multisig and rotated signers work; a
   * revoked key cannot), must already have a private address in the registry, and both
   * sweep output owner coordinates must equal that registry key.
   *
   * Asset ids: Stellar **contract** token `C...` addresses encoded as two field elements (same 32-byte
   * split as account keys — see `cir
   */
  transact: (
    {
      from,
      nonce,
      proof_bytes,
      pub_signals_bytes,
      ciphertext_bytes,
      kyt_authorization,
    }: {
      from: string;
      nonce: u64;
      proof_bytes: Buffer;
      pub_signals_bytes: Buffer;
      ciphertext_bytes: Buffer;
      kyt_authorization: Option<KytPassageAuthorization>;
    },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Gets the admin address (the contract deployer)
   */
  get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;

  /**
   * Construct and simulate a get_registry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_registry: (
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Option<string>>>;

  /**
   * Construct and simulate a set_registry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_registry: (
    { registry }: { registry: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a add_zk_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Registers a new per-nonce ZK circuit configuration (VK + full circuit shape). Admin-only;
   * fails if `nonce` already has a config. Validates `n_outs` is even (leaves are inserted
   * pairwise via `PairwiseLeanIMT::insert_two`), `n_audit_slots >= n_ins + n_outs`, that
   * `audit_offset`/`output_note_offset` match the formula-derived layout, and that the VK's
   * `ic` length matches the resulting total public-signal count.
   */
  add_zk_config: (
    {
      nonce,
      vk_bytes,
      n_ins,
      n_outs,
      public_n_inputs,
      public_n_outputs,
      n_audit_slots,
      note_audit_len,
      audit_offset,
      note_output_len,
      output_note_offset,
    }: {
      nonce: u64;
      vk_bytes: Buffer;
      n_ins: u32;
      n_outs: u32;
      public_n_inputs: u32;
      public_n_outputs: u32;
      n_audit_slots: u32;
      note_audit_len: u32;
      audit_offset: u32;
      note_output_len: u32;
      output_note_offset: u32;
    },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a get_zk_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Reads a registered ZK config (extending its persistent TTL), or `None` if absent.
   */
  get_zk_config: (
    { nonce }: { nonce: u64 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Option<ZkConfig>>>;

  /**
   * Construct and simulate a is_known_root transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns true if `root` appears in the recent root history (ring buffer).
   * All-zero bytes are never accepted.
   */
  is_known_root: (
    { root }: { root: Buffer },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<boolean>>;

  /**
   * Construct and simulate a get_commitments transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Gets all commitments (leaves) in the merkle tree. Read-only view helper (not called from
   * `transact`/`add_zk_config` or any other state-mutating entrypoint) intended for off-chain
   * simulation/queries; its cost scales with `count`, which grows with real pool usage rather
   * than with a single caller-controlled input, so it does not let one transaction consume a
   * disproportionate share of a block's resources the way an admin/user-controlled shape
   * parameter would. Acknowledged `dos-unbounded-operation` finding.
   *
   * `leaves` is a local in-memory `Vec` (`vec![&env]`), not persistent contract storage, so
   * there is no storage-side access-control concern in the `push_back` below either;
   * acknowledged `dos-unexpected-revert-with-storage` false positive. Both acknowledgments are
   * function-level because neither detector respects a `#[allow]` placed on the loop/statement
   * itself.
   */
  get_commitments: (
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Array<Buffer>>>;

  /**
   * Construct and simulate a get_merkle_root transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Gets the current merkle root of the commitment tree.
   */
  get_merkle_root: (options?: MethodOptions) => Promise<AssembledTransaction<Buffer>>;

  /**
   * Construct and simulate a get_kyt_registry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_kyt_registry: (
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Option<string>>>;

  /**
   * Construct and simulate a get_merkle_depth transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Gets the current depth of the merkle tree
   */
  get_merkle_depth: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>;

  /**
   * Construct and simulate a set_kyt_registry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_kyt_registry: (
    { kyt_registry }: { kyt_registry: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a get_token_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Token balance held by this contract for a Stellar asset contract (`C...`).
   */
  get_token_balance: (
    { token }: { token: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a get_leaf_ephemeral transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Ephemeral key (x, y) for a leaf index, if present.
   */
  get_leaf_ephemeral: (
    { leaf_index }: { leaf_index: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Option<EphemeralKeyCoords>>>;

  /**
   * Construct and simulate a deprecate_zk_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Marks a registered ZK config as deprecated; subsequent `transact` calls referencing this
   * `nonce` fail with [`Error::ZkConfigDeprecated`]. Admin-only.
   */
  deprecate_zk_config: (
    { nonce }: { nonce: u64 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a require_kyt_passage transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  require_kyt_passage: (
    { passage_id }: { passage_id: Buffer },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a get_commitment_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Gets the number of commitments (leaves) in the merkle tree
   */
  get_commitment_count: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>;

  /**
   * Construct and simulate a get_pairwise_frontier transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Filled-subtree frontier after the last pairwise insert (reload on the next deposit).
   */
  get_pairwise_frontier: (
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Array<Buffer>>>;

  /**
   * Construct and simulate a get_public_slot_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * `publicNInputs` / `publicNOutputs` for the nonce-`0` ("standard") ZK config.
   * Panics with [`Error::ZkConfigNotFound`] when nonce `0` is unregistered. Prefer
   * [`Self::get_zk_config`] for a specific nonce.
   */
  get_public_slot_config: (
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<readonly [u32, u32]>>;

  /**
   * Construct and simulate a is_nulifier_hash_consumed transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns true if the given nullifier hash has already been consumed (used in a withdrawal).
   */
  is_nulifier_hash_consumed: (
    { hash }: { hash: Buffer },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<boolean>>;

  /**
   * Construct and simulate a public_output transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw one note to its registered owner without a Groth16 proof.
   */
  public_output: (
    { note, leaf_index, to }: { note: NoteOpening; leaf_index: u32; to: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;
}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { tree_depth, admin }: { tree_depth: u32; admin: string },
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, 'contractId'> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: 'hex' | 'base64';
      },
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({ tree_depth, admin }, options);
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([
        'AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAFgAAAAAAAAANTnVsbGlmaWVyVXNlZAAAAAAAAAEAAAAAAAAAE0luc3VmZmljaWVudEJhbGFuY2UAAAAAAgAAAAAAAAAXUHJvb2ZWZXJpZmljYXRpb25GYWlsZWQAAAAAAwAAAAAAAAAJT25seUFkbWluAAAAAAAABAAAAAAAAAAOVHJlZUF0Q2FwYWNpdHkAAAAAAAUAAAAAAAAAF0Fzc29jaWF0aW9uUm9vdE1pc21hdGNoAAAAAAYAAAAAAAAAFEludmFsaWRQdWJsaWNTaWduYWxzAAAABwAAAAAAAAASSW52YWxpZFRva2VuQW1vdW50AAAAAAAIAAAAPFByb29mIGBzdGF0ZV9yb290YCBpcyBub3QgaW4gdGhlIHJlY2VudCByb290IGhpc3Rvcnkgd2luZG93LgAAAAtVbmtub3duUm9vdAAAAAAJAAAAXkV4YWN0bHkgb25lIG91dHB1dCBjb21taXRtZW50IGlzIG5vbi16ZXJvOyBvbmx5IHplcm8vemVybyBvciB0d28gbm9uLXplcm8gb3V0cHV0cyBhcmUgYWxsb3dlZC4AAAAAABVJbnZhbGlkQ29tbWl0bWVudFBhaXIAAAAAAAAKAAAAXVN0b3JlZCBNZXJrbGUgZnJvbnRpZXIgbGVuZ3RoIGRvZXMgbm90IG1hdGNoIHRyZWUgZGVwdGggKGNvcnJ1cHQgb3Igb3V0ZGF0ZWQgc3RvcmFnZSBsYXlvdXQpLgAAAAAAABVJbnZhbGlkTWVya2xlRnJvbnRpZXIAAAAAAAALAAAASUtZVCBwYXNzYWdlIHJlZ2lzdHJ5IGlzIG5vdCBjb25maWd1cmVkIChyZXF1aXJlZCBmb3IgdGhlIGN1cnJlbnQgbGF5b3V0KS4AAAAAAAASS3l0UmVnaXN0cnlNaXNzaW5nAAAAAAAMAAAATlJlc2VydmVkIChIMSk6IG9uLWNoYWluIGFwcGxpY2F0aW9uIGF1ZGl0LWtleSBhbGxvd2xpc3QgcmVtb3ZlZC4gRG8gbm90IHJldXNlLgAAAAAAFVVua25vd25BdWRpdFB1YmxpY0tleQAAAAAAAA0AAABOUmVzZXJ2ZWQgKEgxKTogb24tY2hhaW4gYXBwbGljYXRpb24gYXVkaXQta2V5IGFsbG93bGlzdCByZW1vdmVkLiBEbyBub3QgcmV1c2UuAAAAAAAVSW52YWxpZEF1ZGl0UHVibGljS2V5AAAAAAAADgAAADRObyBgWmtDb25maWdgIGlzIHJlZ2lzdGVyZWQgZm9yIHRoZSByZXF1ZXN0ZWQgbm9uY2UuAAAAEFprQ29uZmlnTm90Rm91bmQAAAAPAAAASFRoZSBgWmtDb25maWdgIGZvciB0aGUgcmVxdWVzdGVkIG5vbmNlIGhhcyBiZWVuIGRlcHJlY2F0ZWQgYnkgdGhlIGFkbWluLgAAABJaa0NvbmZpZ0RlcHJlY2F0ZWQAAAAAABAAAABPYGFkZF96a19jb25maWdgIHdhcyBjYWxsZWQgd2l0aCBhIGBub25jZWAgdGhhdCBhbHJlYWR5IGhhcyBhIGNvbmZpZyByZWdpc3RlcmVkLgAAAAAVWmtDb25maWdBbHJlYWR5RXhpc3RzAAAAAAAAEQAAAOdgYWRkX3prX2NvbmZpZ2Agc2hhcGUgcGFyYW1ldGVycyBhcmUgaW5jb25zaXN0ZW50IChvZGQgYG5fb3V0c2AsIGluc3VmZmljaWVudApgbl9hdWRpdF9zbG90c2AsIGFuIGBhdWRpdF9vZmZzZXRgL2BvdXRwdXRfbm90ZV9vZmZzZXRgIHRoYXQgZG9lc24ndCBtYXRjaCB0aGUKZm9ybXVsYS1kZXJpdmVkIHZhbHVlLCBvciBhIFZLIHdob3NlIGBpY2AgbGVuZ3RoIGRvZXNuJ3QgbWF0Y2ggdGhlIHNoYXBlKS4AAAAAD0ludmFsaWRaa0NvbmZpZwAAAAASAAAAPmBfX2NvbnN0cnVjdG9yYCB3YXMgY2FsbGVkIHdpdGggYHRyZWVfZGVwdGggPiBNQVhfVFJFRV9ERVBUSGAuAAAAAAAQSW52YWxpZFRyZWVEZXB0aAAAABMAAABTRHVwbGljYXRlIG51bGxpZmllciBoYXNoZXMgYXBwZWFyIGluIGEgc2luZ2xlIGB0cmFuc2FjdGAgcHVibGljLXNpZ25hbCB2ZWN0b3IgKEMzKS4AAAAAEkR1cGxpY2F0ZU51bGxpZmllcgAAAAAAFAAAAEhDYWxsZGF0YSBlc2Nyb3cgcmVjaXBpZW50IGRvZXMgbm90IG1hdGNoIHRoZSBwdWJsaWMtc2lnbmFsIGVzY3JvdyBsaW1icy4AAAAXRXNjcm93UmVjaXBpZW50TWlzbWF0Y2gAAAAAFQAAAFdBIHN3ZWVwIChub24temVybyBwdWJsaWMgZXNjcm93IHJlY2lwaWVudCkgcmVxdWlyZXMgYSByZWdpc3RyeSByZWNvcmQgZm9yIHRoYXQgYWNjb3VudC4AAAAAIFN3ZWVwUmVxdWlyZXNSZWdpc3RlcmVkUmVjaXBpZW50AAAAFg==',
        'AAAAAQAAAQJBZG1pbi1tYW5hZ2VkLCBub25jZS1rZXllZCBaSyBjaXJjdWl0IGNvbmZpZ3VyYXRpb246IHZlcmlmaWNhdGlvbiBrZXkgcGx1cyBldmVyeSBkeW5hbWljCnNoYXBlIHBhcmFtZXRlciBvZiB0aGUgYFRyYW5zYWN0aW9uKC4uLilgIGNpcmN1aXQgaW5zdGFudGlhdGlvbiB1c2VkIHRvIHZlcmlmeSBhIGB0cmFuc2FjdGAKY2FsbCBmb3IgdGhhdCBub25jZSAoc2VlIGBjaXJjdWl0cy9tYWluLmNpcmNvbWAgLyBgbGlicy96azo6WmtMYXlvdXRQYXJhbXNgKS4AAAAAAAAAAAAIWmtDb25maWcAAAALAAAAAAAAAAxhdWRpdF9vZmZzZXQAAAAEAAAAAAAAAApkZXByZWNhdGVkAAAAAAABAAAAAAAAAA1uX2F1ZGl0X3Nsb3RzAAAAAAAABAAAAAAAAAAFbl9pbnMAAAAAAAAEAAAAAAAAAAZuX291dHMAAAAAAAQAAAAAAAAADm5vdGVfYXVkaXRfbGVuAAAAAAAEAAAAAAAAAA9ub3RlX291dHB1dF9sZW4AAAAABAAAAAAAAAASb3V0cHV0X25vdGVfb2Zmc2V0AAAAAAAEAAAAAAAAAA9wdWJsaWNfbl9pbnB1dHMAAAAABAAAAAAAAAAQcHVibGljX25fb3V0cHV0cwAAAAQAAAAAAAAACHZrX2J5dGVzAAAADg==',
        'AAAAAgAAAFRTdG9yYWdlIGtleSBmb3IgdHJlZSBsZWF2ZXMg4oCUIGVhY2ggbGVhZiBzdG9yZWQgYnkgaW5kZXggZm9yIE8oMSkgd3JpdGUgb24gZGVwb3NpdC4AAAAAAAAAC1RyZWVEYXRhS2V5AAAAAAQAAAABAAAAAAAAAARMZWFmAAAAAQAAAAQAAAAAAAAAAAAAAAlMZWFmQ291bnQAAAAAAAABAAAAVEVwaGVtZXJhbCBwdWJsaWMga2V5IChFQ0RIIHBvaW50IHgsIHkpIHN0b3JlZCBwZXIgbGVhZjsgbm90IHBhcnQgb2YgdGhlIE1lcmtsZSBoYXNoLgAAAA1MZWFmRXBoZW1lcmFsAAAAAAAAAQAAAAQAAAAAAAAAXlJpZ2h0LXNwaW5lIC8gZmlsbGVkLXN1YnRyZWUgZnJvbnRpZXIgYWZ0ZXIgdGhlIGxhc3QgYGluc2VydF90d29gIChsZW5ndGggYG1lcmtsZV9kZXB0aCAtIDFgKS4AAAAAABBQYWlyd2lzZUZyb250aWVy',
        'AAAAAgAAAD9QZXJzaXN0ZW50IHN0b3JhZ2Uga2V5IGZvciB0aGUgcGVyLW5vbmNlIFtgWmtDb25maWdgXSByZWdpc3RyeS4AAAAAAAAAAAtaa0NvbmZpZ0tleQAAAAABAAAAAQAAAAAAAAAGQ29uZmlnAAAAAAABAAAABg==',
        'AAAABQAAADJFbWl0dGVkIGJ5IFtgUHJpdmFjeVBvb2xzQ29udHJhY3Q6OnNldF9yZWdpc3RyeWBdLgAAAAAAAAAAAAtSZWdpc3RyeVNldAAAAAACAAAABWFkbWluAAAAAAAADHJlZ2lzdHJ5X3NldAAAAAEAAAAAAAAACHJlZ2lzdHJ5AAAAEwAAAAAAAAAA',
        'AAAABQAAADNFbWl0dGVkIGJ5IFtgUHJpdmFjeVBvb2xzQ29udHJhY3Q6OmFkZF96a19jb25maWdgXS4AAAAAAAAAAA1aa0NvbmZpZ0FkZGVkAAAAAAAAAgAAAAVhZG1pbgAAAAAAAA96a19jb25maWdfYWRkZWQAAAAAAQAAAAAAAAAFbm9uY2UAAAAAAAAGAAAAAQAAAAA=',
        'AAAAAgAAAFRSaW5nIGJ1ZmZlciBvZiBoaXN0b3JpY2FsIE1lcmtsZSByb290cyAoZm9yIHByb29mcyBnZW5lcmF0ZWQgYWdhaW5zdCByZWNlbnQgc3RhdGVzKS4AAAAAAAAADlJvb3RIaXN0b3J5S2V5AAAAAAACAAAAAAAAACpOZXdlc3Qgcm9vdCBzbG90IGluZGV4IGluIHRoZSByaW5nIGJ1ZmZlci4AAAAAABBDdXJyZW50Um9vdEluZGV4AAAAAQAAAC5Sb290IHZhbHVlIGF0IHNsb3QgYGlgICgwLi5ST09UX0hJU1RPUllfU0laRSkuAAAAAAAEUm9vdAAAAAEAAAAE',
        'AAAABQAAADZFbWl0dGVkIGJ5IFtgUHJpdmFjeVBvb2xzQ29udHJhY3Q6OnNldF9reXRfcmVnaXN0cnlgXS4AAAAAAAAAAAAOS3l0UmVnaXN0cnlTZXQAAAAAAAIAAAAFYWRtaW4AAAAAAAAQa3l0X3JlZ2lzdHJ5X3NldAAAAAEAAAAAAAAACHJlZ2lzdHJ5AAAAEwAAAAAAAAAA',
        'AAAAAgAAAFJTdG9yYWdlIGtleSBmb3IgbnVsbGlmaWVycyDigJQgZWFjaCBudWxsaWZpZXIgaGFzaCBtYXBzIHRvIGJvb2wgKGNvbnN1bWVkIG9yIG5vdCkuAAAAAAAAAAAAD051bGlmaWVyRGF0YUtleQAAAAABAAAAAQAAAAAAAAAITnVsaWZpZXIAAAABAAAD7gAAACA=',
        'AAAAAQAAAERFcGhlbWVyYWwgQmFieUp1Ykp1YiAvIEVDREggcG9pbnQgKG5vdCBoYXNoZWQgaW50byB0aGUgTWVya2xlIHRyZWUpLgAAAAAAAAASRXBoZW1lcmFsS2V5Q29vcmRzAAAAAAACAAAAAAAAAAF4AAAAAAAD7gAAACAAAAAAAAAAAXkAAAAAAAPuAAAAIA==',
        'AAAABQAAALdPbmUgZXZlbnQgcGVyIGF1ZGl0IHNsb3QgKGAwLi5uX2F1ZGl0X3Nsb3RzYCkgaW4gYSBgdHJhbnNhY3RgIGNhbGwncyBwdWJsaWMgc2lnbmFscyDigJQgbGV0cwpvZmYtY2hhaW4gc2Nhbm5lcnMgcmVjb3ZlciBhdWRpdG9yIGNpcGhlcnRleHRzIGZyb20gZXZlbnRzIGluc3RlYWQgb2YgcmUtcGFyc2luZyBjYWxsZGF0YS4AAAAAAAAAABJBdWRpdFNsb3RFbmNyeXB0ZWQAAAAAAAIAAAAFYXVkaXQAAAAAAAAKYXVkaXRfc2xvdAAAAAAAAgAAAAAAAAAKc2xvdF9pbmRleAAAAAAABAAAAAEAAAAAAAAAB3BheWxvYWQAAAAH0AAAABVBdWRpdFNsb3RFdmVudFBheWxvYWQAAAAAAAAAAAAAAA==',
        'AAAABQAAAAAAAAAAAAAAEkt5dFBhc3NhZ2VUcmFuc2FjdAAAAAAAAgAAAAVhdWRpdAAAAAAAAAtreXRfcGFzc2FnZQAAAAACAAAAAAAAAApwYXNzYWdlX2lkAAAAAAPuAAAAIAAAAAEAAAAAAAAAEnB1YmxpY19zaWduYWxfaGFzaAAAAAAD7gAAACAAAAAAAAAAAA==',
        'AAAABQAAADlFbWl0dGVkIGJ5IFtgUHJpdmFjeVBvb2xzQ29udHJhY3Q6OmRlcHJlY2F0ZV96a19jb25maWdgXS4AAAAAAAAAAAAAElprQ29uZmlnRGVwcmVjYXRlZAAAAAAAAgAAAAVhZG1pbgAAAAAAABR6a19jb25maWdfZGVwcmVjYXRlZAAAAAEAAAAAAAAABW5vbmNlAAAAAAAABgAAAAEAAAAA',
        'AAAABQAAAAAAAAAAAAAAE091dHB1dE5vdGVFbmNyeXB0ZWQAAAAAAgAAAAVhdWRpdAAAAAAAAAtvdXRwdXRfbm90ZQAAAAACAAAAAAAAAA9jb21taXRtZW50X2hhc2gAAAAD7gAAACAAAAABAAAAAAAAAAdwYXlsb2FkAAAAB9AAAAAWT3V0cHV0Tm90ZUV2ZW50UGF5bG9hZAAAAAAAAAAAAAA=',
        'AAAAAQAAAAAAAAAAAAAAFUF1ZGl0U2xvdEV2ZW50UGF5bG9hZAAAAAAAAAQAAAAAAAAACmNpcGhlcnRleHQAAAAAAA4AAAAAAAAAC2VwaGVtZXJhbF94AAAAA+4AAAAgAAAAAAAAAAtlcGhlbWVyYWxfeQAAAAPuAAAAIAAAAAAAAAADdGFnAAAAA+4AAAAg',
        'AAAAAAAABABTaW5nbGUgZW50cnlwb2ludDogdmVyaWZpZXMgYGNpcmN1aXRzL21haW4uY2lyY29tYCBHcm90aDE2IHByb29mIGFuZCBwdWJsaWMgc2lnbmFscywgY2hlY2tzCnRyZWUgcm9vdCBhbmQgbnVsbGlmaWVycywgYXBwZW5kcyBuZXcgb3V0cHV0IGNvbW1pdG1lbnRzICh3aXRoIGVwaGVtZXJhbCBrZXlzLCBub3QgaW4gTWVya2xlKSwKdGhlbiBhcHBsaWVzIHB1YmxpYyB0b2tlbiBkZXBvc2l0cyAvIHdpdGhkcmF3YWxzOiBgcHVibGljRGVwb3NpdGVkQXNzZXRzYCArIGBwdWJsaWNEZXBvc2l0c2AKcHVsbCBmcm9tIGBmcm9tYCwgYW5kIGBwdWJsaWNXaXRoZHJhd25Bc3NldHNgICsgYHB1YmxpY1dpdGhkcmF3YWxzYCBzZW5kIHRvIHRoZSBTdGVsbGFyCmFjY291bnQgZnJvbSBgd2l0aGRyYXdBZGRyZXNzSGlgIC8gYHdpdGhkcmF3QWRkcmVzc0xvYC4KClRoZSBwcm9vZi1ib3VuZCBlc2Nyb3cgcmVjaXBpZW50IHJlY29uc3RydWN0ZWQgZnJvbSBwdWJsaWMgc2lnbmFscyBpcyB0aGUgb25seQphdXRob3JpemF0aW9uIHN1YmplY3QuIEJvdGggbGltYnMgemVybyBtZWFucyBhIG5vbi1zd2VlcDogYm90aCBzd2VlcCBvdXRwdXQgb3duZXIKY29vcmRpbmF0ZXMgbXVzdCBhbHNvIGJlIHplcm8uIEEgbm9uemVybyBwYWlyIGlzIGEgc3dlZXA6IHRoYXQgYWNjb3VudCBtdXN0CmByZXF1aXJlX2F1dGgoKWAgKGhvc3QgYWNjb3VudCBjcmVkZW50aWFscywgc28gbXVsdGlzaWcgYW5kIHJvdGF0ZWQgc2lnbmVycyB3b3JrOyBhCnJldm9rZWQga2V5IGNhbm5vdCksIG11c3QgYWxyZWFkeSBoYXZlIGEgcHJpdmF0ZSBhZGRyZXNzIGluIHRoZSByZWdpc3RyeSwgYW5kIGJvdGgKc3dlZXAgb3V0cHV0IG93bmVyIGNvb3JkaW5hdGVzIG11c3QgZXF1YWwgdGhhdCByZWdpc3RyeSBrZXkuCgpBc3NldCBpZHM6IFN0ZWxsYXIgKipjb250cmFjdCoqIHRva2VuIGBDLi4uYCBhZGRyZXNzZXMgZW5jb2RlZCBhcyB0d28gZmllbGQgZWxlbWVudHMgKHNhbWUgMzItYnl0ZQpzcGxpdCBhcyBhY2NvdW50IGtleXMg4oCUIHNlZSBgY2lyAAAACHRyYW5zYWN0AAAABgAAAAAAAAAEZnJvbQAAABMAAAAAAAAABW5vbmNlAAAAAAAABgAAAAAAAAALcHJvb2ZfYnl0ZXMAAAAADgAAAAAAAAARcHViX3NpZ25hbHNfYnl0ZXMAAAAAAAAOAAAAAAAAABBjaXBoZXJ0ZXh0X2J5dGVzAAAADgAAAAAAAAARa3l0X2F1dGhvcml6YXRpb24AAAAAAAPoAAAH0AAAABdLeXRQYXNzYWdlQXV0aG9yaXphdGlvbgAAAAABAAAD6QAAAAIAAAAD',
        'AAAAAQAAAFRQbGFpbnRleHQgb3BlbmluZyBvZiBvbmUgcG9vbCBub3RlLiBGaWVsZCBlbGVtZW50cyBhcmUgMzItYnl0ZSBiaWctZW5kaWFuIEZyIHZhbHVlcy4AAAAAAAAAC05vdGVPcGVuaW5nAAAAAAkAAAAAAAAADmFwcGxpY2F0aW9uX2lkAAAAAAPuAAAAIAAAAAAAAAAIYXNzZXRfaGkAAAPuAAAAIAAAAAAAAAAIYXNzZXRfbG8AAAPuAAAAIAAAAAAAAAAJbnVsbGlmaWVyAAAAAAAD7gAAACAAAAAAAAAACm93bmVyX21vZGUAAAAAA+4AAAAgAAAAAAAAAAtvd25lcl9wdWJfeAAAAAPuAAAAIAAAAAAAAAALb3duZXJfcHViX3kAAAAD7gAAACAAAAAAAAAABnNlY3JldAAAAAAD7gAAACAAAAAAAAAABXZhbHVlAAAAAAAD7gAAACA=',
        'AAAAAAAAAEJXaXRoZHJhdyBvbmUgbm90ZSB0byBpdHMgcmVnaXN0ZXJlZCBvd25lciB3aXRob3V0IGEgR3JvdGgxNiBwcm9vZi4AAAAAAA1wdWJsaWNfb3V0cHV0AAAAAAAAAwAAAAAAAAAEbm90ZQAAB9AAAAALTm90ZU9wZW5pbmcAAAAAAAAAAApsZWFmX2luZGV4AAAAAAAEAAAAAAAAAAJ0bwAAAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAAFRXJyb3IAAAA=',
        'AAAAAQAAAAAAAAAAAAAAFk91dHB1dE5vdGVFdmVudFBheWxvYWQAAAAAAAUAAAAAAAAACmNpcGhlcnRleHQAAAAAAA4AAAAAAAAAC2VwaGVtZXJhbF94AAAAA+4AAAAgAAAAAAAAAAtlcGhlbWVyYWxfeQAAAAPuAAAAIAAAAAAAAAAMb3V0cHV0X2luZGV4AAAABAAAAAAAAAADdGFnAAAAA+4AAAAg',
        'AAAAAAAAAC5HZXRzIHRoZSBhZG1pbiBhZGRyZXNzICh0aGUgY29udHJhY3QgZGVwbG95ZXIpAAAAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAAT',
        'AAAAAAAAAAAAAAAMZ2V0X3JlZ2lzdHJ5AAAAAAAAAAEAAAPoAAAAEw==',
        'AAAAAAAAAAAAAAAMc2V0X3JlZ2lzdHJ5AAAAAQAAAAAAAAAIcmVnaXN0cnkAAAATAAAAAA==',
        'AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAIAAAAAAAAACnRyZWVfZGVwdGgAAAAAAAQAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=',
        'AAAAAAAAAZpSZWdpc3RlcnMgYSBuZXcgcGVyLW5vbmNlIFpLIGNpcmN1aXQgY29uZmlndXJhdGlvbiAoVksgKyBmdWxsIGNpcmN1aXQgc2hhcGUpLiBBZG1pbi1vbmx5OwpmYWlscyBpZiBgbm9uY2VgIGFscmVhZHkgaGFzIGEgY29uZmlnLiBWYWxpZGF0ZXMgYG5fb3V0c2AgaXMgZXZlbiAobGVhdmVzIGFyZSBpbnNlcnRlZApwYWlyd2lzZSB2aWEgYFBhaXJ3aXNlTGVhbklNVDo6aW5zZXJ0X3R3b2ApLCBgbl9hdWRpdF9zbG90cyA+PSBuX2lucyArIG5fb3V0c2AsIHRoYXQKYGF1ZGl0X29mZnNldGAvYG91dHB1dF9ub3RlX29mZnNldGAgbWF0Y2ggdGhlIGZvcm11bGEtZGVyaXZlZCBsYXlvdXQsIGFuZCB0aGF0IHRoZSBWSydzCmBpY2AgbGVuZ3RoIG1hdGNoZXMgdGhlIHJlc3VsdGluZyB0b3RhbCBwdWJsaWMtc2lnbmFsIGNvdW50LgAAAAAADWFkZF96a19jb25maWcAAAAAAAALAAAAAAAAAAVub25jZQAAAAAAAAYAAAAAAAAACHZrX2J5dGVzAAAADgAAAAAAAAAFbl9pbnMAAAAAAAAEAAAAAAAAAAZuX291dHMAAAAAAAQAAAAAAAAAD3B1YmxpY19uX2lucHV0cwAAAAAEAAAAAAAAABBwdWJsaWNfbl9vdXRwdXRzAAAABAAAAAAAAAANbl9hdWRpdF9zbG90cwAAAAAAAAQAAAAAAAAADm5vdGVfYXVkaXRfbGVuAAAAAAAEAAAAAAAAAAxhdWRpdF9vZmZzZXQAAAAEAAAAAAAAAA9ub3RlX291dHB1dF9sZW4AAAAABAAAAAAAAAASb3V0cHV0X25vdGVfb2Zmc2V0AAAAAAAEAAAAAQAAA+kAAAACAAAAAw==',
        'AAAAAAAAAFFSZWFkcyBhIHJlZ2lzdGVyZWQgWksgY29uZmlnIChleHRlbmRpbmcgaXRzIHBlcnNpc3RlbnQgVFRMKSwgb3IgYE5vbmVgIGlmIGFic2VudC4AAAAAAAANZ2V0X3prX2NvbmZpZwAAAAAAAAEAAAAAAAAABW5vbmNlAAAAAAAABgAAAAEAAAPoAAAH0AAAAAhaa0NvbmZpZw==',
        'AAAAAAAAAGtSZXR1cm5zIHRydWUgaWYgYHJvb3RgIGFwcGVhcnMgaW4gdGhlIHJlY2VudCByb290IGhpc3RvcnkgKHJpbmcgYnVmZmVyKS4KQWxsLXplcm8gYnl0ZXMgYXJlIG5ldmVyIGFjY2VwdGVkLgAAAAANaXNfa25vd25fcm9vdAAAAAAAAAEAAAAAAAAABHJvb3QAAAPuAAAAIAAAAAEAAAAB',
        'AAAAAAAAA2NHZXRzIGFsbCBjb21taXRtZW50cyAobGVhdmVzKSBpbiB0aGUgbWVya2xlIHRyZWUuIFJlYWQtb25seSB2aWV3IGhlbHBlciAobm90IGNhbGxlZCBmcm9tCmB0cmFuc2FjdGAvYGFkZF96a19jb25maWdgIG9yIGFueSBvdGhlciBzdGF0ZS1tdXRhdGluZyBlbnRyeXBvaW50KSBpbnRlbmRlZCBmb3Igb2ZmLWNoYWluCnNpbXVsYXRpb24vcXVlcmllczsgaXRzIGNvc3Qgc2NhbGVzIHdpdGggYGNvdW50YCwgd2hpY2ggZ3Jvd3Mgd2l0aCByZWFsIHBvb2wgdXNhZ2UgcmF0aGVyCnRoYW4gd2l0aCBhIHNpbmdsZSBjYWxsZXItY29udHJvbGxlZCBpbnB1dCwgc28gaXQgZG9lcyBub3QgbGV0IG9uZSB0cmFuc2FjdGlvbiBjb25zdW1lIGEKZGlzcHJvcG9ydGlvbmF0ZSBzaGFyZSBvZiBhIGJsb2NrJ3MgcmVzb3VyY2VzIHRoZSB3YXkgYW4gYWRtaW4vdXNlci1jb250cm9sbGVkIHNoYXBlCnBhcmFtZXRlciB3b3VsZC4gQWNrbm93bGVkZ2VkIGBkb3MtdW5ib3VuZGVkLW9wZXJhdGlvbmAgZmluZGluZy4KCmBsZWF2ZXNgIGlzIGEgbG9jYWwgaW4tbWVtb3J5IGBWZWNgIChgdmVjIVsmZW52XWApLCBub3QgcGVyc2lzdGVudCBjb250cmFjdCBzdG9yYWdlLCBzbwp0aGVyZSBpcyBubyBzdG9yYWdlLXNpZGUgYWNjZXNzLWNvbnRyb2wgY29uY2VybiBpbiB0aGUgYHB1c2hfYmFja2AgYmVsb3cgZWl0aGVyOwphY2tub3dsZWRnZWQgYGRvcy11bmV4cGVjdGVkLXJldmVydC13aXRoLXN0b3JhZ2VgIGZhbHNlIHBvc2l0aXZlLiBCb3RoIGFja25vd2xlZGdtZW50cyBhcmUKZnVuY3Rpb24tbGV2ZWwgYmVjYXVzZSBuZWl0aGVyIGRldGVjdG9yIHJlc3BlY3RzIGEgYCNbYWxsb3ddYCBwbGFjZWQgb24gdGhlIGxvb3Avc3RhdGVtZW50Cml0c2VsZi4AAAAAD2dldF9jb21taXRtZW50cwAAAAAAAAAAAQAAA+oAAAPuAAAAIA==',
        'AAAAAAAAADRHZXRzIHRoZSBjdXJyZW50IG1lcmtsZSByb290IG9mIHRoZSBjb21taXRtZW50IHRyZWUuAAAAD2dldF9tZXJrbGVfcm9vdAAAAAAAAAAAAQAAA+4AAAAg',
        'AAAAAAAAAAAAAAAQZ2V0X2t5dF9yZWdpc3RyeQAAAAAAAAABAAAD6AAAABM=',
        'AAAAAAAAAClHZXRzIHRoZSBjdXJyZW50IGRlcHRoIG9mIHRoZSBtZXJrbGUgdHJlZQAAAAAAABBnZXRfbWVya2xlX2RlcHRoAAAAAAAAAAEAAAAE',
        'AAAAAAAAAAAAAAAQc2V0X2t5dF9yZWdpc3RyeQAAAAEAAAAAAAAADGt5dF9yZWdpc3RyeQAAABMAAAAA',
        'AAAAAAAAAEpUb2tlbiBiYWxhbmNlIGhlbGQgYnkgdGhpcyBjb250cmFjdCBmb3IgYSBTdGVsbGFyIGFzc2V0IGNvbnRyYWN0IChgQy4uLmApLgAAAAAAEWdldF90b2tlbl9iYWxhbmNlAAAAAAAAAQAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAQAAAAs=',
        'AAAAAAAAADJFcGhlbWVyYWwga2V5ICh4LCB5KSBmb3IgYSBsZWFmIGluZGV4LCBpZiBwcmVzZW50LgAAAAAAEmdldF9sZWFmX2VwaGVtZXJhbAAAAAAAAQAAAAAAAAAKbGVhZl9pbmRleAAAAAAABAAAAAEAAAPoAAAH0AAAABJFcGhlbWVyYWxLZXlDb29yZHMAAA==',
        'AAAAAAAAAJVNYXJrcyBhIHJlZ2lzdGVyZWQgWksgY29uZmlnIGFzIGRlcHJlY2F0ZWQ7IHN1YnNlcXVlbnQgYHRyYW5zYWN0YCBjYWxscyByZWZlcmVuY2luZyB0aGlzCmBub25jZWAgZmFpbCB3aXRoIFtgRXJyb3I6OlprQ29uZmlnRGVwcmVjYXRlZGBdLiBBZG1pbi1vbmx5LgAAAAAAABNkZXByZWNhdGVfemtfY29uZmlnAAAAAAEAAAAAAAAABW5vbmNlAAAAAAAABgAAAAEAAAPpAAAAAgAAAAM=',
        'AAAAAAAAAAAAAAATcmVxdWlyZV9reXRfcGFzc2FnZQAAAAABAAAAAAAAAApwYXNzYWdlX2lkAAAAAAPuAAAAIAAAAAEAAAPpAAAAAgAAAAM=',
        'AAAAAAAAADpHZXRzIHRoZSBudW1iZXIgb2YgY29tbWl0bWVudHMgKGxlYXZlcykgaW4gdGhlIG1lcmtsZSB0cmVlAAAAAAAUZ2V0X2NvbW1pdG1lbnRfY291bnQAAAAAAAAAAQAAAAQ=',
        'AAAAAAAAAFRGaWxsZWQtc3VidHJlZSBmcm9udGllciBhZnRlciB0aGUgbGFzdCBwYWlyd2lzZSBpbnNlcnQgKHJlbG9hZCBvbiB0aGUgbmV4dCBkZXBvc2l0KS4AAAAVZ2V0X3BhaXJ3aXNlX2Zyb250aWVyAAAAAAAAAAAAAAEAAAPqAAAD7gAAACA=',
        'AAAAAAAAAMlgcHVibGljTklucHV0c2AgLyBgcHVibGljTk91dHB1dHNgIGZvciB0aGUgbm9uY2UtYDBgICgic3RhbmRhcmQiKSBaSyBjb25maWcuClBhbmljcyB3aXRoIFtgRXJyb3I6OlprQ29uZmlnTm90Rm91bmRgXSB3aGVuIG5vbmNlIGAwYCBpcyB1bnJlZ2lzdGVyZWQuIFByZWZlcgpbYFNlbGY6OmdldF96a19jb25maWdgXSBmb3IgYSBzcGVjaWZpYyBub25jZS4AAAAAAAAWZ2V0X3B1YmxpY19zbG90X2NvbmZpZwAAAAAAAAAAAAEAAAPtAAAAAgAAAAQAAAAE',
        'AAAAAAAAAFpSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIG51bGxpZmllciBoYXNoIGhhcyBhbHJlYWR5IGJlZW4gY29uc3VtZWQgKHVzZWQgaW4gYSB3aXRoZHJhd2FsKS4AAAAAABlpc19udWxpZmllcl9oYXNoX2NvbnN1bWVkAAAAAAAAAQAAAAAAAAAEaGFzaAAAA+4AAAAgAAAAAQAAAAE=',
        'AAAAAQAAAAAAAAAAAAAAEEt5dFBhc3NhZ2VSZWNvcmQAAAACAAAAAAAAAAhjb25zdW1lZAAAAAEAAAAAAAAAEWV4cGlyZXNfYXRfbGVkZ2VyAAAAAAAABA==',
        'AAAAAQAAAAAAAAAAAAAAFFByaXZhdGVBZGRyZXNzUmVjb3JkAAAABAAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAxwdWJsaWNfa2V5X3gAAAPuAAAAIAAAAAAAAAAMcHVibGljX2tleV95AAAD7gAAACAAAAAAAAAAEXVwZGF0ZWRfYXRfbGVkZ2VyAAAAAAAABA==',
        'AAAAAQAAAAAAAAAAAAAAF0t5dFBhc3NhZ2VBdXRob3JpemF0aW9uAAAAAAIAAAAAAAAAEWV4cGlyYXRpb25fbGVkZ2VyAAAAAAAABAAAAAAAAAAJc2lnbmF0dXJlAAAAAAAD7gAAAEA=',
        'AAAAAQAAAAAAAAAAAAAAGlByaXZhdGVBZGRyZXNzUmVnaXN0cmF0aW9uAAAAAAADAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAADHB1YmxpY19rZXlfeAAAA+4AAAAgAAAAAAAAAAxwdWJsaWNfa2V5X3kAAAPuAAAAIA==',
        'AAAABAAAAAAAAAAAAAAADEdyb3RoMTZFcnJvcgAAAAMAAAAAAAAAFU1hbGZvcm1lZFZlcmlmeWluZ0tleQAAAAAAAAAAAACcYFByb29mOjpmcm9tX2J5dGVzYCByZWNlaXZlZCBhIGBwcm9vZl9ieXRlc2AgYXJndW1lbnQgdGhhdCBpcyB0b28gc2hvcnQgKG9yIG90aGVyd2lzZQpmYWlscyB0byBwYXJzZSBhcyBgYSB8fCBiIHx8IGNgKSBmb3IgdGhlIGZpeGVkIEcxL0cyIGVuY29kaW5nIGxlbmd0aHMuAAAADk1hbGZvcm1lZFByb29mAAAAAAABAAAAo2BQdWJsaWNTaWduYWxzOjpmcm9tX2J5dGVzYCByZWNlaXZlZCBhIGxlbmd0aCBwcmVmaXggdGhhdCBkb2VzIG5vdCBtYXRjaCB0aGUgcmVtYWluaW5nCnBheWxvYWQgKHRvbyBzaG9ydCwgdHJ1bmNhdGVkIEZyIGxpbWJzLCBvciBhIGNsYWltZWQgbGVuZ3RoIHRoYXQgb3ZlcmZsb3dzKS4AAAAAFk1hbGZvcm1lZFB1YmxpY1NpZ25hbHMAAAAAAAI=',
      ]),
      options,
    );
  }
  public readonly fromJSON = {
    transact: this.txFromJSON<Result<void>>,
    get_admin: this.txFromJSON<string>,
    get_registry: this.txFromJSON<Option<string>>,
    set_registry: this.txFromJSON<null>,
    add_zk_config: this.txFromJSON<Result<void>>,
    get_zk_config: this.txFromJSON<Option<ZkConfig>>,
    is_known_root: this.txFromJSON<boolean>,
    get_commitments: this.txFromJSON<Array<Buffer>>,
    get_merkle_root: this.txFromJSON<Buffer>,
    get_kyt_registry: this.txFromJSON<Option<string>>,
    get_merkle_depth: this.txFromJSON<u32>,
    set_kyt_registry: this.txFromJSON<null>,
    get_token_balance: this.txFromJSON<i128>,
    get_leaf_ephemeral: this.txFromJSON<Option<EphemeralKeyCoords>>,
    deprecate_zk_config: this.txFromJSON<Result<void>>,
    require_kyt_passage: this.txFromJSON<Result<void>>,
    get_commitment_count: this.txFromJSON<u32>,
    get_pairwise_frontier: this.txFromJSON<Array<Buffer>>,
    get_public_slot_config: this.txFromJSON<readonly [u32, u32]>,
    is_nulifier_hash_consumed: this.txFromJSON<boolean>,
    public_output: this.txFromJSON<Result<void>>,
  };
}
