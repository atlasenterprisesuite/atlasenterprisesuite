import type { ComplianceRequirementStatus, ComplianceSubmissionStatus } from './types';

const requirementTransitions: Record<ComplianceRequirementStatus, readonly ComplianceRequirementStatus[]> = {
  action_required: ['submitted', 'waived', 'expired'],
  submitted: ['under_review', 'rejected', 'expired'],
  under_review: ['approved', 'rejected', 'expired'],
  approved: ['expired', 'action_required'],
  rejected: ['action_required', 'submitted', 'expired'],
  expired: ['action_required', 'waived'],
  waived: ['action_required', 'expired']
};

const submissionTransitions: Record<ComplianceSubmissionStatus, readonly ComplianceSubmissionStatus[]> = {
  uploading: ['submitted', 'superseded'],
  submitted: ['under_review', 'rejected', 'superseded'],
  under_review: ['approved', 'rejected', 'superseded'],
  approved: ['superseded'],
  rejected: ['superseded'],
  superseded: []
};

export function canTransitionRequirement(
  from: ComplianceRequirementStatus,
  to: ComplianceRequirementStatus
) {
  return requirementTransitions[from].includes(to);
}

export function canTransitionSubmission(
  from: ComplianceSubmissionStatus,
  to: ComplianceSubmissionStatus
) {
  return submissionTransitions[from].includes(to);
}

export function requireRejectionReason(reason: string) {
  const normalized = reason.trim();
  if (!normalized) throw new Error('rejection_reason_required');
  return normalized;
}
