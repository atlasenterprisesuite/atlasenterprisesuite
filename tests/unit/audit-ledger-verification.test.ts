import { describe, expect, it } from 'vitest';
import {
  buildAuditLedgerDigest,
  verifyAuditChain,
  type AuditLedgerEvent
} from '../../packages/audit-ledger/src/index';

async function makeEvent(index: number, previousStateHash: string): Promise<AuditLedgerEvent> {
  const event: AuditLedgerEvent = {
    eventId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    organizationId: '22222222-2222-4222-8222-222222222222',
    tenantId: 'tenant-1',
    workflowId: '33333333-3333-4333-8333-333333333333',
    taskId: '44444444-4444-4444-8444-444444444444',
    actorId: '55555555-5555-4555-8555-555555555555',
    actionType: 'TASK_STARTED',
    metadata: { index },
    previousStateHash,
    nonce: `66666666-6666-4666-8666-${String(index).padStart(12, '0')}`,
    digestVersion: 1,
    createdAt: `2026-09-12T13:00:0${index}.000Z`,
    payloadDigest: ''
  };
  event.payloadDigest = await buildAuditLedgerDigest(event);
  return event;
}

async function makeValidChain() {
  const first = await makeEvent(1, 'GENESIS_BLOCK');
  const second = await makeEvent(2, first.payloadDigest);
  const third = await makeEvent(3, second.payloadDigest);
  return [first, second, third];
}

describe('ATLAS Audit Ledger chain verification', () => {
  it('verifies a valid chain in deterministic persisted order', async () => {
    const [first, second, third] = await makeValidChain();
    expect(await verifyAuditChain([third, first, second])).toEqual({ valid: true, eventCount: 3 });
  });

  it('detects a broken previous-state link', async () => {
    const [first, second] = await makeValidChain();
    const result = await verifyAuditChain([first, { ...second, previousStateHash: 'bad-head' }]);
    expect(result.valid).toBe(false);
    expect(result.firstInvalidEventId).toBe(second.eventId);
    expect(result.reason).toBe('audit_ledger_integrity_failed');
  });

  it('rejects metadata tampering even when links still appear continuous', async () => {
    const [first, second] = await makeValidChain();
    const result = await verifyAuditChain([first, { ...second, metadata: { index: 999 } }]);
    expect(result.valid).toBe(false);
    expect(result.firstInvalidEventId).toBe(second.eventId);
    expect(result.reason).toBe('audit_ledger_invalid_digest');
  });

  it('treats empty chains as invalid unless explicitly allowed', async () => {
    expect(await verifyAuditChain([])).toEqual({ valid: false, eventCount: 0, reason: 'audit_ledger_no_events' });
    expect(await verifyAuditChain([], { allowEmpty: true })).toEqual({ valid: true, eventCount: 0 });
  });
});
