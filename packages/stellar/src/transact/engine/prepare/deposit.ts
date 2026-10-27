import { measureStage } from '@arcanetech/privacy-sdk-core';
import type { StellarPreparedOperation } from '../../../types.js';
import { readPoolClientFactory } from '../../../contracts/contract-context.js';
import type { StellarTransactEnvironment } from '../../environment/types.js';
import type { PrivacyPoolService } from '../../pool/service.js';
import { ciphertextArtifactsFromProof } from '../../pool/proof-types.js';
import { buildPrivateRecordFromDeposit } from '../../private-address/record-coin.js';
import {
  enrichPreparedOperation,
  resolveTokenContractId,
  resolveWalletPublicKey,
} from './shared.js';
import { quoteFeeOutputForPrepared } from '../../fees/quote-fee-output-for-prepared.js';
import {
  configuredNonceSpread,
  zkConfigNonceForFeeBearingKind,
} from '../../fees/zk-config-nonce-for-kind.js';

const STROOPS_PER_UNIT = 10_000_000n;

async function createAlignedDepositWithProof(parameters: {
  prepared: StellarPreparedOperation;
  environment: StellarTransactEnvironment;
  poolService: PrivacyPoolService;
  walletPublicKey: string;
  tokenAddress: string;
}) {
  const feeOutput = await measureStage('feeQuote', () =>
    quoteFeeOutputForPrepared(parameters),
  );
  const instructed = parameters.prepared.intent.amount;
  const userAmount = instructed - (feeOutput?.requiredFee ?? 0n);
  if (userAmount <= 0n) {
    throw new Error('Required Fee leaves no spendable deposit note');
  }
  const aligned = await measureStage('alignCoin', () =>
    parameters.poolService.createAlignedShieldCoinData({
      privateAddressStpl1: parameters.prepared.intent.to,
      amountStroops: userAmount,
      tokenAddress: parameters.tokenAddress,
    }),
  );
  const poolClient = readPoolClientFactory(parameters.environment)({
    contractId: parameters.environment.network.poolContract,
    walletPublicKey: parameters.walletPublicKey,
    networkPassphrase: parameters.environment.network.networkPassphrase,
    sorobanRpcUrl: parameters.environment.network.rpcUrl,
  });
  const merkleTx = await measureStage('merkleRoot', () => poolClient.get_merkle_root());
  const proof = await measureStage('prove', () =>
    parameters.poolService.prepareDepositTransactProof({
      privateAddressStpl1: parameters.prepared.intent.to,
      coin: aligned.coin,
      depositScalarHex: aligned.depositScalarHex,
      merkleRootBytes: merkleTx.result,
      tokenAddress: parameters.tokenAddress,
      publicDepositStroops: instructed,
      ...(feeOutput ? { feeOutput } : {}),
    }),
  );
  return { ...aligned, proof };
}

export async function prepareDepositOperation(
  prepared: StellarPreparedOperation,
  environment: StellarTransactEnvironment,
  poolService: PrivacyPoolService,
): Promise<StellarPreparedOperation> {
  return measureStage('prepare', async () => {
    const walletPublicKey = await resolveWalletPublicKey(environment, prepared);
    const tokenAddress = await resolveTokenContractId(
      environment,
      prepared.intent.asset,
    );
    const depositProof = await createAlignedDepositWithProof({
      prepared,
      environment,
      poolService,
      walletPublicKey,
      tokenAddress,
    });
    return measureStage('assemble', () =>
      assembleDepositOperation({
        prepared,
        environment,
        walletPublicKey,
        tokenAddress,
        depositProof,
      }),
    );
  });
}

function assembleDepositOperation(input: {
  prepared: StellarPreparedOperation;
  environment: StellarTransactEnvironment;
  walletPublicKey: string;
  tokenAddress: string;
  depositProof: Awaited<ReturnType<typeof createAlignedDepositWithProof>>;
}): StellarPreparedOperation {
  const outputRecord = buildPrivateRecordFromDeposit({
    owner: input.walletPublicKey,
    privateAddress: input.prepared.intent.to,
    assetId: input.prepared.intent.asset,
    poolContract: input.environment.network.poolContract,
    amount: BigInt(input.depositProof.coin.value),
    amountDisplay: Number(input.depositProof.coin.value) / Number(STROOPS_PER_UNIT),
    commitmentHex: input.depositProof.commitment_hex,
    coin: input.depositProof.coin,
    depositScalarHex: input.depositProof.depositScalarHex,
    precommitementHex: input.depositProof.precommitementHex,
    status: 'pending',
  });
  return enrichPreparedOperation(input.prepared, [outputRecord], {
    proofHex: input.depositProof.proof.proof_hex,
    publicHex: input.depositProof.proof.public_hex,
    ...ciphertextArtifactsFromProof(input.depositProof.proof),
    applicationIdsPlaintext: input.depositProof.proof.applicationIdsPlaintext,
    tokenAddress: input.tokenAddress,
    depositScalarHex: input.depositProof.depositScalarHex,
    precommitementHex: input.depositProof.precommitementHex,
    commitmentHex: input.depositProof.commitment_hex,
    walletPublicKey: input.walletPublicKey,
    zkConfigNonce: zkConfigNonceForFeeBearingKind({
      kind: 'deposit',
      ...configuredNonceSpread(input.environment.zkConfigNonce),
    }),
  });
}
