import type {
  StellarOperationReceipt,
  StellarPreparedOperation,
  StellarSubmissionPayload,
  StellarTransactEngine,
} from '../../types.js';
import type { StellarTransactEnvironment } from '../environment/types.js';
import type { PrivacyPoolService } from '../pool/service.js';
import {
  prepareDepositOperation,
  prepareTransferOperation,
  prepareWithdrawOperation,
} from './prepare/index.js';
import { submitPreparedOperation } from './submit.js';

export function createBrowserStellarTransactEngine(input: {
  environment: StellarTransactEnvironment;
  poolService: PrivacyPoolService;
}): StellarTransactEngine {
  const { environment, poolService } = input;
  return {
    prepare: async (prepared) => {
      if (prepared.kind === 'deposit') {
        return prepareDepositOperation(prepared, environment, poolService);
      }
      if (prepared.kind === 'transfer') {
        return prepareTransferOperation(prepared, environment);
      }
      if (prepared.kind === 'publicWithdraw') {
        return prepared;
      }
      return prepareWithdrawOperation(prepared, environment);
    },
    submit: async (
      prepared: StellarPreparedOperation,
      _signedPayload: StellarSubmissionPayload,
    ): Promise<StellarOperationReceipt> => {
      const txHash = await submitPreparedOperation(prepared, environment, poolService);
      return {
        operationId: txHash,
        confirmed: true,
      };
    },
  };
}
