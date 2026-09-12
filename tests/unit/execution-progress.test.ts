import { describe, expect, it } from 'vitest';
import {
  assertSameScope,
  buildContextHandoff,
  resolveCurrentStep,
  type ExecutionStep
} from '../../packages/execution/src';

const baseSteps: ExecutionStep[] = [
  {
    id: 'hr-verify', taskId: 'task-1', sequence: 1, module: 'hr', actionType: 'verify_employee',
    actionPayload: {}, status: 'completed', completionCriteria: [], permissionsRequired: [],
    dependencyIds: [], evidenceRequirement: [], startedAt: null, completedAt: '2026-09-12T12:00:00.000Z'
  },
  {
    id: 'payroll-enroll', taskId: 'task-1', sequence: 2, module: 'payroll', actionType: 'enroll_employee',
    actionPayload: {}, status: 'pending', completionCriteria: [], permissionsRequired: ['payroll.write'],
    dependencyIds: ['hr-verify'], evidenceRequirement: ['payroll_record'], startedAt: null, completedAt: null
  }
];

describe('ATLAS execution progress', () => {
  it('selects the first dependency-satisfied unfinished step', () => {
    expect(resolveCurrentStep(baseSteps, new Set(['hr-verify']))?.id).toBe('payroll-enroll');
  });

  it('does not advance while a dependency is unresolved', () => {
    expect(resolveCurrentStep(baseSteps, new Set())).toBeNull();
  });

  it('hands off references and next action without copying source records', () => {
    expect(buildContextHandoff({
      workflowId: 'workflow-1',
      fromModule: 'hr',
      toModule: 'payroll',
      scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
      references: [{ type: 'employee', id: 'employee-42' }],
      nextAction: 'Enroll employee in payroll'
    })).toEqual({
      workflowId: 'workflow-1',
      fromModule: 'hr',
      toModule: 'payroll',
      scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
      references: [{ type: 'employee', id: 'employee-42' }],
      nextAction: 'Enroll employee in payroll'
    });
  });

  it('fails closed on cross-organization or cross-tenant context', () => {
    expect(() => assertSameScope(
      { tenantId: 'tenant-1', organizationId: 'org-1' },
      { tenantId: 'tenant-1', organizationId: 'org-2' }
    )).toThrow('execution_scope_mismatch');
  });
});
