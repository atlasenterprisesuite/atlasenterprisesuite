import type { StepAction } from './view-model';

type Props = {
  action: StepAction;
  currentStep: boolean;
  busy?: boolean;
  onRefresh: () => Promise<void> | void;
  onExecuteStep: () => Promise<void> | void;
  onResumeStep: () => Promise<void> | void;
  onRequestApproval: () => Promise<void> | void;
  onFocusApprovals: () => void;
  onFocusEvidence: () => void;
};

export function StepActionBar({
  action,
  currentStep,
  busy = false,
  onRefresh,
  onExecuteStep,
  onResumeStep,
  onRequestApproval,
  onFocusApprovals,
  onFocusEvidence
}: Props) {
  if (action.kind === 'blocked' || action.kind === 'done' || action.kind === 'unavailable') {
    return <div className="execution-action-bar"><button type="button" className="execution-action" disabled>{action.label}</button></div>;
  }

  const activate = () => {
    if (action.kind === 'execute') return onExecuteStep();
    if (action.kind === 'resume') return onResumeStep();
    if (action.kind === 'refresh') return onRefresh();
    if (action.kind === 'request_approval') return onRequestApproval();
    if (action.kind === 'review_approval') return onFocusApprovals();
    return onFocusEvidence();
  };

  const requiresCurrentStep = action.kind === 'execute' || action.kind === 'resume' || action.kind === 'request_approval';
  const enabled = !requiresCurrentStep || currentStep;
  return (
    <div className="execution-action-bar">
      <button type="button" className="execution-action" disabled={busy || !enabled} onClick={activate}>
        {enabled ? action.label : 'Current step required'}
      </button>
    </div>
  );
}
