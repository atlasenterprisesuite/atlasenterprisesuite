export const workWorkflowFixtures = [
  {
    id: 'wf-now', organizationId: 'org-1', ownerModule: 'manager', status: 'now', currentTaskId: 'task-now', currentModule: 'manager',
    createdAt: '2026-09-12T10:00:00Z', updatedAt: '2026-09-12T10:05:00Z', completedAt: null,
    work: { executionMode: 'hybrid', autonomyLevel: 'guided', runtimePreference: 'auto', budgetLimit: 0, connectionRefs: [] }
  },
  {
    id: 'wf-approval', organizationId: 'org-1', ownerModule: 'manager', status: 'awaiting_approval', currentTaskId: 'task-approval', currentModule: 'manager',
    createdAt: '2026-09-12T11:00:00Z', updatedAt: '2026-09-12T11:05:00Z', completedAt: null,
    work: { executionMode: 'api', autonomyLevel: 'manual', runtimePreference: 'local', budgetLimit: 0, connectionRefs: ['conn-cloudflare'] }
  },
  {
    id: 'wf-completed', organizationId: 'org-1', ownerModule: 'finance', status: 'completed', currentTaskId: 'task-completed', currentModule: 'finance',
    createdAt: '2026-09-11T09:00:00Z', updatedAt: '2026-09-11T09:30:00Z', completedAt: '2026-09-11T09:30:00Z',
    work: { executionMode: 'api', autonomyLevel: 'guided', runtimePreference: 'auto', budgetLimit: 0, connectionRefs: [] }
  },
  {
    id: 'wf-blocked', organizationId: 'org-1', ownerModule: 'studio', status: 'blocked', currentTaskId: 'task-blocked', currentModule: 'studio',
    createdAt: '2026-09-12T12:00:00Z', updatedAt: '2026-09-12T12:05:00Z', completedAt: null,
    work: { executionMode: 'browser', autonomyLevel: 'guided', runtimePreference: 'self_hosted', budgetLimit: 0, connectionRefs: [] }
  },
  {
    id: 'wf-failed', organizationId: 'org-1', ownerModule: 'ride', status: 'failed', currentTaskId: 'task-failed', currentModule: 'ride',
    createdAt: '2026-09-10T12:00:00Z', updatedAt: '2026-09-10T12:05:00Z', completedAt: null,
    work: { executionMode: 'hybrid', autonomyLevel: 'guided', runtimePreference: 'auto', budgetLimit: 0, connectionRefs: [] }
  },
  {
    id: 'wf-cancelled', organizationId: 'org-1', ownerModule: 'payroll', status: 'cancelled', currentTaskId: 'task-cancelled', currentModule: 'payroll',
    createdAt: '2026-09-09T12:00:00Z', updatedAt: '2026-09-09T12:05:00Z', completedAt: null,
    work: { executionMode: 'hybrid', autonomyLevel: 'guided', runtimePreference: 'auto', budgetLimit: 0, connectionRefs: [] }
  }
] as const;
