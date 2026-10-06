export type ConnectionMechanism = 'oauth' | 'session' | 'vault';

export type ConnectionTransport = 'api' | 'mcp' | 'browser';

export type ConnectionHealth =
  | 'unknown'
  | 'healthy'
  | 'degraded'
  | 'reauth_required'
  | 'insufficient_scope'
  | 'account_changed'
  | 'runtime_unavailable'
  | 'unavailable';

export type ConnectionPath =
  | 'native_api_oauth'
  | 'native_api_vault'
  | 'native_mcp_oauth'
  | 'authorized_browser_session'
  | 'unsupported';

export type ConnectionDiscoveryResult = {
  provider: string;
  canonicalDomain: string | null;
  detectedTenantHint: string | null;
  supportedMechanisms: ConnectionMechanism[];
  supportedTransports: ConnectionTransport[];
  recommendedPath: ConnectionPath;
  reasons: string[];
  requiresHumanSignIn: boolean;
  adapterAvailable: boolean;
};

export type ConnectionAttestation = {
  provider: string;
  connectionId: string;
  providerAccountRef: string | null;
  providerTenantRef: string | null;
  principalRef: string | null;
  principalLabel: string | null;
  grantedCapabilities: string[];
  transportCapabilities: ConnectionTransport[];
  verifiedAt: string;
  expiresAt: string | null;
  evidenceDigest: string;
};

export function normalizeProviderTarget(input: string): {
  provider: string | null;
  canonicalDomain: string | null;
} {
  const value = input.trim();
  if (!value) return { provider: null, canonicalDomain: null };

  let url: URL;
  try {
    const normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    url = new URL(normalized);
  } catch {
    return { provider: null, canonicalDomain: null };
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const isHubSpot = hostname === 'hubspot.com' || hostname.endsWith('.hubspot.com');
  return isHubSpot
    ? { provider: 'hubspot', canonicalDomain: 'hubspot.com' }
    : { provider: null, canonicalDomain: null };
}

export function connectionIsReady(input: {
  lifecycle: string;
  health: ConnectionHealth;
  verifiedAt: string | null;
  transports: ConnectionTransport[];
}): boolean {
  return input.lifecycle === 'active'
    && input.health === 'healthy'
    && Boolean(input.verifiedAt?.trim())
    && input.transports.length > 0;
}
