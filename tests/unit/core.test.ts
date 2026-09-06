import { describe, expect, it } from 'vitest';
import {
  InMemoryAuditSink,
  err,
  hasPermission,
  ok,
  sameScope,
  type AuditEvent,
  type Result
} from '../../packages/core/src';

describe('ATLAS Core contracts', () => {
  it('requires tenant and organization to match', () => {
    expect(sameScope(
      { tenantId: 'tenant-a', organizationId: 'org-a' },
      { tenantId: 'tenant-a', organizationId: 'org-a' }
    )).toBe(true);

    expect(sameScope(
      { tenantId: 'tenant-a', organizationId: 'org-a' },
      { tenantId: 'tenant-a', organizationId: 'org-b' }
    )).toBe(false);
  });

  it('requires explicit permission unless the matching accounting admin permission applies', () => {
    expect(hasPermission(['accounting.read'], 'accounting.post')).toBe(false);
    expect(hasPermission(['accounting.admin'], 'accounting.post')).toBe(true);
    expect(hasPermission(['ride.read'], 'ride.read')).toBe(true);
    expect(hasPermission(['accounting.admin'], 'ride.read')).toBe(false);
    expect(hasPermission(['telecom.mifi.read'], 'telecom.mifi.forwarding.write')).toBe(false);
  });

  it('scopes audit events by both tenant and organization', () => {
    const sink = new InMemoryAuditSink();
    const event: AuditEvent = {
      id: 'audit-1',
      tenantId: 'tenant-a',
      organizationId: 'org-a',
      actorId: 'user-1',
      action: 'journal.post',
      entityType: 'journal',
      entityId: 'journal-1',
      before: { status: 'draft' },
      after: { status: 'posted' },
      timestamp: '2026-09-03T17:30:00Z',
      correlationId: 'corr-1'
    };

    sink.append(event);

    expect(sink.list({ tenantId: 'tenant-a', organizationId: 'org-a' })).toEqual([event]);
    expect(sink.list({ tenantId: 'tenant-a', organizationId: 'org-b' })).toEqual([]);
  });

  it('returns defensive audit snapshots', () => {
    const sink = new InMemoryAuditSink();
    sink.append({
      id: 'audit-2',
      tenantId: 'tenant-a',
      organizationId: 'org-a',
      actorId: 'user-1',
      action: 'account.update',
      entityType: 'account',
      entityId: 'account-1',
      before: { name: 'Cash' },
      after: { name: 'Operating Cash' },
      timestamp: '2026-09-03T17:31:00Z',
      correlationId: 'corr-2'
    });

    const first = sink.list({ tenantId: 'tenant-a', organizationId: 'org-a' });
    first.splice(0, 1);

    expect(sink.list({ tenantId: 'tenant-a', organizationId: 'org-a' })).toHaveLength(1);
  });

  it('provides typed success and failure results', () => {
    const success: Result<number, string> = ok(42);
    const failure: Result<number, string> = err('blocked');

    expect(success).toEqual({ ok: true, value: 42 });
    expect(failure).toEqual({ ok: false, error: 'blocked' });
  });
});
