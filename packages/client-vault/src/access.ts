/** Pure authorization gate: never trust client-supplied tenant or membership claims. */
export type VaultAction = 'list' | 'read' | 'upload' | 'export' | 'delete' | 'grant' | 'restore';
export type VaultRole = 'owner' | 'custodian' | 'viewer';
export interface VaultActor {
  userId: string;
  tenantId: string;
  clientIds: readonly string[];
  role: VaultRole;
  authenticated: boolean;
  revoked: boolean;
  mfaVerifiedAt?: number;
}
export interface VaultResource {
  tenantId: string;
  clientId: string;
  legalHold: boolean;
  retentionUntil?: number;
}
export interface VaultDecision {
  allowed: boolean;
  reason: string;
}
const elevated = new Set<VaultAction>(['export', 'delete', 'grant', 'restore']);
const roleActions: Record<VaultRole, readonly VaultAction[]> = {
  owner: ['list', 'read', 'upload', 'export', 'delete', 'grant', 'restore'],
  custodian: ['list', 'read', 'upload', 'export', 'restore'],
  viewer: ['list', 'read']
};
export function authorizeVault(
  actor: VaultActor | null,
  resource: VaultResource,
  action: VaultAction,
  now: number,
  approvals: readonly string[] = []
): VaultDecision {
  const deny = (reason: string): VaultDecision => ({ allowed: false, reason });
  if (!actor?.authenticated || actor.revoked || !actor.userId) return deny('unauthenticated');
  if (!actor.tenantId || !resource.tenantId || actor.tenantId !== resource.tenantId) return deny('tenant_denied');
  if (!resource.clientId || !actor.clientIds.includes(resource.clientId)) return deny('client_denied');
  if (!roleActions[actor.role]?.includes(action)) return deny('role_denied');
  if (!Number.isFinite(now)) return deny('invalid_time');
  if (elevated.has(action) && (!actor.mfaVerifiedAt || actor.mfaVerifiedAt > now || now - actor.mfaVerifiedAt > 300_000))
    return deny('mfa_required');
  if (action === 'delete') {
    if (resource.legalHold || (resource.retentionUntil !== undefined && now < resource.retentionUntil)) return deny('retention_lock');
    if (new Set(approvals.filter(id => id && id !== actor.userId)).size < 2) return deny('dual_approval_required');
  }
  return { allowed: true, reason: 'authorized' };
}
