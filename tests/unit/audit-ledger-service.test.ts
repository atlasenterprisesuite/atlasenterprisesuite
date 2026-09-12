import { describe, expect, it } from 'vitest';
import {
  AuditLedgerServiceImpl,
  buildAuditLedgerDigest,
  type AuditEventPayload,
  type AuditLedgerEvent,
  type AuditLedgerHead,
  type AuditLedgerScope,
  type AuditLedgerStore
} from '../../packages/audit-ledger/src/index';

class MemoryStore implements AuditLedgerStore {
  appendAttempts = 0;
  attempts: AuditLedgerEvent[] = [];
  events: AuditLedgerEvent[] = [];
  staleFailuresRemaining = 0;
  injectedHead: AuditLedgerHead | null = null;

  async readHead(_scope: AuditLedgerScope): Promise<AuditLedgerHead | null> {
    if (this.injectedHead) return this.injectedHead;
    const last = this.events[this.events.length - 1];
    return last ? { eventId: last.eventId, payloadDigest: last.payloadDigest, createdAt: last.createdAt } : null;
  }

  async readChain(_scope: AuditLedgerScope): Promise<AuditLedgerEvent[]> {
    return [...this.events];
  }

  async append(event: AuditLedgerEvent): Promise<AuditLedgerEvent> {
    this.appendAttempts += 1;
    this.attempts.push(event);
    if (this.staleFailuresRemaining > 0) {
      this.staleFailuresRemaining -= 1;
      this.injectedHead = {
        eventId: '99999999-9999-4999-8999-999999999999',
        payloadDigest: 'a'.repeat(64),
        createdAt: '2030-01-01T00:00:00.000Z'
      };
      throw new Error('audit_ledger_stale_head');
    }
    this.injectedHead = null;
    this.events.push(event);
    return event;
  }
}

const payload: AuditEventPayload = {
  organizationId: '22222222-2222-4222-8222-222222222222',
  tenantId: 'tenant-1',
  workflowId: '33333333-3333-4333-8333-333333333333',
  taskId: '44444444-4444-4444-8444-444444444444',
  actorId: '55555555-5555-4555-8555-555555555555',
  actionType: 'TASK_STARTED',
  metadata: { safe: true }
};

const scope: AuditLedgerScope = {
  organizationId: payload.organizationId,
  tenantId: payload.tenantId,
  workflowId: payload.workflowId
};

describe('ATLAS Audit Ledger recording service', () => {
  it('records the first event against GENESIS_BLOCK', async () => {
    const store = new MemoryStore();
    const service = new AuditLedgerServiceImpl(store);
    const result = await service.recordEvent(payload);
    expect(store.events[0].previousStateHash).toBe('GENESIS_BLOCK');
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(store.events[0].payloadDigest).toBe(await buildAuditLedgerDigest(store.events[0]));
  });

  it('refreshes head, timestamp, nonce and digest after a stale-head conflict', async () => {
    const store = new MemoryStore();
    store.staleFailuresRemaining = 1;
    const service = new AuditLedgerServiceImpl(store);
    await service.recordEvent(payload);
    expect(store.appendAttempts).toBe(2);
    expect(store.attempts[1].previousStateHash).toBe('a'.repeat(64));
    expect(store.attempts[1].createdAt > '2030-01-01T00:00:00.000Z').toBe(true);
    expect(store.attempts[1].nonce).not.toBe(store.attempts[0].nonce);
    expect(store.attempts[1].payloadDigest).not.toBe(store.attempts[0].payloadDigest);
  });

  it('retries stale heads at most three total attempts', async () => {
    const store = new MemoryStore();
    store.staleFailuresRemaining = 3;
    const service = new AuditLedgerServiceImpl(store);
    await expect(service.recordEvent(payload)).rejects.toThrow('audit_ledger_stale_head');
    expect(store.appendAttempts).toBe(3);
  });

  it('rejects oversized metadata before persistence', async () => {
    const store = new MemoryStore();
    const service = new AuditLedgerServiceImpl(store);
    await expect(service.recordEvent({ ...payload, metadata: { data: 'x'.repeat(17 * 1024) } }))
      .rejects.toThrow('audit_ledger_metadata_too_large');
    expect(store.appendAttempts).toBe(0);
  });

  it('verifies the persisted chain through the service contract', async () => {
    const store = new MemoryStore();
    const service = new AuditLedgerServiceImpl(store);
    await service.recordEvent(payload);
    await service.recordEvent({
      ...payload,
      actionType: 'execution.task.transitioned',
      metadata: { safe: true, n: 2 }
    });
    expect(await service.verifyChainIntegrity(scope)).toEqual({ valid: true, eventCount: 2 });
  });
});
