import type { StellarTransactEnvironment } from '@arcanetech/privacy-sdk-stellar/transact';
import type { StellarPoolNetwork } from '../shared/index.js';

export interface StellarKytAccess {
  readonly apiBaseUrl: string;
  readonly passageRegistryContract: string;
  readonly inspectAuthorization?: string;
}

export interface StellarServiceNetwork extends StellarPoolNetwork {
  readonly registryContract: string;
  readonly applicationId: string;
}

export function kytBaseUrl(kyt: StellarKytAccess): string {
  return kyt.apiBaseUrl.replace(/\/$/u, '');
}

export function kytHeaders(kyt: StellarKytAccess): Record<string, string> {
  const token = kyt.inspectAuthorization?.trim();
  return {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

export function transactEnvironmentFor(
  network: StellarServiceNetwork,
  kyt: StellarKytAccess,
): StellarTransactEnvironment {
  return {
    network: {
      id: network.networkPassphrase,
      rpcUrl: network.rpcUrl,
      networkPassphrase: network.networkPassphrase,
      poolContract: network.poolContract,
      registryContract: network.registryContract,
      applicationId: network.applicationId,
    },
    kyt: {
      apiBaseUrl: kytBaseUrl(kyt),
      kytPassageRegistryContract: kyt.passageRegistryContract,
      ...(kyt.inspectAuthorization === undefined
        ? {}
        : { inspectAuthorization: kyt.inspectAuthorization }),
    },
  };
}
