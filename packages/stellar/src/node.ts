import { createRejectedOperation } from '@arcanetech/privacy-sdk-core';
import { loadNodeAssets } from './assets/load-node.js';
import {
  createStellarPrivacyClientFromResolvedConfig,
  resolveStellarPrivacyClientConfig,
} from './client/resolve-config.js';
import { createDefaultTransactEngine } from './transact/engine/default-factory.js';
import type { StellarNodePrivacyClientConfig } from './types.node.js';

export type { CreateStellarPrivacyClientResult } from './client/create.js';
export {
  createStellarPrivacyClient,
  isPreparedOperation,
  isStellarPrivacyClient,
} from './client/create.js';
export type {
  StellarBrowserPrivacyClientConfig,
  StellarPrivacyClientConfig,
} from './client/create.js';

export type {
  StellarNodeAssets,
  StellarNodePrivacyClientConfig,
} from './types.node.js';
export { PublicWithdrawNoteError } from './transact/public-withdraw/note-error.js';

export async function createStellarPrivacyClientFromNodeConfig(
  config: StellarNodePrivacyClientConfig,
): Promise<
  | ReturnType<typeof createStellarPrivacyClientFromResolvedConfig>
  | ReturnType<typeof createRejectedOperation>
> {
  const resolved = await resolveStellarPrivacyClientConfig(config, async (input) => {
    if (input.transactEngine !== undefined) {
      return input.transactEngine;
    }
    const browserAssets = await loadNodeAssets(input.assets);
    return createDefaultTransactEngine(browserAssets, input.transactEnvironment);
  });

  if (!resolved.ok) {
    return resolved.result;
  }

  return createStellarPrivacyClientFromResolvedConfig(resolved.config);
}
