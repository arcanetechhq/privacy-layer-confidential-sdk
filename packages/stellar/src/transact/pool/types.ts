export type PoolTransactResult = {
  signAndSend: () => Promise<{
    sendTransactionResponse?: {
      hash?: string;
    };
  }>;
};

export type PoolTransactClient = {
  get_merkle_root: () => Promise<{ result: Buffer }>;
  get_commitment_count: () => Promise<{ result: number }>;
  get_leaf_ephemeral: (input: {
    leaf_index: number;
  }) => Promise<{ result: { x: Buffer; y: Buffer } }>;
  is_nulifier_hash_consumed: (input: { hash: Buffer }) => Promise<{ result: boolean }>;
  public_output: (parameters: {
    note: {
      value: Buffer;
      secret: Buffer;
      nullifier: Buffer;
      owner_pub_x: Buffer;
      owner_pub_y: Buffer;
      owner_mode: Buffer;
      asset_hi: Buffer;
      asset_lo: Buffer;
      application_id: Buffer;
    };
    leaf_index: number;
    to: string;
  }) => Promise<PoolTransactResult>;
  transact: (parameters: {
    from: string;
    nonce: bigint;
    proof_bytes: Buffer;
    pub_signals_bytes: Buffer;
    ciphertext_bytes: Buffer;
    kyt_authorization: {
      expiration_ledger: number;
      signature: Buffer;
    };
  }) => Promise<PoolTransactResult>;
};

export type PoolClientFactory = (input: {
  contractId: string;
  walletPublicKey: string;
  networkPassphrase: string;
  sorobanRpcUrl: string;
}) => PoolTransactClient;
