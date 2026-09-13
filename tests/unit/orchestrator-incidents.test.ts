import { describe, expect, it } from 'vitest';
import { buildIncidentEvidenceEnvelope, classifyIncidentRisk } from '../../apps/web/src/modules/orchestrator/incidents';

describe('ATLAS self-healing incident governance', () => {
  it('allows only explicitly reversible incidents into the low-risk lane', () => {
    expect(classifyIncidentRisk({ module: 'payroll', summary: 'Retry idempotent sync', category: 'reversible' })).toBe('low');
  });

  it.each(['destructive', 'financial', 'permissions', 'security', 'audit', 'irreversible'] as const)('requires approval for %s incidents', (category) => {
    expect(classifyIncidentRisk({ module: 'core', summary: 'Sensitive change', category })).toBe('approval-required');
  });

  it('creates timestamped evidence before resolution can be claimed', () => {
    const envelope = buildIncidentEvidenceEnvelope({ module: 'inventory', summary: 'Repair failed sync', category: 'reversible', organizationId: 'org-a', tenantId: 'tenant-a' }, new Date('2026-09-13T04:00:00.000Z'));
    expect(envelope).toMatchObject({ module: 'inventory', risk: 'low', organizationId: 'org-a', tenantId: 'tenant-a', createdAt: '2026-09-13T04:00:00.000Z' });
  });
});
