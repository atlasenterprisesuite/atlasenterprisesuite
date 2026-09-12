import type { AtlasPermission } from '../../core/src/index';
import { approvalRequiredFor, assertApprovalSatisfied, type AtlasApprovalRequest } from './approvals';
import { canCompleteWorkflow, transitionWorkflow } from './state-machine';
import { verifyEvidenceRequirements, verifiedEvidenceIds, type AtlasEvidence } from './evidence';
import type { ProviderRegistry } from './providers';
import type { ExecutionStore } from './store';
import type { ToolRegistry, AtlasToolDefinition } from './tools';
import type { AtlasUsageDecision } from './usage';
import type { AtlasWorkflow, AtlasWorkflowEvent, AtlasWorkflowStep } from './types';

export type ExecutionRuntimeAuthorizeInput = {
  organizationId: string;
  actorId: string;
  taskId: string;
  stepId: string;
  permission: AtlasPermission;
};

export type ExecutionRuntimeDependencies = {
  store: ExecutionStore;
  tools: ToolRegistry;
  providers: ProviderRegistry;
  authorize(input: ExecutionRuntimeAuthorizeInput): boolean | Promise<boolean>;
  approvals: {
    getApproval(input: { organizationId: string; taskId: string; stepId: string }): Promise<Pick<AtlasApprovalRequest, 'status' | 'expiresAt'> | null>;
  };
  usage: {
    evaluate(input: { organizationId: string; actorId: string; taskId: string; stepId: string; tool: AtlasToolDefinition }): AtlasUsageDecision | Promise<AtlasUsageDecision>;
  };
  evidence: {
    list(input: { organizationId: string; taskId: string; stepId: string }): Promise<AtlasEvidence[]>;
    append(records: AtlasEvidence[]): Promise<void>;
  };
};

export type RunExecutionStepInput = {
  workflow: AtlasWorkflow;
  step: AtlasWorkflowStep;
  actorId: string;
  capabilityId: string;
  input: unknown;
};

export type RunExecutionStepResult = {
  ok: boolean;
  error: string | null;
  workflowStatus: AtlasWorkflow['status'];
  evidenceSatisfied: boolean;
  resultRefs: string[];
  traceId: string;
};

function errorCode(error: unknown, fallback = 'internal_error'): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function buildEvent(
  input: RunExecutionStepInput,
  eventType: string,
  sequence: number,
  metadata: Record<string, unknown> = {}
): AtlasWorkflowEvent {
  return {
    eventId: `${input.workflow.traceId}:${input.step.stepId}:${eventType}:${sequence}`,
    taskId: input.workflow.taskId,
    stepId: input.step.stepId,
    organizationId: input.workflow.organizationId,
    traceId: input.workflow.traceId,
    eventType,
    actorId: input.actorId,
    createdAt: new Date().toISOString(),
    metadata
  };
}

function requiredEvidenceIds(step: AtlasWorkflowStep): string[] {
  return step.evidenceRequirements.filter((requirement) => requirement.required).map((requirement) => requirement.evidenceId);
}

function completionSatisfied(
  step: AtlasWorkflowStep,
  tool: AtlasToolDefinition,
  evidence: readonly AtlasEvidence[]
): boolean {
  if (!verifyEvidenceRequirements(tool.evidenceTypes, evidence)) return false;
  return canCompleteWorkflow({
    requiredEvidenceIds: requiredEvidenceIds(step),
    verifiedEvidenceIds: verifiedEvidenceIds(evidence)
  });
}

function dedupeEvidence(records: readonly AtlasEvidence[]): AtlasEvidence[] {
  const byId = new Map<string, AtlasEvidence>();
  for (const record of records) byId.set(record.evidenceId, record);
  return [...byId.values()];
}

