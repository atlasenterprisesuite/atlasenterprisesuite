import { describe, expect, it } from 'vitest';
import { classifyIncidentRisk } from '../../apps/web/src/modules/orchestrator/incidents';

describe('ATLAS incident intake approval routing', () => {
  it('never sends sensitive categories to the autonomous low-risk lane', () => {
    const sensitive = ['destructive', 'financial', 'permissions', 'security', 'audit', 'irreversible'] as const;
    expect(sensitive.every((category) => classifyIncidentRisk({ module: 'core', summary: 'Sensitive incident', category }) === 'approval-required')).toBe(true);
  });
});
