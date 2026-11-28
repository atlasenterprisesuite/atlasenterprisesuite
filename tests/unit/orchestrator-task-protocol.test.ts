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

describe('ATLAS task protocol evidence shape (777)', () => {
  const task = {
    schemaVersion: 1, taskId: 'test-task', objective: 'Verify evidence', requestedBy: 'user',
    scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
    assignedAgents: [], state: 'verified', artifacts: [], findings: [], commits: [],
    tests: [{ name: 'unit', status: 'passed', evidence: 'receipt-1' }],
    approvals: [{ actorId: 'reviewer', result: 'approved', target: 'release', createdAt: '2026-09-06T00:00:00.000Z' }],
    events: [], traceId: null,
    deployment: { id: 'deploy-1', status: 'verified', url: null },
    createdAt: '2026-09-06T00:00:00.000Z', updatedAt: '2026-09-06T00:00:00.000Z'
  };

  it('preserves valid evidence and nullable pending fields', () => {
    expect(AtlasTaskSchema.safeParse(task).success).toBe(true);
    expect(AtlasTaskSchema.safeParse({ ...task, tests: [{ name: 'unit', status: 'failed', evidence: null }], deployment: null }).success).toBe(true);
  });

  it.each([
    ['tests', [null]], ['tests', [{ name: 'unit', status: 'passed', evidence: 123 }]],
    ['tests', [{ name: 'unit', status: 'unknown', evidence: 'receipt' }]],
    ['approvals', [{ result: 'approved' }]], ['deployment', { status: 'verified' }],
    ['deployment', { id: 'd', status: 'unknown', url: null }],
    ['commits', [{ repo: 'repo', sha: 123, url: null }]],
    ['artifacts', [{}]], ['findings', [{ id: 'f', summary: 'x', severity: 'unknown' }]],
    ['events', [{ eventId: 'e' }]]
  ])('rejects malformed %s', (key, value) => {
    expect(AtlasTaskSchema.safeParse({ ...task, [key]: value }).success).toBe(false);
  });
});
