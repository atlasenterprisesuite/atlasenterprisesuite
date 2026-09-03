import { describe, expect, it } from 'vitest';
import { assertTenantMatch, can, createAuditEvent } from './index';

describe('ATLAS core security contracts', () => {
  it('enforces least privilege for research roles', () => {
    expect(can('research_viewer', 'evidence:read')).toBe(true);
    expect(can('research_viewer', 'evidence:write')).toBe(false);
    expect(can('research_editor', 'evidence:write')).toBe(true);
    expect(can('research_editor', 'settings:manage')).toBe(false);
    expect(can('research_admin', 'settings:manage')).toBe(true);
    expect(can('research_admin', 'patient-data:read')).toBe(false);
  });

  it('rejects cross-tenant access even when a role has the requested capability', () => {
    expect(() => assertTenantMatch(
      { tenantId: 'tenant-a', actorId: 'actor-1', role: 'research_admin', environment: 'development' },
      'tenant-b'
    )).toThrow(/tenant boundary/i);
  });

  it('creates deterministic audit-ready mutation envelopes without secrets or patient data', () => {
    const event = createAuditEvent({
      tenantId: 'tenant-a',
      actorId: 'actor-1',
      action: 'evidence:create',
      resourceType: 'evidence',
      resourceId: 'ev-123',
      occurredAt: '2026-09-03T07:20:00Z'
    });

    expect(event).toEqual({
      version: 1,
      tenantId: 'tenant-a',
      actorId: 'actor-1',
      action: 'evidence:create',
      resourceType: 'evidence',
      resourceId: 'ev-123',
      occurredAt: '2026-09-03T07:20:00Z'
    });
    expect(JSON.stringify(event)).not.toMatch(/password|secret|patient/i);
  });
});
