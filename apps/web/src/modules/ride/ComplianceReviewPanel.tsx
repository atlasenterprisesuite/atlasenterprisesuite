import { useState } from 'react';
import type { ComplianceSubmission } from '../../../../../packages/compliance/types';
import {
  approveRideComplianceSubmission,
  getRideCompliancePreview,
  rejectRideComplianceSubmission,
  type RideSubmissionResponse
} from '../../lib/rideComplianceApi';

export type ComplianceReviewPanelProps = {
  submission: ComplianceSubmission;
  onDecision: (result: RideSubmissionResponse) => Promise<void> | void;
};

export function ComplianceReviewPanel({ submission, onDecision }: ComplianceReviewPanelProps) {
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  async function openReview() {
    setOpen(true);
    setBusy(true);
    setError('');
    setStatus('Loading authorized preview…');
    try {
      const preview = await getRideCompliancePreview(submission.id);
      setPreviewUrl(preview.signed_url);
      setStatus('Short-lived preview loaded.');
    } catch {
      setPreviewUrl('');
      setError('Preview unavailable or expired. Retry to request a new authorized preview.');
      setStatus('');
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true);
    setError('');
    setStatus('Submitting approval decision…');
    try {
      const result = await approveRideComplianceSubmission(submission.id);
      await onDecision(result);
      setStatus('Approval recorded by the server.');
    } catch {
      setError('Approval could not be recorded. Reload the compliance state before trying again.');
      setStatus('');
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    const trimmed = reason.trim();
    if (!trimmed) return;
    setBusy(true);
    setError('');
    setStatus('Submitting rejection decision…');
    try {
      const result = await rejectRideComplianceSubmission(submission.id, trimmed);
      await onDecision(result);
      setStatus('Rejection recorded by the server.');
    } catch {
      setError('Rejection could not be recorded. Reload the compliance state before trying again.');
      setStatus('');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <section className="feature-card wide ride-review-panel">
        <p className="eyebrow">Authorized review</p>
        <h2>Manual profile-photo review</h2>
        <p>Open the panel to request a short-lived private preview. No preview URL is stored in browser persistence.</p>
        <button className="action-button" type="button" onClick={() => void openReview()}>Open review</button>
      </section>
    );
  }

  return (
    <section className="feature-card wide ride-review-panel" aria-labelledby="ride-review-title">
      <div className="card-heading">
        <div><p className="eyebrow">Authorized review</p><h2 id="ride-review-title">Manual profile-photo review</h2></div>
        <button className="text-link" type="button" onClick={() => setOpen(false)} disabled={busy}>Close</button>
      </div>
      {status ? <div role="status" className="ride-operation-status">{status}</div> : null}
      {error ? <div role="alert" className="hospitality-message error">{error}</div> : null}
      {previewUrl ? <img className="ride-review-photo" src={previewUrl} alt="Submitted profile photo" referrerPolicy="no-referrer" /> : (
        <button className="action-button" type="button" disabled={busy} aria-busy={busy ? 'true' : undefined} onClick={() => void openReview()}>Retry preview</button>
      )}
      <label className="field" htmlFor="ride-rejection-reason">
        <span>Rejection reason</span>
        <textarea
          id="ride-rejection-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={busy}
          maxLength={500}
          placeholder="Required only when rejecting"
        />
      </label>
      <div className="ride-review-actions">
        <button className="action-button" type="button" disabled={busy || !previewUrl} aria-busy={busy ? 'true' : undefined} onClick={() => void approve()}>Approve</button>
        <button className="action-button secondary" type="button" disabled={busy || !previewUrl || !reason.trim()} aria-busy={busy ? 'true' : undefined} onClick={() => void reject()}>Reject</button>
      </div>
    </section>
  );
}
