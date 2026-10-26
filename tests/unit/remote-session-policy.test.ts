import { describe, expect, it } from 'vitest';
import { evaluateRemoteSession, type RemoteSessionRequest } from '../../apps/web/src/modules/device-os/remoteSessionPolicy';

const valid: RemoteSessionRequest = {
  organizationId: 'tenant-a', agentOrganizationId: 'tenant-a', deviceOrganizationId: 'tenant-a',
  agentId: 'agent-a', deviceAgentId: 'agent-a', agentStatus: 'online',
  mtlsStatus: 'active', adapterVerified: true, capabilities: ['remote.desktop.view','remote.desktop.control'],
  role: 'controller', authorized: true, consent: 'granted', sessionExpiresAt: 200, now: 100,
  sessionRevoked: false, reconnect: false
};
const result = (overrides: Partial<RemoteSessionRequest>) => evaluateRemoteSession({ ...valid, ...overrides });
describe('remote session policy (pure gate; not backend enforcement)', () => {
  it('rejects cross-tenant agents', () => expect(result({ agentOrganizationId: 'tenant-b' }).reason).toBe('tenant_mismatch'));
  it('rejects cross-tenant devices', () => expect(result({ deviceOrganizationId: 'tenant-b' }).reason).toBe('tenant_mismatch'));
  it('rejects device-to-agent mismatch', () => expect(result({ deviceAgentId: 'agent-b' }).reason).toBe('device_binding_mismatch'));
  it('rejects missing mTLS', () => expect(result({ mtlsStatus: 'pending' }).reason).toBe('mtls_required'));
  it('rejects absent native adapter', () => expect(result({ adapterVerified: false }).reason).toBe('native_adapter_unverified'));
  it('rejects RBAC denial', () => expect(result({ authorized: false }).reason).toBe('rbac_denied'));
  it('rejects denied consent', () => expect(result({ consent: 'denied' }).reason).toBe('consent_required'));
  it('rejects revoked consent', () => expect(result({ consent: 'revoked' }).reason).toBe('consent_required'));
  it('rejects revoked reconnect', () => expect(result({ reconnect: true, sessionRevoked: true }).reason).toBe('session_revoked'));
  it('rejects expired reconnect', () => expect(result({ reconnect: true, sessionExpiresAt: 100 }).reason).toBe('session_expired'));
  it('rejects view-only control', () => expect(result({ capabilities: ['remote.desktop.view'] }).reason).toBe('control_capability_missing'));
  it('rejects offline agent', () => expect(result({ agentStatus: 'offline' }).reason).toBe('agent_unavailable'));
  it('allows only policy eligibility, not a connected claim', () => expect(result({})).toEqual({ allowed: true, reason: 'policy_eligible_not_connected' }));
});
