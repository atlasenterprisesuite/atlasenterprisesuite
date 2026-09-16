import type { AtlasOrchestrator } from '../../../../packages/ai-core/src';
import type { AtlasTask } from '../../../../packages/task-protocol/src';
import type { NightExecutor } from './nightOperationsSupervisor';

function taskEvidence(task: AtlasTask): string[] {
  const refs = new Set<string>();
  for (const test of task.tests) {
    if (test.status === 'passed' && test.evidence) refs.add(test.evidence);
  }
  for (const commit of task.commits) refs.add(commit.url ?? commit.sha);
  for (const artifact of task.artifacts) refs.add(artifact.uri);
  if (task.deployment?.status === 'verified') refs.add(task.deployment.url ?? task.deployment.id);
  return [...refs];
}

function blockerCount(task: AtlasTask): number {
  return task.findings.filter((finding) => finding.severity === 'error').length
    + task.tests.filter((test) => test.status === 'failed').length;
}

export function createVerificationNightExecutor(orchestrator: AtlasOrchestrator): NightExecutor {
  return async ({ task, actor }) => {
    const evidenceRefs = taskEvidence(task);
    const openBlockers = blockerCount(task);

    if (task.state === 'completed') {
      if (evidenceRefs.length === 0 || openBlockers > 0) {
        return {
          status: 'requires_attention',
          stepKey: 'verify-completed-task',
          completedOperations: [],
          evidenceRefs,
          lastSuccessfulOperation: null,
          cause: evidenceRefs.length === 0 ? 'completed_without_evidence' : 'completed_with_open_blockers',
        };
      }
      return {
        status: 'completed',
        stepKey: 'verify-completed-task',
        completedOperations: ['verified_terminal_task'],
        evidenceRefs,
        lastSuccessfulOperation: 'verified_terminal_task',
        verificationPassed: true,
        openBlockers,
      };
    }

    if (task.state === 'verified') {
      if (evidenceRefs.length === 0 || openBlockers > 0) {
        return {
          status: 'requires_attention',
          stepKey: 'close-verified-task',
          completedOperations: [],
          evidenceRefs,
          lastSuccessfulOperation: null,
          cause: evidenceRefs.length === 0 ? 'verified_without_evidence' : 'verified_with_open_blockers',
        };
      }
      await orchestrator.transitionTask(task.scope, task.taskId, 'completed', actor);
      return {
        status: 'completed',
        stepKey: 'close-verified-task',
        completedOperations: ['transition_verified_to_completed'],
        evidenceRefs,
        lastSuccessfulOperation: 'transition_verified_to_completed',
        verificationPassed: true,
        openBlockers: 0,
      };
    }

    if (task.state === 'ci') {
      const consensus = task.tests.find((test) => test.name === 'ATLAS 3-of-3 Consensus' && test.status === 'passed' && test.evidence);
      if (!consensus?.evidence) {
        return {
          status: 'requires_attention',
          stepKey: 'verify-ci',
          completedOperations: [],
          evidenceRefs,
          lastSuccessfulOperation: null,
          cause: 'ci_evidence_required',
        };
      }
      await orchestrator.recordCiSuccess(task.scope, task.taskId, consensus.evidence, actor);
      return {
        status: 'requires_attention',
        stepKey: 'verify-ci',
        completedOperations: ['record_ci_success'],
        evidenceRefs: [...new Set([...evidenceRefs, consensus.evidence])],
        lastSuccessfulOperation: 'record_ci_success',
        cause: 'human_approval_required',
      };
    }

    if (task.state === 'awaiting_human_approval') {
      return {
        status: 'requires_attention',
        stepKey: 'human-approval-gate',
        completedOperations: [],
        evidenceRefs,
        lastSuccessfulOperation: null,
        cause: 'human_approval_required',
      };
    }

    if (task.state === 'approved' || task.state === 'deploying') {
      return {
        status: 'requires_attention',
        stepKey: 'production-release-gate',
        completedOperations: [],
        evidenceRefs,
        lastSuccessfulOperation: null,
        cause: 'production_release_action_required',
      };
    }

    if (task.state === 'blocked' || task.state === 'failed' || task.state === 'cancelled') {
      return {
        status: 'requires_attention',
        stepKey: 'terminal-or-blocked-state',
        completedOperations: [],
        evidenceRefs,
        lastSuccessfulOperation: null,
        cause: `task_state_${task.state}`,
      };
    }

    return {
      status: 'requires_attention',
      stepKey: 'execution-provider-gate',
      completedOperations: [],
      evidenceRefs,
      lastSuccessfulOperation: null,
      cause: 'execution_provider_required',
    };
  };
}
