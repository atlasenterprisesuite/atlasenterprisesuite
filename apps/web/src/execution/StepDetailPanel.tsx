import type { GuidedApproval, GuidedDependency, GuidedEvidence, GuidedStep, GuidedTask } from './types';
import { ApprovalCard, type ApprovalDecision } from './ApprovalCard';
import { EvidencePanel } from './EvidencePanel';
import { humanizeExecutionValue } from './ExecutionStepRow';

export type WorkStepExecutionDecision = {
  route: { state: 'ready' | 'blocked'; mechanism: 'api' | 'browser' | null; reason: string };
  policy: { outcome: 'allow' | 'require_approval' | 'deny'; reason: string };
  approvalRequired: boolean;
};

type Props = {
  step: GuidedStep;
  task: GuidedTask;
  dependencies: GuidedDependency[];
  evidence: GuidedEvidence[];
  approvals: GuidedApproval[];
  executionDecision?: WorkStepExecutionDecision | null;
  busy?: boolean;
  onDecideApproval: (approval: GuidedApproval, decision: ApprovalDecision, reason: string) => Promise<void> | void;
};

export function StepDetailPanel({ step, task, dependencies, evidence, approvals, executionDecision = null, busy = false, onDecideApproval }: Props) {
  const unresolved = dependencies.filter((item) => !item.resolvedAt && (item.stepId === step.id || (!item.stepId && item.taskId === task.id)));
  const stepEvidence = evidence.filter((item) => item.stepId === step.id || (item.stepId === null && item.taskId === task.id));
  const taskApprovals = approvals.filter((item) => item.taskId === task.id);

  return (
    <div className="execution-detail-stack">
      <section className="execution-panel" aria-labelledby="execution-step-detail-title">
        <p className="eyebrow">Step {step.sequence}</p>
        <h2 id="execution-step-detail-title">{humanizeExecutionValue(step.actionType)}</h2>
        <p>Status: <strong>{humanizeExecutionValue(step.status)}</strong></p>
        {executionDecision ? (
          <div className="execution-decision" aria-label="Server execution decision">
            <p>Execution route: <strong>{executionDecision.route.mechanism === 'api' ? 'API' : executionDecision.route.mechanism === 'browser' ? 'Browser' : 'Blocked'}</strong></p>
            <p>Policy: <strong>{executionDecision.approvalRequired ? 'Approval required' : executionDecision.policy.outcome === 'allow' ? 'Allowed by current policy' : 'Blocked by policy'}</strong></p>
            <small>{humanizeExecutionValue(executionDecision.policy.reason)}</small>
          </div>
        ) : null}
        {task.blockedReason ? <div className="execution-blocker" role="status"><strong>Blocked</strong><p>{task.blockedReason}</p></div> : null}
        <h3>Completion criteria</h3>
        {step.completionCriteria.length ? <ul>{step.completionCriteria.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No completion criteria are persisted.</p>}
        <h3>Required permissions</h3>
        {step.permissionsRequired.length ? <ul>{step.permissionsRequired.map((item) => <li key={item}><code>{item}</code></li>)}</ul> : <p>No step-specific permissions are persisted.</p>}
        <h3>Dependencies</h3>
        {unresolved.length ? (
          <ul>{unresolved.map((item) => <li key={item.id}>{item.dependsOnStepId ? `Waiting for step ${item.dependsOnStepId}` : item.dependsOnTaskId ? `Waiting for task ${item.dependsOnTaskId}` : `Dependency ${item.id} is unresolved`}</li>)}</ul>
        ) : <p>No unresolved dependencies.</p>}
      </section>

      <EvidencePanel evidence={stepEvidence} />

      <section className="execution-panel" aria-labelledby="execution-approvals-title">
        <h3 id="execution-approvals-title">Approvals</h3>
        {taskApprovals.length === 0 ? <p>No approval request is persisted for this task.</p> : taskApprovals.map((approval) => (
          <ApprovalCard key={approval.id} approval={approval} busy={busy} onDecide={onDecideApproval} />
        ))}
      </section>
    </div>
  );
}
