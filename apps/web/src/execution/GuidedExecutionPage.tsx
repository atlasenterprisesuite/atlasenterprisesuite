import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  decideExecutionApproval,
  loadGuidedExecutionAudit,
  loadGuidedExecutionState,
  requestExecutionApproval
} from './api';
import type { ApprovalDecision } from './ApprovalCard';
import { AuditTimeline } from './AuditTimeline';
import { ExecutionAssistantPanel } from './ExecutionAssistantPanel';
import { ExecutionBreadcrumbs } from './ExecutionBreadcrumbs';
import { humanizeExecutionValue } from './ExecutionStepRow';
import { StepActionBar } from './StepActionBar';
import { StepDetailPanel } from './StepDetailPanel';
import { TaskGroup } from './TaskGroup';
import type { GuidedApproval, GuidedAuditEvent, GuidedExecutionState } from './types';
import { activeTask, deriveStepAction } from './view-model';
import { WorkflowHeader } from './WorkflowHeader';

function focusSection(id: string) {
  const element = typeof document === 'undefined' ? null : document.getElementById(id);
  if (!element) return;
  element.scrollIntoView?.({ block: 'nearest' });
  if (element instanceof HTMLElement) element.focus({ preventScroll: true });
}

export function GuidedExecutionPage() {
  const { workflowId = '' } = useParams();
  const [data, setData] = useState<GuidedExecutionState | null>(null);
  const [audit, setAudit] = useState<GuidedAuditEvent[] | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const adoptState = useCallback((next: GuidedExecutionState) => {
    setData(next);
    const currentTask = next.tasks.find((task) => task.id === next.workflow.currentTaskId) ?? next.tasks[0];
    setSelectedStepId(currentTask?.currentStepId ?? null);
  }, []);

  const refreshAudit = useCallback(async () => {
    if (!workflowId) return;
    try {
      const events = await loadGuidedExecutionAudit(workflowId);
      setAudit(events);
      setAuditError(null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'audit_unavailable';
      if (message === 'permission_required') {
        setAudit(null);
        setAuditError(null);
      } else {
        setAudit(null);
        setAuditError(message);
      }
    }
  }, [workflowId]);

  const reload = useCallback(async () => {
    if (!workflowId) {
      setData(null);
      setError('workflow_not_found');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      adoptState(await loadGuidedExecutionState(workflowId));
      setActionError(null);
      void refreshAudit();
    } catch (caught) {
      setData(null);
      setError(caught instanceof Error ? caught.message : 'execution_unavailable');
    } finally {
      setLoading(false);
    }
  }, [adoptState, refreshAudit, workflowId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setAudit(null);
    setAuditError(null);

    if (!workflowId) {
      setData(null);
      setError('workflow_not_found');
      setLoading(false);
      return () => { active = false; };
    }

    void loadGuidedExecutionState(workflowId)
      .then((next) => {
        if (!active) return;
        adoptState(next);
        void refreshAudit();
      })
      .catch((caught) => {
        if (!active) return;
        setData(null);
        setError(caught instanceof Error ? caught.message : 'execution_unavailable');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [adoptState, refreshAudit, workflowId]);

  if (loading) return <section aria-busy="true"><h1>Loading execution workflow</h1></section>;
  if (error === 'workflow_not_found') return <section><h1>Workflow not found</h1><p>The workflow is unavailable in the active organization.</p></section>;
  if (error) return <section role="alert"><h1>Execution unavailable</h1><p>{error}</p><button type="button" onClick={reload}>Retry</button></section>;
  if (!data) return <section><h1>No execution state</h1></section>;

  const currentTask = activeTask(data);
  const selectedStep = data.steps.find((step) => step.id === selectedStepId) ?? null;
  const selectedTask = selectedStep ? data.tasks.find((task) => task.id === selectedStep.taskId) ?? null : null;
  const stepAction = selectedStep ? deriveStepAction(data, selectedStep.id) : null;

  const requestApproval = async () => {
    if (!selectedStep || !selectedTask || selectedTask.currentStepId !== selectedStep.id) return;
    setBusy(true);
    setActionError(null);
    try {
      await requestExecutionApproval({
        taskId: selectedTask.id,
        approvalType: 'execution_review',
        requiredPermission: 'execution.approve',
        riskLevel: selectedTask.priority === 'critical' ? 'critical' : selectedTask.priority === 'high' ? 'high' : 'medium',
        summary: `Review ${selectedTask.title}: ${humanizeExecutionValue(selectedStep.actionType)}`
      });
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'approval_request_failed');
    } finally {
      setBusy(false);
    }
  };

  const decideApproval = async (approval: GuidedApproval, decision: ApprovalDecision, reason: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await decideExecutionApproval({ approvalId: approval.id, decision, reason });
      await reload();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'approval_decision_failed';
      setActionError(message === 'approval_binding_mismatch'
        ? 'approval_binding_mismatch — reload the workflow and request a new approval for the current action.'
        : message);
    } finally {
      setBusy(false);
    }
  };

  const selectAssistantStep = (stepId: string) => {
    setActionError(null);
    setSelectedStepId(stepId);
  };

  return (
    <section className="page-stack execution-page">
      <ExecutionBreadcrumbs workflow={data.workflow} />
      <WorkflowHeader state={data} task={currentTask} />
      {actionError ? <div className="execution-action-error" role="alert">{actionError}</div> : null}
      <div className="execution-layout">
        <div className="execution-task-list" aria-label="Execution tasks">
          {data.tasks.length === 0 ? <div className="empty-state"><strong>No tasks</strong><span>This workflow has no persisted tasks.</span></div> : data.tasks.map((task, index) => (
            <TaskGroup
              key={task.id}
              task={task}
              taskNumber={index + 1}
              steps={data.steps.filter((step) => step.taskId === task.id).sort((a, b) => a.sequence - b.sequence)}
              selectedStepId={selectedStepId}
              current={task.id === currentTask?.id}
              onSelectStep={(stepId) => {
                setActionError(null);
                setSelectedStepId(stepId);
              }}
            />
          ))}
        </div>
        <aside className="execution-selection" aria-label="Selected execution step">
          {selectedStep && selectedTask ? (
            <>
              <StepDetailPanel
                step={selectedStep}
                task={selectedTask}
                dependencies={data.dependencies}
                evidence={data.evidence}
                approvals={data.approvals}
                busy={busy}
                onDecideApproval={decideApproval}
              />
              {stepAction ? (
                <StepActionBar
                  action={stepAction}
                  currentStep={selectedTask.currentStepId === selectedStep.id}
                  busy={busy}
                  onRefresh={reload}
                  onRequestApproval={requestApproval}
                  onFocusApprovals={() => focusSection('execution-approvals-title')}
                  onFocusEvidence={() => focusSection('execution-evidence-title')}
                />
              ) : null}
            </>
          ) : <p>Select a persisted step to inspect its execution details.</p>}
          <button type="button" className="execution-action" disabled={busy} onClick={reload}>Refresh workflow</button>
        </aside>
      </div>
      <ExecutionAssistantPanel state={data} onSelectStep={selectAssistantStep} />
      <AuditTimeline events={audit} error={auditError} />
    </section>
  );
}
