export type ResearchRole = 'research_viewer' | 'research_editor' | 'research_admin';
export type ResearchCapability =
  | 'evidence:read'
  | 'evidence:write'
  | 'graph:read'
  | 'graph:write'
  | 'falsification:read'
  | 'falsification:write'
  | 'settings:manage'
  | 'patient-data:read';

const roleCapabilities: Record<ResearchRole, ReadonlySet<ResearchCapability>> = {
  research_viewer: new Set(['evidence:read', 'graph:read', 'falsification:read']),
  research_editor: new Set([
    'evidence:read', 'evidence:write', 'graph:read', 'graph:write', 'falsification:read', 'falsification:write'
  ]),
  research_admin: new Set([
    'evidence:read', 'evidence:write', 'graph:read', 'graph:write', 'falsification:read', 'falsification:write', 'settings:manage'
  ])
};

export interface TenantContext {
  tenantId: string;
  actorId: string;
  role: ResearchRole;
  environment: 'development' | 'staging' | 'production';
}

export interface AuditEventInput {
  tenantId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  occurredAt: string;
}

export interface AuditEvent extends AuditEventInput {
  version: 1;
}

export function can(role: ResearchRole, capability: ResearchCapability): boolean {
  return roleCapabilities[role].has(capability);
}

export function assertTenantMatch(context: TenantContext, resourceTenantId: string): void {
  if (!context.tenantId || context.tenantId !== resourceTenantId) {
    throw new Error('ATLAS tenant boundary violation');
  }
}

function requireValue(name: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

export function createAuditEvent(input: AuditEventInput): AuditEvent {
  return {
    version: 1,
    tenantId: requireValue('tenantId', input.tenantId),
    actorId: requireValue('actorId', input.actorId),
    action: requireValue('action', input.action),
    resourceType: requireValue('resourceType', input.resourceType),
    resourceId: requireValue('resourceId', input.resourceId),
    occurredAt: requireValue('occurredAt', input.occurredAt)
  };
}
