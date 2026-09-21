import type { GuidedApproval, GuidedDependency, GuidedEvidence, GuidedStep, GuidedTask } from './types';
import { ApprovalCard, type ApprovalDecision } from './ApprovalCard';
import { EvidencePanel } from './EvidencePanel';
import { humanizeExecutionValue } from './ExecutionStepRow';

export type WorkStepExecutionDecision = {
  route: { state: 'ready' | 'blocked'; mechanism: 'api' | 'browser' | null; reason: string };
  policy: { outcome: 'allow' | 'require_approval' | 'deny'; reason: string };
  approvalRequired: boolean;
};

function blockerGuidance(reason: string | null | undefined) {
  switch (reason) {
    case 'openai_authorized_session_missing':
      return 'Connect an authorized OpenAI/ChatGPT session before ATLAS retries this step.';
    case 'openai_browser_runtime_missing':
      return 'Start an online ATLAS runtime with the browser capability before retrying.';
    case 'openai_browser_execution_unavailable':
      return 'The authorized session or browser runtime changed during execution. Refresh the connection and retry.';
    case 'openai_browser_session_or_runtime_missing':
      return 'Connect an authorized OpenAI/ChatGPT session and start an online browser-capable ATLAS runtime.';
    default:
      return null;
  }
}

function policyLabel(decision: WorkStepExecutionDecision) {
  if (decision.route.state === 'blocked') return 'Not evaluated — execution route unavailable';
  if (decision.approvalRequired) return 'Approval required';
  return decision.policy.outcome === 'allow' ? 'Allowed by current policy' : 'Blocked by policy';
}

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
            <p>Policy: <strong>{policyLabel(executionDecision)}</strong></p>
            <small>Route: {humanizeExecutionValue(executionDecision.route.reason)}</small>
            {executionDecision.route.state === 'ready' ? <small>Policy: {humanizeExecutionValue(executionDecision.policy.reason)}</small> : null}
          </div>
        ) : null}
        {task.blockedReason ? (
          <div className="execution-blocker" role="status">
            <strong>Action required</strong>
            <p>{humanizeExecutionValue(task.blockedReason)}</p>
            {blockerGuidance(task.blockedReason) ? <p>{blockerGuidance(task.blockedReason)}</p> : null}
          </div>
        ) : null}
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
