import { assertBoundedMetadata } from './canonicalize';
import { buildAuditLedgerDigest } from './digest';
import { verifyAuditChain } from './verify';
import type {
  AuditChainVerification,
  AuditEventPayload,
  AuditLedgerEvent,
  AuditLedgerScope,
  AuditLedgerService,
  AuditLedgerStore
} from './types';

const MAX_APPEND_ATTEMPTS = 3;

function scopeFrom(event: AuditEventPayload): AuditLedgerScope {
  return {
    organizationId: event.organizationId,
    tenantId: event.tenantId,
    workflowId: event.workflowId
  };
}

function isStaleHead(error: unknown): boolean {
  return error instanceof Error && error.message === 'audit_ledger_stale_head';
}

function nextCreatedAt(headCreatedAt?: string): string {
  const now = Date.now();
  if (!headCreatedAt) return new Date(now).toISOString();
  const headTime = Date.parse(headCreatedAt);
  if (!Number.isFinite(headTime)) throw new Error('audit_ledger_read_failed');
  return new Date(Math.max(now, headTime + 1)).toISOString();
}

export class AuditLedgerServiceImpl implements AuditLedgerService {
  constructor(private readonly store: AuditLedgerStore) {}

  async recordEvent(payload: AuditEventPayload): Promise<{ eventId: string; digest: string }> {
    assertBoundedMetadata(payload.metadata);
    const scope = scopeFrom(payload);

    for (let attempt = 1; attempt <= MAX_APPEND_ATTEMPTS; attempt += 1) {
      const head = await this.store.readHead(scope);
      const event: AuditLedgerEvent = {
        ...payload,
        eventId: crypto.randomUUID(),
        previousStateHash: head?.payloadDigest || 'GENESIS_BLOCK',
        nonce: crypto.randomUUID(),
        digestVersion: 1,
        createdAt: nextCreatedAt(head?.createdAt),
        payloadDigest: ''
      };
      event.payloadDigest = await buildAuditLedgerDigest(event);

      try {
        const persisted = await this.store.append(event);
        return { eventId: persisted.eventId, digest: persisted.payloadDigest };
      } catch (error) {
        if (!isStaleHead(error) || attempt === MAX_APPEND_ATTEMPTS) throw error;
      }
    }

    throw new Error('audit_ledger_persistence_failed');
  }

  async verifyChainIntegrity(
    scope: AuditLedgerScope,
    options: { allowEmpty?: boolean } = {}
  ): Promise<AuditChainVerification> {
    const events = await this.store.readChain(scope);
    if (events.some((event) =>
      event.organizationId !== scope.organizationId
      || event.tenantId !== scope.tenantId
      || event.workflowId !== scope.workflowId
    )) {
      return { valid: false, eventCount: events.length, reason: 'audit_ledger_invalid_scope' };
    }
    return verifyAuditChain(events, options);
  }
}
