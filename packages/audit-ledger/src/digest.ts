import { canonicalizeJson } from './canonicalize';
import type { AuditLedgerEvent } from './types';

function canonicalizeTimestamp(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error('audit_ledger_invalid_timestamp');
  return new Date(timestamp).toISOString();
}

export async function buildAuditLedgerDigest(event: AuditLedgerEvent): Promise<string> {
  const envelope = {
    digestVersion: event.digestVersion,
    eventId: event.eventId,
    organizationId: event.organizationId,
    tenantId: event.tenantId,
    workflowId: event.workflowId,
    taskId: event.taskId,
    actorId: event.actorId,
    actionType: event.actionType,
    metadata: event.metadata,
    previousStateHash: event.previousStateHash,
    nonce: event.nonce,
    createdAt: canonicalizeTimestamp(event.createdAt)
  };

  const bytes = new TextEncoder().encode(canonicalizeJson(envelope));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
