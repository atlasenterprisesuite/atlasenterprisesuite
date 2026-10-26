import type { ServerReadDecision, ServerReadDecisionResolver } from './binanceUsReadAdapter';

/** Server-only dependency contract. Caller MUST supply authenticated, server-derived evidence. */
export type BinanceServerTrustDependencies = {
  authenticate: () => Promise<{ userId: string } | null>;
  loadConnection: () => Promise<{ organizationId: string; state: 'authorized' | 'revoked' | 'blocked' | 'unverified' } | null>;
  verifyMembershipAndPermission: (userId: string, organizationId: string, permission: 'pay.read') => Promise<boolean>;
  verifyEffectiveReadOnlyKeyPermissions: (organizationId: string) => Promise<boolean>;
};
/** Never accept session, organization, permission or key-permission flags from HTTP payloads. */
export function createBinanceUsServerReadDecisionResolver(deps: BinanceServerTrustDependencies): ServerReadDecisionResolver {
  return async (): Promise<ServerReadDecision> => {
    if (!deps || typeof deps.authenticate !== 'function' || typeof deps.loadConnection !== 'function'
      || typeof deps.verifyMembershipAndPermission !== 'function' || typeof deps.verifyEffectiveReadOnlyKeyPermissions !== 'function')
      throw new Error('ACCESS_DENIED');
    const session = await deps.authenticate();
    if (!session || typeof session.userId !== 'string' || !session.userId.trim()) throw new Error('ACCESS_DENIED');
    const connection = await deps.loadConnection();
    if (!connection || typeof connection.organizationId !== 'string' || !connection.organizationId.trim())
      throw new Error('ACCESS_DENIED');
    if (connection.state !== 'authorized') throw new Error('CONNECTION_REVOKED_OR_UNVERIFIED');
    const permitted = await deps.verifyMembershipAndPermission(session.userId, connection.organizationId, 'pay.read');
    if (permitted !== true) throw new Error('ACCESS_DENIED');
    const verified = await deps.verifyEffectiveReadOnlyKeyPermissions(connection.organizationId);
    if (verified !== true) throw new Error('KEY_PERMISSIONS_UNVERIFIED');
    return {
      sessionOrganizationId: connection.organizationId,
      connectionOrganizationId: connection.organizationId,
      hasPayReadPermission: true,
      effectiveKeyPermissionsVerifiedReadOnly: true
    };
  };
}
