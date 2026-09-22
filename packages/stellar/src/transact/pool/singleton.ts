import type { StellarBrowserAssets } from '../../types.js';
import { registerMerkleSessionSdkHost } from '../merkle/tree-session.js';
import { PrivacyPoolService } from '../pool/service.js';
import type { StellarZkCircuitDefinition } from '../zk/circuit-config.js';

export function createPrivacyPoolService(input?: {
  assets?: StellarBrowserAssets;
  applicationId?: string;
  auditPublicKey?: [string, string];
  zkCircuits?: Record<string, StellarZkCircuitDefinition>;
  zkConfigNonce?: bigint;
  zkArtifactBaseUrl?: string;
}): PrivacyPoolService {
  return new PrivacyPoolService(
    input?.assets,
    input?.applicationId,
    input?.auditPublicKey,
    input?.zkCircuits,
    input?.zkConfigNonce,
    input?.zkArtifactBaseUrl,
  );
}

let configuredPrivacyPoolService: PrivacyPoolService | undefined;

export function configurePrivacyPoolService(service: PrivacyPoolService): void {
  configuredPrivacyPoolService = service;
  registerMerkleSessionSdkHost(service);
}

export function getPrivacyPoolService(): PrivacyPoolService {
  if (!configuredPrivacyPoolService) {
    throw new Error(
      'PrivacyPoolService is not configured. Call configurePrivacyPoolService first.',
    );
  }
  return configuredPrivacyPoolService;
}
