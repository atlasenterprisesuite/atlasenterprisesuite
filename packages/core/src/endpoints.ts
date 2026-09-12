export type ResolvedProviderEndpoint = {
  origin: string;
  verified: boolean;
};

export function resolveProviderEndpoint(input: string): ResolvedProviderEndpoint {
  const url = new URL(input);

  if (url.protocol !== 'https:') {
    throw new Error('insecure_provider_endpoint');
  }

  if (url.username || url.password) {
    throw new Error('credentialed_provider_endpoint');
  }

  return { origin: url.origin, verified: false };
}

export function applyVerifiedEndpointMigration(
  current: ResolvedProviderEndpoint,
  candidate: string,
  providerVerified: boolean
): ResolvedProviderEndpoint {
  if (!providerVerified) return current;
  return { ...resolveProviderEndpoint(candidate), verified: true };
}
