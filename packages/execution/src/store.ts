import type {
  ExecutionApproval,
  ExecutionAuditEvent,
  ExecutionEvidence,
  ExecutionStep,
  ExecutionTask
} from './types';

export interface ExecutionStore {
  getTask(taskId: string): Promise<ExecutionTask | null>;
  saveTask(task: ExecutionTask): Promise<void>;
  listSteps(taskId: string): Promise<ExecutionStep[]>;
  saveStep(step: ExecutionStep): Promise<void>;
  listEvidence(taskId: string): Promise<ExecutionEvidence[]>;
  appendEvidence(evidence: ExecutionEvidence): Promise<void>;
  listApprovals(taskId: string): Promise<ExecutionApproval[]>;
  appendAudit(event: ExecutionAuditEvent): Promise<void>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryExecutionStore implements ExecutionStore {
  private readonly tasks = new Map<string, ExecutionTask>();
  private readonly steps = new Map<string, ExecutionStep>();
  private readonly evidence: ExecutionEvidence[] = [];
  private readonly approvals: ExecutionApproval[] = [];
  private readonly auditEvents: ExecutionAuditEvent[] = [];

  static seeded() {
    const store = new MemoryExecutionStore();
    const now = '2026-09-12T12:00:00.000Z';
    store.tasks.set('task-1', {
      id: 'task-1',
      scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
      module: 'payroll',
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
      createdAt: now,
      updatedAt: now,
      completedAt: null
    });
    store.steps.set('step-1', {
      id: 'step-1',
      taskId: 'task-1',
      sequence: 1,
      module: 'payroll',
      actionType: 'enroll_employee',
      actionPayload: { employeeId: 'employee-42' },
      status: 'pending',
      completionCriteria: ['payroll enrollment verified'],
      permissionsRequired: ['payroll.write'],
      dependencyIds: [],
      evidenceRequirement: ['payroll_record'],
      startedAt: null,
      completedAt: null
    });
    return store;
  }

  putTask(task: ExecutionTask) {
    this.tasks.set(task.id, clone(task));
  }

  putStep(step: ExecutionStep) {
    this.steps.set(step.id, clone(step));
  }

  async getTask(taskId: string) {
    const task = this.tasks.get(taskId);
    return task ? clone(task) : null;
  }

  async saveTask(task: ExecutionTask) {
    this.tasks.set(task.id, clone(task));
  }

  async listSteps(taskId: string) {
    return [...this.steps.values()]
      .filter((step) => step.taskId === taskId)
      .map(clone);
  }

  async saveStep(step: ExecutionStep) {
    this.steps.set(step.id, clone(step));
  }

  async listEvidence(taskId: string) {
    return this.evidence.filter((item) => item.taskId === taskId).map(clone);
  }

  async appendEvidence(evidence: ExecutionEvidence) {
    this.evidence.push(clone(evidence));
  }

  async listApprovals(taskId: string) {
    return this.approvals.filter((item) => item.taskId === taskId).map(clone);
  }

  async appendAudit(event: ExecutionAuditEvent) {
    this.auditEvents.push(clone(event));
  }
}
