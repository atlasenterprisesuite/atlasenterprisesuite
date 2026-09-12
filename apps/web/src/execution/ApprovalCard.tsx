import { useState } from 'react';
import type { GuidedApproval } from './types';

export type ApprovalDecision = 'approved' | 'rejected';

type Props = {
  approval: GuidedApproval;
  busy?: boolean;
  onDecide?: (approval: GuidedApproval, decision: ApprovalDecision, reason: string) => Promise<void> | void;
};

function label(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ApprovalCard({ approval, busy = false, onDecide }: Props) {
  const [reason, setReason] = useState('');
  const pending = approval.status === 'pending';

  return (
    <article className="execution-approval-card" data-status={approval.status}>
      <div className="execution-card-heading">
        <div>
          <p className="eyebrow">Approval</p>
          <h4>{approval.summary || label(approval.approvalType)}</h4>
        </div>
        <strong>{label(approval.status)}</strong>
      </div>
      <dl>
        <div><dt>Risk</dt><dd>{label(approval.riskLevel)}</dd></div>
        <div><dt>Required permission</dt><dd>{approval.requiredPermission}</dd></div>
        <div><dt>Binding</dt><dd>Server-authoritative version {approval.payloadVersion}</dd></div>
      </dl>
      {pending && onDecide ? (
        <div className="execution-approval-actions">
          <label>
            <span>Decision reason</span>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} />
          </label>
          <div>
            <button type="button" className="execution-action" disabled={busy} onClick={() => onDecide(approval, 'approved', reason)}>Approve</button>
            <button type="button" className="execution-action" disabled={busy} onClick={() => onDecide(approval, 'rejected', reason)}>Reject</button>
          </div>
        </div>
      ) : null}
      {approval.decisionReason ? <p>Decision reason: {approval.decisionReason}</p> : null}
    </article>
  );
}
