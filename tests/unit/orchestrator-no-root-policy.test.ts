import { describe, expect, it } from 'vitest';
import { classifyIncidentRisk } from '../../apps/web/src/modules/orchestrator/incidents';

describe('ATLAS no-agent-root invariant', () => {
  it('never treats permission changes as autonomous low-risk actions', () => {
    expect(classifyIncidentRisk({ module: 'core', summary: 'Grant privilege', category: 'permissions' })).toBe('approval-required');
  });
});
