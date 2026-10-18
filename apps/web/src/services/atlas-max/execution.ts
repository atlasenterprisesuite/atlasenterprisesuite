export interface AtlasMaxExecutionInput { tenantId: string; actorTenantId: string; }
export interface AtlasMaxExecutionDecision { status: 'denied' | 'ready'; reason?: string; }
export function executeAtlasMaxDecision(input: AtlasMaxExecutionInput): AtlasMaxExecutionDecision {
  if (input.tenantId !== input.actorTenantId) return { status: 'denied', reason: 'tenant_mismatch' };
  return { status: 'ready' };
}
