export type RemoteSessionRequest = {
  organizationId: string;
  agentOrganizationId: string;
  deviceOrganizationId: string;
  agentId: string;
  deviceAgentId: string;
  agentStatus: 'online' | 'offline' | 'revoked';
  mtlsStatus: 'active' | 'pending' | 'expired' | 'revoked' | 'unconfigured';
  adapterVerified: boolean;
  capabilities: readonly string[];
  role: 'viewer' | 'controller';
  authorized: boolean;
  consent: 'granted' | 'denied' | 'revoked' | 'pending';
  sessionExpiresAt: number;
  now: number;
  sessionRevoked: boolean;
  reconnect: boolean;
};

export function evaluateRemoteSession(request: RemoteSessionRequest): { allowed: boolean; reason: string } {
  const deny = (reason: string) => ({ allowed: false, reason });
  if (!request.organizationId || request.organizationId !== request.agentOrganizationId ||
      request.organizationId !== request.deviceOrganizationId) return deny('tenant_mismatch');
  if (!request.agentId || request.agentId !== request.deviceAgentId) return deny('device_binding_mismatch');
  if (request.agentStatus !== 'online') return deny('agent_unavailable');
  if (request.mtlsStatus !== 'active') return deny('mtls_required');
  if (!request.adapterVerified) return deny('native_adapter_unverified');
  if (!request.authorized) return deny('rbac_denied');
  if (request.consent !== 'granted') return deny('consent_required');
  if (request.sessionRevoked) return deny('session_revoked');
  if (!Number.isFinite(request.now) || !Number.isFinite(request.sessionExpiresAt) ||
      request.sessionExpiresAt <= request.now) return deny('session_expired');
  if (!request.capabilities.includes('remote.desktop.view')) return deny('view_capability_missing');
  if (request.role === 'controller' && !request.capabilities.includes('remote.desktop.control')) return deny('control_capability_missing');
  return { allowed: true, reason: 'policy_eligible_not_connected' };
}
