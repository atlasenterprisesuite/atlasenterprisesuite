import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { executionApi, type AtlasWorkflowRecord, type ExecutionApiClient } from './ExecutionApi';
import './execution.css';

const statusLabels: Record<AtlasWorkflowRecord['status'], string> = {
  now: 'Now',
  next: 'Next',
  blocked: 'Blocked',
  awaiting_approval: 'Awaiting approval',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled'
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'request_failed';
}

export function WorkflowProgressPage({ api = executionApi, taskId: taskIdProp }: { api?: ExecutionApiClient; taskId?: string }) {
  const params = useParams();
  const taskId = taskIdProp || params.taskId || '';
  const [workflow, setWorkflow] = useState<AtlasWorkflowRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!taskId) {
        setError('invalid_input');
        setLoading(false);
        return;
      }
      try {
        const record = await api.getWorkflow(taskId);
        if (!cancelled) setWorkflow(record);
      } catch (loadError) {
        if (!cancelled) setError(errorMessage(loadError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [api, taskId]);

  if (loading) return <section className="execution-page"><div className="execution-state" role="status">Loading workflow state…</div></section>;
  if (error) return <section className="execution-page page-stack"><div className="execution-alert" role="alert">{error}</div><Link to="/approvals" className="text-link">Open Approval Center</Link></section>;
  if (!workflow) return <section className="execution-page"><div className="execution-empty"><strong>Workflow unavailable</strong><span>No verified workflow record was returned.</span></div></section>;

  const evidenceCount = Array.isArray(workflow.evidence_ids) ? workflow.evidence_ids.length : 0;
  const evidenceLabel = `${evidenceCount} verified evidence reference${evidenceCount === 1 ? '' : 's'}`;

  return (
    <section className="execution-page page-stack">
      <nav className="execution-breadcrumb" aria-label="Breadcrumb"><Link to="/approvals">Approval Center</Link><span>/</span><span>{workflow.task_id}</span></nav>
      <header className="execution-header">
        <div>
          <p className="eyebrow">{workflow.module} · {workflow.workflow_type}</p>
          <h1>Workflow Progress</h1>
          <p>Persistent execution state backed by the organization workflow record.</p>
        </div>
        <span className={`workflow-status ${workflow.status}`}>{statusLabels[workflow.status]}</span>
      </header>

      <div className="workflow-progress-grid">
        <article className="execution-panel"><span>Current step</span><strong>{workflow.current_step || 'Not assigned'}</strong></article>
        <article className="execution-panel"><span>Priority</span><strong>{workflow.priority}</strong></article>
        <article className="execution-panel"><span>Evidence</span><strong>{evidenceLabel}</strong></article>
        <article className="execution-panel"><span>Trace</span><strong className="execution-mono">{workflow.trace_id}</strong></article>
      </div>

      {workflow.status === 'blocked' && (
        <section className="execution-blocker" aria-labelledby="workflow-blocker-title">
          <span id="workflow-blocker-title">Exact blocker</span>
          <strong>{workflow.blocked_reason || 'dependency_blocked'}</strong>
        </section>
      )}

      {workflow.status === 'awaiting_approval' && (
        <section className="execution-blocker approval-needed">
          <span>Decision required</span>
          <strong>This workflow is waiting for Approval Center.</strong>
          <Link to="/approvals">Review approvals</Link>
        </section>
      )}

      <section className="execution-next-action">
        <span>Next action</span>
        <strong>{workflow.next_action || (workflow.status === 'completed' ? 'No further action' : 'Await updated workflow state')}</strong>
      </section>

      <footer className="execution-footnote">Last state update: {workflow.updated_at ? new Date(workflow.updated_at).toLocaleString() : 'Unknown'}</footer>
    </section>
  );
}
