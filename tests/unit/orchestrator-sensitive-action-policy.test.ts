import { describe, expect, it } from 'vitest';
import { classifyIncidentRisk } from '../../apps/web/src/modules/orchestrator/incidents';

describe('ATLAS sovereign approval policy', () => {
  it('requires approval for financial and security-boundary changes', () => {
    expect(classifyIncidentRisk({ module: 'payroll', summary: 'Move funds', category: 'financial' })).toBe('approval-required');
    expect(classifyIncidentRisk({ module: 'security', summary: 'Change security boundary', category: 'security' })).toBe('approval-required');
  });
});
