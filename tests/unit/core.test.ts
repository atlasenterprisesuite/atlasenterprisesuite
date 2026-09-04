import { describe, expect, it } from 'vitest';
import { hasPermission, sameScope, InMemoryAuditSink } from '../../packages/core/src';

describe('ATLAS Core', () => {
  it('rejects cross-organization scope', () => {
    expect(sameScope(
      { tenantId: 't1', organizationId: 'o1' },
      { tenantId: 't1', organizationId: 'o2' }
    )).toBe(false);
  });

  it('requires explicit permission', () => {
    expect(hasPermission(['accounting.read'], 'accounting.post')).toBe(false);
  });

  it('lists audit events only for the requested scope', () => {
    const sink = new InMemoryAuditSink();
    sink.append({
      id: 'a1',
      tenantId: 't1',
      organizationId: 'o1',
      actorId: 'u1',
      action: 'journal.post',
      entityType: 'journal',
      entityId: 'j1',
      before: { status: 'draft' },
      after: { status: 'posted' },
      timestamp: '2026-09-03T16:00:00Z',
      correlationId: 'c1'
    });

    expect(sink.list({ tenantId: 't1', organizationId: 'o1' })).toHaveLength(1);
    expect(sink.list({ tenantId: 't1', organizationId: 'o2' })).toHaveLength(0);
  });
});
