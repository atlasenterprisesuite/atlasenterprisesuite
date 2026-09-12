import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { executionApi, type AtlasApprovalListItem, type ExecutionApiClient } from './ExecutionApi';
import './execution.css';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'request_failed';
}

export function ApprovalCenterPage({ api = executionApi }: { api?: ExecutionApiClient }) {
  const [approvals, setApprovals] = useState<AtlasApprovalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const records = await api.listApprovals();
        if (!cancelled) setApprovals(records.filter((record) => record.status === 'pending'));
      } catch (loadError) {
        if (!cancelled) setError(errorMessage(loadError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [api]);

  async function decide(approval: AtlasApprovalListItem, decision: 'approve' | 'deny') {
    if (submittingId) return;
    setSubmittingId(approval.id);
    setError('');
    try {
      if (decision === 'approve') await api.approve(approval.id);
      else await api.deny(approval.id);
      setApprovals((current) => current.filter((item) => item.id !== approval.id));
    } catch (decisionError) {
      setError(errorMessage(decisionError));
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <section className="execution-page page-stack">
      <header className="execution-header">
        <div>
          <p className="eyebrow">ATLAS Governance</p>
          <h1>Approval Center</h1>
          <p>Review high-impact actions before ATLAS is allowed to execute them.</p>
        </div>
        <span className="execution-count" aria-label="Pending approvals">{approvals.length} pending</span>
      </header>

      {error && <div className="execution-alert" role="alert">{error}</div>}
      {loading ? (
        <div className="execution-state" role="status">Loading pending approvals…</div>
      ) : approvals.length === 0 ? (
        <div className="execution-empty"><strong>No pending approvals</strong><span>Actions that require your decision will appear here.</span></div>
      ) : (
        <div className="approval-list">
          {approvals.map((approval) => {
            const submitting = submittingId === approval.id;
            return (
              <article className="approval-card" key={approval.id}>
                <div className="approval-card-heading">
                  <div><span className="execution-module">{approval.module}</span><h2>{approval.action_summary}</h2></div>
                  <span className={`risk-chip ${approval.risk_class}`}>{approval.risk_class}</span>
                </div>
                <dl className="approval-details">
                  <div><dt>External effect</dt><dd>{approval.intended_external_effect || 'No external effect declared'}</dd></div>
                  <div><dt>Workflow</dt><dd><Link to={`/workflows/${encodeURIComponent(approval.task_id)}`}>{approval.task_id}</Link></dd></div>
                  <div><dt>Step</dt><dd>{approval.step_id || 'Workflow-level approval'}</dd></div>
                  <div><dt>Expires</dt><dd>{approval.expires_at ? new Date(approval.expires_at).toLocaleString() : 'No expiration set'}</dd></div>
                </dl>
                <div className="approval-actions">
                  <button type="button" className="execution-button secondary" disabled={submitting} onClick={() => void decide(approval, 'deny')}>{submitting ? 'Working…' : 'Deny'}</button>
                  <button type="button" className="execution-button primary" disabled={submitting} onClick={() => void decide(approval, 'approve')}>{submitting ? 'Working…' : 'Approve'}</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
