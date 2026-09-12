import { describe, expect, it } from 'vitest';
import {
  EXECUTION_STATUSES,
  USER_FACING_EXECUTION_STATUSES,
  executionPermissionsForRole,
  type ExecutionTask
} from '../../packages/execution/src';

describe('ATLAS execution domain vocabulary', () => {
  it('exports the universal user-facing states without arbitrary module status strings', () => {
    expect(USER_FACING_EXECUTION_STATUSES).toEqual([
      'now',
      'next',
      'blocked',
      'awaiting_approval',
      'completed'
    ]);
    expect(EXECUTION_STATUSES).toContain('failed');
    expect(EXECUTION_STATUSES).toContain('cancelled');
  });

  it('maps organization roles only to execution-layer permissions', () => {
    expect(executionPermissionsForRole('owner')).toEqual([
      'execution.read',
      'execution.write',
      'execution.approve',
      'execution.audit',
      'execution.admin'
    ]);
    expect(executionPermissionsForRole('member')).toEqual(['execution.read']);
    expect(executionPermissionsForRole('admin')).not.toContain('payroll.write');
  });

  it('keeps authoritative domain records as references instead of shadow data', () => {
    const task: ExecutionTask = {
      id: 'task-1',
      scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
      module: 'hr',
      ownerUserId: 'user-1',
      title: 'Provision payroll enrollment',
      intent: 'Complete employee onboarding',
      goal: 'Create payroll enrollment from the authoritative HR employee',
      status: 'now',
      priority: 'high',
      currentStepId: 'step-1',
      nextAction: 'Validate payroll prerequisites',
      blockedReason: null,
      permissionsRequired: ['payroll.write'],
      source: { type: 'employee', id: 'employee-42' },
      parentTaskId: null,
      workflowId: 'workflow-1',
      version: 1,
      createdAt: '2026-09-12T12:00:00.000Z',
      updatedAt: '2026-09-12T12:00:00.000Z',
      completedAt: null
    };

    expect(task.source).toEqual({ type: 'employee', id: 'employee-42' });
    expect(task).not.toHaveProperty('employeeRecord');
  });
});
