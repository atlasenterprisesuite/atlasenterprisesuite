import type { IntegrationRequestContext } from './context';
import { integrationError } from './context';
import { insertIntegrationEvent } from './repository';

const sensitiveKey = /token|secret|password|authorization|cookie/i;
const allowedSensitiveNames = new Set(['credential_ref', 'provider_error_code', 'authorization_type']);

function walk(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (sensitiveKey.test(key) && !allowedSensitiveNames.has(key)) {
      throw integrationError('unsafe_audit_payload', 422);
    }
    walk(child);
  }
}

export function assertAuditMetadataSafe(value: unknown) {
  walk(value);
}

export type IntegrationAuditEventInput = {
  provider: string;
  connectionId?: string | null;
  action: string;
  statusBefore?: string | null;
  statusAfter?: string | null;
  requestedScopes?: string[];
  module?: string | null;
  environment?: string | null;
  approvalId?: string | null;
  correlationId?: string;
  outcome: 'started' | 'succeeded' | 'failed' | 'denied' | 'pending';
  providerErrorCode?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeIntegrationEvent(
  context: IntegrationRequestContext,
  input: IntegrationAuditEventInput,
  deps: { supabaseUrl?: string; serviceRoleKey?: string; fetchFn?: typeof fetch } = {}
) {
  assertAuditMetadataSafe(input.metadata || {});
  await insertIntegrationEvent({
    org_id: context.organizationId,
    actor_id: context.userId,
    provider: input.provider,
    connection_id: input.connectionId || null,
    action: input.action,
    status_before: input.statusBefore || null,
    status_after: input.statusAfter || null,
    requested_scopes: input.requestedScopes || [],
    module: input.module || null,
    environment: input.environment || null,
    approval_id: input.approvalId || null,
    correlation_id: input.correlationId || context.requestId,
    outcome: input.outcome,
    provider_error_code: input.providerErrorCode || null,
    metadata: input.metadata || {}
  }, deps);
}
