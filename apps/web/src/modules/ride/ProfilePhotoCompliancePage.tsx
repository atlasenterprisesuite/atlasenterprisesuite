import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ComplianceAuditEvent,
  CompliancePermission,
  ComplianceRequirement,
  ComplianceSubmission
} from '../../../../../packages/compliance/types';
import { describeRideEligibilityEffect } from '../../../../../packages/ride/compliance';
import {
  getRideComplianceTimeline,
  getRideProfilePhotoRequirement,
  RideComplianceApiError,
  submitRideProfilePhoto,
  type RideSubmissionResponse
} from '../../lib/rideComplianceApi';
import { ComplianceReviewPanel } from './ComplianceReviewPanel';
import { ComplianceStatusBadge } from './ComplianceStatusBadge';
import { ComplianceTimeline } from './ComplianceTimeline';
import { ProfilePhotoCapture } from './ProfilePhotoCapture';
import { RideSubnav } from './RideSubnav';

function dateLabel(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function hasPermission(permissions: readonly CompliancePermission[], required: CompliancePermission) {
  return permissions.includes('ride.compliance.manage') || permissions.includes(required);
}

function titleFor(requirement: ComplianceRequirement) {
  if (requirement.status === 'action_required' || requirement.status === 'rejected') return 'Profile photo update required';
  if (requirement.status === 'expired') return 'Profile photo requirement expired';
  return 'Profile photo compliance';
}

export function ProfilePhotoCompliancePage() {
  const [loading, setLoading] = useState(true);
  const [requirement, setRequirement] = useState<ComplianceRequirement | null>(null);
  const [submission, setSubmission] = useState<ComplianceSubmission | null>(null);
  const [permissions, setPermissions] = useState<CompliancePermission[]>([]);
  const [timeline, setTimeline] = useState<ComplianceAuditEvent[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [operationStatus, setOperationStatus] = useState('Loading compliance state…');

  const loadTimeline = useCallback(async (requirementId: string) => {
    try {
      const response = await getRideComplianceTimeline(requirementId);
      setTimeline(response.events);
    } catch {
      setTimeline([]);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    setOperationStatus('Loading compliance state…');
    try {
      const response = await getRideProfilePhotoRequirement();
      setRequirement(response.requirement);
      setSubmission(response.submission || null);
      setPermissions(response.permissions || []);
      if (response.requirement) await loadTimeline(response.requirement.id);
      else setTimeline([]);
      setOperationStatus('Compliance state loaded.');
    } catch {
      setRequirement(null);
      setSubmission(null);
      setTimeline([]);
      setError('Unable to load the current profile-photo compliance state.');
      setOperationStatus('');
    } finally {
      setLoading(false);
    }
  }, [loadTimeline]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const eligibilityMessage = useMemo(
    () => requirement ? describeRideEligibilityEffect(requirement.eligibilityEffect) : null,
    [requirement]
  );

  const canSubmit = Boolean(
    requirement
    && ['action_required', 'rejected'].includes(requirement.status)
    && hasPermission(permissions, 'ride.compliance.submit')
  );
  const canReview = hasPermission(permissions, 'ride.compliance.review');
  const rejectionReason = submission?.decisionReason || (requirement?.status === 'rejected' ? requirement.reasonText : null);

  async function submit() {
    if (!selectedFile || !canSubmit || submitting) return;
    setSubmitting(true);
    setError('');
    setOperationStatus('Uploading private compliance evidence…');
    try {
      const result = await submitRideProfilePhoto(selectedFile);
      setRequirement(result.requirement);
      setSubmission(result.submission);
      setSelectedFile(null);
      setOperationStatus('Photo submitted for review.');
      await loadTimeline(result.requirement.id);
    } catch (cause) {
      if (cause instanceof RideComplianceApiError && cause.code === 'state_conflict') {
        await loadProfile();
        setError('Compliance state changed on the server. The latest state has been reloaded.');
      } else {
        setError('The photo could not be submitted. Your current approved state was not changed.');
      }
      setOperationStatus('');
    } finally {
      setSubmitting(false);
    }
  }

  async function applyReview(result: RideSubmissionResponse) {
    setRequirement(result.requirement);
    setSubmission(result.submission);
    setOperationStatus(result.requirement.status === 'approved' ? 'Review approved.' : 'Review decision recorded.');
    await loadTimeline(result.requirement.id);
  }

  return (
    <section className="page-stack ride-page ride-profile-photo-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Ride · Documents & Credentials</p>
        <h1>{requirement ? titleFor(requirement) : 'Profile Photo'}</h1>
        <p>Reverification evidence is private and remains pending until an authorized server-side review decision is recorded.</p>
      </header>
      <RideSubnav />

      {operationStatus ? <div className="ride-operation-status" role="status" aria-live="polite">{operationStatus}</div> : null}
      {error ? <div className="ride-message error" role="alert">{error}</div> : null}

      {loading ? (
        <div className="identity-checking" aria-live="polite">
          <span className="pulse-dot" />
          <div><strong>Loading compliance state</strong><p>ATLAS is reading the current authenticated server state.</p></div>
        </div>
      ) : !requirement && !error ? (
        <div className="empty-state ride-empty-state">
          <strong>No profile-photo action is currently required</strong>
          <span>No synthetic requirement or compliance metric is shown.</span>
        </div>
      ) : requirement ? (
        <>
          <article className="feature-card wide ride-requirement-card">
            <div className="card-heading">
              <div><p className="eyebrow">Profile-photo requirement</p><h2>Current status</h2></div>
              <ComplianceStatusBadge status={requirement.status} />
            </div>

            <dl className="ride-metadata-grid">
              <div><dt>Requested</dt><dd>{dateLabel(requirement.requestedAt)}</dd></div>
              {requirement.dueAt ? <div><dt>Due</dt><dd>{dateLabel(requirement.dueAt)}</dd></div> : null}
              {requirement.expiresAt ? <div><dt>Expires</dt><dd>{dateLabel(requirement.expiresAt)}</dd></div> : null}
              {submission?.submittedAt ? <div><dt>Last submitted</dt><dd>{dateLabel(submission.submittedAt)}</dd></div> : null}
              {submission?.reviewedAt ? <div><dt>Last reviewed</dt><dd>{dateLabel(submission.reviewedAt)}</dd></div> : null}
            </dl>

            {requirement.reasonText && requirement.status !== 'rejected' ? <p className="ride-reason">{requirement.reasonText}</p> : null}
            {rejectionReason ? <div className="ride-message warning"><strong>Rejection reason</strong><p>{rejectionReason}</p></div> : null}
            {eligibilityMessage ? <div className="ride-message warning"><strong>Eligibility impact</strong><p>{eligibilityMessage}</p></div> : null}

            <div className="ride-privacy-note">
              <strong>Private compliance evidence</strong>
              <p>The image is stored in a private Supabase bucket and previewed only through short-lived authorized links. Uploading does not mean approval.</p>
            </div>

            {canSubmit ? (
              <div className="ride-submit-zone">
                <ProfilePhotoCapture disabled={submitting} onValidFile={setSelectedFile} />
                <button
                  className="action-button"
                  type="button"
                  disabled={!selectedFile || submitting}
                  aria-busy={submitting ? 'true' : undefined}
                  onClick={() => void submit()}
                >
                  {submitting ? 'Submitting…' : 'Submit profile photo'}
                </button>
              </div>
            ) : requirement.status === 'submitted' || requirement.status === 'under_review' ? (
              <p className="ride-help">The submitted photo remains pending until review is completed.</p>
            ) : requirement.status === 'approved' ? (
              <p className="ride-help">This requirement is approved. A future reverification will appear only if a new requirement is persisted.</p>
            ) : null}
          </article>

          {canReview && submission && ['submitted', 'under_review'].includes(submission.status) ? (
            <ComplianceReviewPanel submission={submission} onDecision={applyReview} />
          ) : null}

          <ComplianceTimeline events={timeline} />
        </>
      ) : null}
    </section>
  );
}
