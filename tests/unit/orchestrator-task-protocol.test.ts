import { describe, expect, it } from 'vitest';
import { AtlasTaskSchema, canTransition } from '../../packages/task-protocol/src';

describe('ATLAS task protocol', () => {
  it('enforces the governed path', () => {
    expect(canTransition('draft', 'queued')).toBe(true);
    expect(canTransition('implementation', 'review')).toBe(true);
    expect(canTransition('implementation', 'completed')).toBe(false);
    expect(canTransition('blocked', 'queued')).toBe(true);
    expect(canTransition('completed', 'queued')).toBe(false);
  });

  it('requires tenant and organization scope', () => {
    const result = AtlasTaskSchema.safeParse({
      schemaVersion: 1,
      taskId: 'ATL-2026-000184',
      objective: 'Coordinate ATLAS agents through one governed control plane',
      requestedBy: 'user',
      scope: { tenantId: 'tenant-demo', organizationId: 'org-demo' },
      assignedAgents: ['atlas-architect', 'atlas-copilot-engineer'],
      state: 'implementation',
      artifacts: [],
      findings: [],
      commits: [],
      tests: [],
      approvals: [],
      events: [],
      traceId: null,
      deployment: null,
      createdAt: '2026-09-06T00:00:00.000Z',
      updatedAt: '2026-09-06T00:00:00.000Z'
    });

    expect(result.success).toBe(true);
  });
});