export function createExecutionRuntime(dependencies: ExecutionRuntimeDependencies) {
  return {
    async runStep(input: RunExecutionStepInput): Promise<RunExecutionStepResult> {
      const { workflow, step, actorId, capabilityId } = input;
      let sequence = 0;
      const append = async (eventType: string, metadata: Record<string, unknown> = {}) => {
        sequence += 1;
        await dependencies.store.appendEvent(buildEvent(input, eventType, sequence, metadata));
      };
      const fail = async (error: string, workflowStatus = workflow.status): Promise<RunExecutionStepResult> => ({
        ok: false,
        error,
        workflowStatus,
        evidenceSatisfied: false,
        resultRefs: [],
        traceId: workflow.traceId
      });

      if (
        !workflow.organizationId ||
        workflow.taskId !== step.taskId ||
        workflow.currentStep !== step.stepId ||
        !actorId
      ) {
        await append('validation_failed', { code: 'invalid_input' });
        return fail('invalid_input');
      }

      const tool = dependencies.tools.getByCapability(capabilityId);
      if (!tool) {
        await append('validation_failed', { code: 'tool_not_found' });
        return fail('tool_not_found');
      }

      if (tool.executionClass !== step.executionClass) {
        await append('validation_failed', { code: 'execution_class_mismatch' });
        return fail('validation_failed');
      }

      const authorized = await dependencies.authorize({
        organizationId: workflow.organizationId,
        actorId,
        taskId: workflow.taskId,
        stepId: step.stepId,
        permission: tool.permission
      });
      await append('authorization', { allowed: authorized, permission: tool.permission });
      if (!authorized) return fail('forbidden');

      if (tool.providerId) {
        if (!tool.providerCapability) {
          await append('provider_check', { allowed: false, code: 'provider_capability_unavailable' });
          return fail('provider_capability_unavailable');
        }
        try {
          dependencies.providers.assertCapability(tool.providerId, tool.providerCapability);
          await append('provider_check', { allowed: true, providerId: tool.providerId, capability: tool.providerCapability });
        } catch (error) {
          const code = errorCode(error, 'provider_unavailable');
          await append('provider_check', { allowed: false, code });
          return fail(code);
        }
      }

      const usageDecision = await dependencies.usage.evaluate({
        organizationId: workflow.organizationId,
        actorId,
        taskId: workflow.taskId,
        stepId: step.stepId,
        tool
      });
      await append('usage_policy', { allowed: usageDecision.allowed, reason: usageDecision.reason, estimatedCost: usageDecision.estimatedCost });
      if (usageDecision.reason === 'budget_blocked') return fail('budget_blocked', 'blocked');

      const policyRequiresApproval = approvalRequiredFor({
        executionClass: tool.executionClass,
        risk: tool.risk,
        estimatedCost: usageDecision.estimatedCost,
        approvalCostThreshold: usageDecision.reason === 'approval_required' ? Math.max(0, usageDecision.estimatedCost - Number.EPSILON) : undefined
      });
      const approvalRequired = policyRequiresApproval || usageDecision.reason === 'approval_required';

      if (approvalRequired) {
        const approval = await dependencies.approvals.getApproval({
          organizationId: workflow.organizationId,
          taskId: workflow.taskId,
          stepId: step.stepId
        });
        try {
          assertApprovalSatisfied({ required: true, approval });
          await append('approval', { satisfied: true });
        } catch {
          let status = workflow.status;
          try {
            status = transitionWorkflow(workflow.status, 'request_approval');
          } catch {
            status = 'awaiting_approval';
          }
          const updated = {
            ...workflow,
            status,
            nextAction: 'Review pending approval',
            updatedAt: new Date().toISOString()
          };
          await dependencies.store.saveWorkflow(updated);
          await append('approval_required', { satisfied: false });
          return fail('approval_required', status);
        }
      }

      if (tool.idempotency === 'required' && !step.idempotencyKey) {
        await append('validation_failed', { code: 'idempotency_required' });
        return fail('validation_failed');
      }

      const existingEvidence = await dependencies.evidence.list({
        organizationId: workflow.organizationId,
        taskId: workflow.taskId,
        stepId: step.stepId
      });

      let toolResult;
      try {
        toolResult = await tool.execute(input.input, {
          organizationId: workflow.organizationId,
          actorId,
          taskId: workflow.taskId,
          stepId: step.stepId,
          traceId: workflow.traceId,
          idempotencyKey: step.idempotencyKey
        });
      } catch {
        await append('execution', { ok: false, code: 'internal_error' });
        return fail('internal_error');
      }

      await append('execution', { ok: toolResult.ok, ambiguous: Boolean(toolResult.ambiguous), resultRefCount: toolResult.resultRefs.length });
      if (toolResult.ambiguous) return fail('ambiguous_external_result');
      if (!toolResult.ok) return fail(toolResult.errorCode ?? 'internal_error');

      if (toolResult.evidence.length > 0) await dependencies.evidence.append(toolResult.evidence);
      const allEvidence = dedupeEvidence([...existingEvidence, ...toolResult.evidence]);
      const evidenceSatisfied = completionSatisfied(step, tool, allEvidence);
      await append('validation', { evidenceSatisfied });
      await append('evidence', { count: allEvidence.length, verifiedCount: verifiedEvidenceIds(allEvidence).length });

      let workflowStatus = workflow.status;
      if (evidenceSatisfied && workflow.status === 'now') {
        workflowStatus = transitionWorkflow(workflow.status, 'complete');
        const completed = {
          ...workflow,
          status: workflowStatus,
          evidenceIds: verifiedEvidenceIds(allEvidence),
          nextAction: null,
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await dependencies.store.saveWorkflow(completed);
        await append('completion', { evidenceSatisfied: true });
      } else if (!evidenceSatisfied) {
        await dependencies.store.saveWorkflow({
          ...workflow,
          nextAction: 'Validate required evidence',
          updatedAt: new Date().toISOString()
        });
      }

      return {
        ok: true,
        error: null,
        workflowStatus,
        evidenceSatisfied,
        resultRefs: [...toolResult.resultRefs],
        traceId: workflow.traceId
      };
    }
  };
}
