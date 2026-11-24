import type { TenantScope } from '../../core/src';
import type {
  ScopedGrowthProviderAuthorization,
  ScopedGrowthProviderConnection
} from './growthAdDeliveryGate';

/**
 * Server-side database row normalizer for existing ATLAS Advisory tables.
 * The caller MUST fetch these rows under a trusted session + org/firm scope.
 * This module performs no fetches, writes, or credential access.
 */
type ProviderConnectionRow = {
  org_id: string;
  provider: string;
  connection_name: string;
  state: string;
  authorized: boolean;
  provider_verified: boolean;
  last_verified_at: string | null;
  revoked_at: string | null;
  metadata: Record<string, unknown> | null;
};
type ProviderAuthorizationRow = {
  org_id: string;
  firm_id: string;
  capability: string;
  authorized: boolean;
  authorized_at: string | null;
  revoked_at: string | null;
  authorization_reference: string | null;
};

const allowedStates = new Set([
  'unconfigured', 'authorizing', 'connected', 'degraded',
  'expired', 'revoked', 'error'
]);

export function normalizePaidMediaEvidenceFromExistingTables(input: {
  scope: TenantScope;
  firmId: string;
  connections: readonly ProviderConnectionRow[];
  authorizations: readonly ProviderAuthorizationRow[];
}): {
  connections: ScopedGrowthProviderConnection[];
  authorizations: ScopedGrowthProviderAuthorization[];
} {
  const { scope, firmId } = input;
  if (!scope.tenantId?.trim() || !scope.organizationId?.trim() || !firmId?.trim()) {
    return { connections: [], authorizations: [] };
  }
  const connections: ScopedGrowthProviderConnection[] = input.connections
    .filter(row =>
      row.org_id === scope.organizationId &&
      typeof row.provider === 'string' && row.provider.trim() &&
      typeof row.connection_name === 'string' && row.connection_name.trim() &&
      allowedStates.has(row.state)
    )
    .map(row => ({
      scope,
      provider: row.provider,
      connectionName: row.connection_name,
      state: row.state as ScopedGrowthProviderConnection['state'],
      authorized: row.authorized === true,
      providerVerified: row.provider_verified === true,
      lastVerifiedAt: row.last_verified_at,
      revokedAt: row.revoked_at,
      metadata: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? row.metadata : null
    }));

  const authorizations: ScopedGrowthProviderAuthorization[] = input.authorizations
    .filter(row => row.org_id === scope.organizationId &&
      row.firm_id === firmId && row.capability === 'paid_media'
    )
    .map(row => ({
      scope,
      firmId,
      capability: 'paid_media',
      authorized: row.authorized === true,
      authorizedAt: row.authorized_at,
      revokedAt: row.revoked_at,
      authorizationReference: row.authorization_reference
    }));

  return { connections, authorizations };
}
