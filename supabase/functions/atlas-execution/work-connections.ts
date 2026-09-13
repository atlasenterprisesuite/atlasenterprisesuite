export class WorkConnectionError extends Error {
  constructor(readonly code: string, readonly status = 500) {
    super(code);
  }
}

type UserContext = {
  userId: string;
  orgId: string;
  tenantId: string;
};

type ConnectionMechanism = 'oauth' | 'session' | 'vault';

function text(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function stringArray(value: unknown, max = 40) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => text(item, 120)).filter(Boolean))].slice(0, max);
}

export async function listWorkConnections(admin: any, context: UserContext) {
  const { data, error } = await admin
    .from('execution_connection_refs')
    .select('id,provider,mechanism,status,capabilities,created_at,updated_at')
    .eq('org_id', context.orgId)
    .eq('tenant_id', context.tenantId)
    .order('updated_at', { ascending: false });
  if (error) throw new WorkConnectionError('persistence_error', 500);
  return data || [];
}

export async function registerWorkConnectionRef(admin: any, context: UserContext, input: {
  provider: unknown;
  mechanism: unknown;
  externalRef: unknown;
  capabilities: unknown;
}) {
  const provider = text(input.provider, 100).toLowerCase();
  const mechanism = text(input.mechanism, 30) as ConnectionMechanism;
  const externalRef = text(input.externalRef, 500);
  const capabilities = stringArray(input.capabilities);
  if (!provider) throw new WorkConnectionError('provider_required', 422);
  if (!['oauth', 'session', 'vault'].includes(mechanism)) throw new WorkConnectionError('invalid_connection_mechanism', 422);
  if (!externalRef) throw new WorkConnectionError('external_ref_required', 422);

  const { data, error } = await admin.from('execution_connection_refs').insert({
    org_id: context.orgId,
    tenant_id: context.tenantId,
    provider,
    mechanism,
    external_ref: externalRef,
    status: 'active',
    capabilities,
    created_by_user_id: context.userId
  }).select('id,provider,mechanism,status,capabilities,created_at,updated_at').single();
  if (error || !data) throw new WorkConnectionError('persistence_error', 500);
  return data;
}

export async function revokeWorkConnectionRef(admin: any, context: UserContext, connectionId: string) {
  const id = text(connectionId, 80);
  if (!id) throw new WorkConnectionError('connection_id_required', 422);
  const { data, error } = await admin
    .from('execution_connection_refs')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', context.orgId)
    .eq('tenant_id', context.tenantId)
    .eq('status', 'active')
    .select('id,provider,mechanism,status,capabilities,created_at,updated_at')
    .maybeSingle();
  if (error) throw new WorkConnectionError('persistence_error', 500);
  if (!data) throw new WorkConnectionError('connection_not_found', 404);
  return data;
}
