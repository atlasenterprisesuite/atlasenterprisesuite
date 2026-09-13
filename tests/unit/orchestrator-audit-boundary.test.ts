import { describe, expect, it } from 'vitest';
import { classifyIncidentRisk } from '../../apps/web/src/modules/orchestrator/incidents';

describe('ATLAS audit boundary', () => {
  it('requires approval before audit-affecting actions', () => {
    expect(classifyIncidentRisk({ module: 'audit', summary: 'Change audit policy', category: 'audit' })).toBe('approval-required');
  });
});
