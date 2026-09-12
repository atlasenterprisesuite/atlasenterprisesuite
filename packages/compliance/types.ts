export type ComplianceRequirementStatus =
  | 'action_required'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'waived';

export type ComplianceSubmissionStatus =
  | 'uploading'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'superseded';

export type CompliancePermission =
  | 'ride.compliance.read'
  | 'ride.compliance.submit'
  | 'ride.compliance.review'
  | 'ride.compliance.manage';

export type EligibilityEffect = 'none' | 'warning' | 'block_new_activity';

export type ComplianceScope = {
  tenantId: string;
  organizationId: string;
};

export type ComplianceRequirement = ComplianceScope & {
  id: string;
  subjectUserId: string;
  module: string;
  subjectType: string;
  requirementType: string;
  status: ComplianceRequirementStatus;
  requestedAt: string;
  dueAt: string | null;
  expiresAt: string | null;
  eligibilityEffect: EligibilityEffect | null;
  reasonCode: string | null;
  reasonText: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ComplianceSubmission = ComplianceScope & {
  id: string;
  requirementId: string;
  subjectUserId: string;
  submittedBy: string;
  status: ComplianceSubmissionStatus;
  storageBucket: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  decisionReason: string | null;
  providerReference: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ComplianceAuditEvent = ComplianceScope & {
  id: string;
  actorUserId: string;
  subjectUserId: string;
  requirementId: string | null;
  submissionId: string | null;
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};
