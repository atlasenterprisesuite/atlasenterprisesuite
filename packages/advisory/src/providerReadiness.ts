export const ADVISORY_EXTERNAL_CAPABILITIES = [
  {
    id: 'esign',
    label: 'E-sign',
    description: 'Electronic signature provider for governed document execution.'
  },
  {
    id: 'print_fulfillment',
    label: 'Print fulfillment',
    description: 'External production and fulfillment for approved print and promotional orders.'
  },
  {
    id: 'paid_media',
    label: 'Paid media',
    description: 'Authorized advertising provider for campaign activation and spend.'
  },
  {
    id: 'payment',
    label: 'Payments',
    description: 'Payment provider used only after organization authorization and provider verification.'
  },
  {
    id: 'publishing',
    label: 'Publishing',
    description: 'Authorized external publishing channel for approved content delivery.'
  }
] as const;

export type AdvisoryExternalCapability = typeof ADVISORY_EXTERNAL_CAPABILITIES[number]['id'];

export type AdvisoryProviderConnectionEvidence = {
  provider: string;
  connectionName: string;
  state: 'unconfigured' | 'authorizing' | 'connected' | 'degraded' | 'expired' | 'revoked' | 'error';
  authorized: boolean;
  providerVerified: boolean;
  providerAccountLabel?: string | null;
  lastVerifiedAt?: string | null;
  lastSuccessAt?: string | null;
  lastErrorCode?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AdvisoryProviderAuthorizationEvidence = {
  capability: AdvisoryExternalCapability;
  authorized: boolean;
  authorizedAt: string | null;
  authorizationReference?: string | null;
};

export type AdvisoryProviderReadinessStatus =
  | 'authorization_required'
  | 'authorized'
  | 'authorizing'
  | 'connected'
  | 'degraded';

export type AdvisoryProviderReadiness = {
  capability: AdvisoryExternalCapability;
  label: string;
  description: string;
  status: AdvisoryProviderReadinessStatus;
  provider: string | null;
  connectionName: string | null;
  providerAccountLabel: string | null;
  lastVerifiedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorCode: string | null;
  organizationAuthorized: boolean;
  authorizedAt: string | null;
  authorizationReference: string | null;
};

const capabilityIds = new Set<string>(ADVISORY_EXTERNAL_CAPABILITIES.map((item) => item.id));

function capabilityForConnection(connection: AdvisoryProviderConnectionEvidence): AdvisoryExternalCapability | null {
  const metadataCapability = connection.metadata?.advisory_capability;
  if (typeof metadataCapability === 'string' && capabilityIds.has(metadataCapability)) {
    return metadataCapability as AdvisoryExternalCapability;
  }

  const match = /^advisory:(esign|print_fulfillment|paid_media|payment|publishing)(?::|$)/.exec(connection.connectionName);
  return match?.[1] as AdvisoryExternalCapability | undefined || null;
}

function statusForConnection(connection: AdvisoryProviderConnectionEvidence): AdvisoryProviderReadinessStatus {
  if (connection.state === 'connected' && connection.authorized && connection.providerVerified) {
    return 'connected';
  }
  if (connection.state === 'authorizing') return 'authorizing';
  if (
    connection.state === 'degraded' ||
    connection.state === 'error' ||
    connection.state === 'expired' ||
    connection.state === 'connected'
  ) {
    return 'degraded';
  }
  return 'authorization_required';
}

function rank(status: AdvisoryProviderReadinessStatus) {
  if (status === 'connected') return 5;
  if (status === 'authorizing') return 4;
  if (status === 'degraded') return 3;
  if (status === 'authorized') return 2;
  return 1;
}

export function resolveAdvisoryProviderReadiness(
  connections: readonly AdvisoryProviderConnectionEvidence[],
  authorizations: readonly AdvisoryProviderAuthorizationEvidence[] = []
): AdvisoryProviderReadiness[] {
  return ADVISORY_EXTERNAL_CAPABILITIES.map((capability) => {
    const authorization = authorizations.find(
      (item) => item.capability === capability.id && item.authorized
    ) || null;
    const candidates = connections
      .filter((connection) => capabilityForConnection(connection) === capability.id)
      .map((connection) => ({ connection, status: statusForConnection(connection) }))
      .sort((left, right) => rank(right.status) - rank(left.status));

    const selected = candidates[0];
    return {
      capability: capability.id,
      label: capability.label,
      description: capability.description,
      status: selected?.status || (authorization ? 'authorized' : 'authorization_required'),
      provider: selected?.connection.provider || null,
      connectionName: selected?.connection.connectionName || null,
      providerAccountLabel: selected?.connection.providerAccountLabel || null,
      lastVerifiedAt: selected?.connection.lastVerifiedAt || null,
      lastSuccessAt: selected?.connection.lastSuccessAt || null,
      lastErrorCode: selected?.connection.lastErrorCode || null,
      organizationAuthorized: Boolean(authorization),
      authorizedAt: authorization?.authorizedAt || null,
      authorizationReference: authorization?.authorizationReference || null
    };
  });
}
