import type { ExecutionActor } from './types';

export type AtlasContextChannel = 'web' | 'mobile' | 'desktop' | 'voice' | 'api' | 'system';

export type AtlasServerContextInput = {
  requestId: string;
  correlationId?: string | null;
  sessionId: string;
  source: 'server';
  userId: string;
  tenantId: string;
  organizationId: string;
  permissions: readonly string[];
  roles?: readonly string[];
  memoryRefs?: readonly string[];
  knowledgeRefs?: readonly string[];
  channel?: AtlasContextChannel | null;
  deviceId?: string | null;
};

export type AtlasResolvedContext = {
  requestId: string;
  correlationId: string;
  sessionId: string;
  source: 'server';
  actor: ExecutionActor;
  roles: string[];
  memoryRefs: string[];
  knowledgeRefs: string[];
  channel: AtlasContextChannel | null;
  deviceId: string | null;
};

function required(value: unknown, code: string) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function unique(values: readonly string[] | undefined) {
  return [...new Set((values ?? []).map((value) => String(value).trim()).filter(Boolean))];
}

export function resolveAtlasContext(input: AtlasServerContextInput): AtlasResolvedContext {
  if (input.source !== 'server') throw new Error('atlas_context_untrusted');

  const requestId = required(input.requestId, 'atlas_context_request_id_required');
  const sessionId = required(input.sessionId, 'atlas_context_session_required');
  const userId = required(input.userId, 'atlas_context_user_required');
  const tenantId = required(input.tenantId, 'atlas_context_tenant_required');
  const organizationId = required(input.organizationId, 'atlas_context_organization_required');
  const correlationId = String(input.correlationId ?? '').trim() || requestId;

  return {
    requestId,
    correlationId,
    sessionId,
    source: 'server',
    actor: {
      userId,
      scope: { tenantId, organizationId },
      permissions: unique(input.permissions)
    },
    roles: unique(input.roles),
    memoryRefs: unique(input.memoryRefs),
    knowledgeRefs: unique(input.knowledgeRefs),
    channel: input.channel ?? null,
    deviceId: String(input.deviceId ?? '').trim() || null
  };
}
