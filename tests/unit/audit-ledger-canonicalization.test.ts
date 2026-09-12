import { describe, expect, it } from 'vitest';
import {
  assertBoundedMetadata,
  buildAuditLedgerDigest,
  canonicalizeJson,
  type AuditLedgerEvent
} from '../../packages/audit-ledger/src/index';

function fixtureEvent(): AuditLedgerEvent {
  return {
    eventId: '11111111-1111-4111-8111-111111111111',
    organizationId: '22222222-2222-4222-8222-222222222222',
    tenantId: 'tenant-1',
    workflowId: '33333333-3333-4333-8333-333333333333',
    taskId: '44444444-4444-4444-8444-444444444444',
    actorId: '55555555-5555-4555-8555-555555555555',
    actionType: 'TASK_STARTED',
    metadata: { z: 9, nested: { b: true, a: false } },
    previousStateHash: 'GENESIS_BLOCK',
    nonce: '66666666-6666-4666-8666-666666666666',
    digestVersion: 1,
    createdAt: '2026-09-12T13:00:00.000Z',
    payloadDigest: ''
  };
}

describe('ATLAS Audit Ledger canonical hashing', () => {
  it('canonicalizes object keys recursively while preserving array order', () => {
    expect(canonicalizeJson({ b: 2, a: { d: 4, c: 3 }, list: [2, 1] }))
      .toBe('{"a":{"c":3,"d":4},"b":2,"list":[2,1]}');
  });

  it('uses locale-independent UTF-16 code-unit key ordering', () => {
    expect(canonicalizeJson({ 'ä': 1, z: 2, A: 3, a: 4 }))
      .toBe('{"A":3,"a":4,"z":2,"ä":1}');
  });

  it('produces the same SHA-256 digest for semantically identical object-key order', async () => {
    const event = fixtureEvent();
    const reordered = {
      ...event,
      metadata: { nested: { a: false, b: true }, z: 9 }
    };
    const digest = await buildAuditLedgerDigest(event);
    expect(digest).toBe(await buildAuditLedgerDigest(reordered));
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes the digest when a persisted hashed field changes', async () => {
    const event = fixtureEvent();
    expect(await buildAuditLedgerDigest(event))
      .not.toBe(await buildAuditLedgerDigest({ ...event, taskId: '77777777-7777-4777-8777-777777777777' }));
  });

  it('rejects metadata larger than 16 KiB before persistence', () => {
    expect(() => assertBoundedMetadata({ ok: 'x'.repeat(100) })).not.toThrow();
    expect(() => assertBoundedMetadata({ data: 'x'.repeat(17 * 1024) }))
      .toThrow('audit_ledger_metadata_too_large');
  });

  it('fails closed instead of silently dropping non-JSON values', () => {
    expect(() => canonicalizeJson({ unsafe: undefined })).toThrow('audit_ledger_invalid_json');
    expect(() => canonicalizeJson({ unsafe: Number.NaN })).toThrow('audit_ledger_invalid_json');
    expect(() => canonicalizeJson({ unsafe: BigInt(1) })).toThrow('audit_ledger_invalid_json');
  });
});
