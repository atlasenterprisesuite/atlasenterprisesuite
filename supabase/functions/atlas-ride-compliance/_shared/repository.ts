import {
  canTransitionRequirement,
  canTransitionSubmission,
  requireRejectionReason
} from '../../../../packages/compliance/lifecycle.ts';
import { hasCompliancePermission } from '../../../../packages/compliance/permissions.ts';
import type {
  ComplianceAuditEvent,
  ComplianceRequirement,
  ComplianceRequirementStatus,
  ComplianceSubmission,
  ComplianceSubmissionStatus
} from '../../../../packages/compliance/types.ts';
import type { RideComplianceContext } from './context.ts';

const REQUIREMENT_SELECT = 'id,tenant_id,organization_id,subject_user_id,module,subject_type,requirement_type,status,requested_at,due_at,expires_at,eligibility_effect,reason_code,reason_text,created_by,created_at,updated_at';
const SUBMISSION_SELECT = 'id,requirement_id,tenant_id,organization_id,subject_user_id,submitted_by,status,storage_bucket,storage_path,mime_type,file_size_bytes,sha256,submitted_at,reviewed_at,reviewed_by,decision_reason,provider_reference,created_at,updated_at';

function mapRequirement(row: any): ComplianceRequirement {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    organizationId: String(row.organization_id),
    subjectUserId: String(row.subject_user_id),
    module: String(row.module),
    subjectType: String(row.subject_type),
    requirementType: String(row.requirement_type),
    status: row.status as ComplianceRequirementStatus,
    requestedAt: String(row.requested_at),
    dueAt: row.due_at ? String(row.due_at) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    eligibilityEffect: row.eligibility_effect ?? null,
    reasonCode: row.reason_code ? String(row.reason_code) : null,
    reasonText: row.reason_text ? String(row.reason_text) : null,
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapSubmission(row: any): ComplianceSubmission {
  return {
    id: String(row.id),
    requirementId: String(row.requirement_id),
    tenantId: String(row.tenant_id),
    organizationId: String(row.organization_id),
    subjectUserId: String(row.subject_user_id),
    submittedBy: String(row.submitted_by),
    status: row.status as ComplianceSubmissionStatus,
    storageBucket: String(row.storage_bucket),
    storagePath: String(row.storage_path),
    mimeType: String(row.mime_type),
    fileSizeBytes: Number(row.file_size_bytes),
    sha256: row.sha256 ? String(row.sha256) : null,
    submittedAt: String(row.submitted_at),
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    decisionReason: row.decision_reason ? String(row.decision_reason) : null,
    providerReference: row.provider_reference ? String(row.provider_reference) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapAudit(row: any): ComplianceAuditEvent {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    organizationId: String(row.organization_id),
    actorUserId: String(row.actor_user_id),
    subjectUserId: String(row.subject_user_id),
    requirementId: row.requirement_id ? String(row.requirement_id) : null,
    submissionId: row.submission_id ? String(row.submission_id) : null,
    eventType: String(row.event_type),
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    createdAt: String(row.created_at)
  };
}

function mapAtomicMutation(data: any): { submission: ComplianceSubmission; requirement: ComplianceRequirement } {
  if (!data || typeof data !== 'object' || !data.submission || !data.requirement) throw new Error('internal_error');
  return {
    submission: mapSubmission(data.submission),
    requirement: mapRequirement(data.requirement)
  };
}

function throwAtomicMutationError(error: any): never {
  const message = String(error?.message || '');
  for (const code of [
    'authentication_required',
    'authorization_denied',
    'requirement_not_found',
    'requirement_not_actionable',
    'rejection_reason_required',
    'invalid_request',
    'invalid_photo',
    'state_conflict'
  ]) {
    if (message.includes(code)) throw new Error(code);
  }
  throw new Error('internal_error');
}

function requireScope(ctx: RideComplianceContext, row: { organizationId: string; tenantId: string }) {
  if (row.organizationId !== ctx.organizationId || row.tenantId !== ctx.tenantId) throw new Error('authorization_denied');
}

function canReadSubject(ctx: RideComplianceContext, subjectUserId: string) {
  return subjectUserId === ctx.userId || hasCompliancePermission(ctx.permissions, 'ride.compliance.review');
}

async function loadRequirement(ctx: RideComplianceContext, requirementId: string) {
  const { data, error } = await ctx.storageAdmin
    .from('compliance_requirements')
    .select(REQUIREMENT_SELECT)
    .eq('id', requirementId)
    .eq('organization_id', ctx.organizationId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle();
  if (error) throw new Error('internal_error');
  if (!data) throw new Error('requirement_not_found');
  const requirement = mapRequirement(data);
  requireScope(ctx, requirement);
  return requirement;
}

export async function getSubmission(ctx: RideComplianceContext, submissionId: string) {
  const { data, error } = await ctx.storageAdmin
    .from('compliance_submissions')
    .select(SUBMISSION_SELECT)
    .eq('id', submissionId)
    .eq('organization_id', ctx.organizationId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle();
  if (error) throw new Error('internal_error');
  if (!data) throw new Error('requirement_not_found');
  const submission = mapSubmission(data);
  requireScope(ctx, submission);
  return submission;
}

export async function getProfilePhotoRequirement(ctx: RideComplianceContext): Promise<ComplianceRequirement | null> {
  const { data, error } = await ctx.storageAdmin
    .from('compliance_requirements')
    .select(REQUIREMENT_SELECT)
    .eq('organization_id', ctx.organizationId)
    .eq('tenant_id', ctx.tenantId)
    .eq('subject_user_id', ctx.userId)
    .eq('module', 'ride')
    .eq('subject_type', 'driver')
    .eq('requirement_type', 'profile_photo')
    .order('requested_at', { ascending: false })
    .limit(1);
  if (error) throw new Error('internal_error');
  return data?.[0] ? mapRequirement(data[0]) : null;
}

export async function listTimeline(
  ctx: RideComplianceContext,
  requirementId: string
): Promise<ComplianceAuditEvent[]> {
  const requirement = await loadRequirement(ctx, requirementId);
  if (!canReadSubject(ctx, requirement.subjectUserId)) throw new Error('authorization_denied');
  const { data, error } = await ctx.storageAdmin
    .from('compliance_audit_events')
    .select('id,tenant_id,organization_id,actor_user_id,subject_user_id,requirement_id,submission_id,event_type,metadata,created_at')
    .eq('organization_id', ctx.organizationId)
    .eq('tenant_id', ctx.tenantId)
    .eq('requirement_id', requirementId)
    .order('created_at', { ascending: true });
  if (error) throw new Error('internal_error');
  return (data || []).map(mapAudit);
}

export async function createProfilePhotoSubmission(
  ctx: RideComplianceContext,
  input: { requirement: ComplianceRequirement; mimeType: string; sizeBytes: number }
): Promise<ComplianceSubmission> {
  const requirement = await loadRequirement(ctx, input.requirement.id);
  if (requirement.subjectUserId !== ctx.userId) throw new Error('authorization_denied');
  if (!['action_required', 'rejected'].includes(requirement.status)) throw new Error('requirement_not_actionable');

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const { data, error } = await ctx.storageAdmin
    .from('compliance_submissions')
    .insert({
      id,
      requirement_id: requirement.id,
      tenant_id: ctx.tenantId,
      organization_id: ctx.organizationId,
      subject_user_id: ctx.userId,
      submitted_by: ctx.userId,
      status: 'uploading',
      storage_bucket: 'atlas-compliance-evidence',
      storage_path: `pending/${id}`,
      mime_type: input.mimeType,
      file_size_bytes: input.sizeBytes,
      submitted_at: now,
      created_at: now,
      updated_at: now
    })
    .select(SUBMISSION_SELECT)
    .single();
  if (error || !data) throw new Error('state_conflict');
  return mapSubmission(data);
}

export async function finalizeProfilePhotoSubmission(
  ctx: RideComplianceContext,
  submissionId: string,
  storage: { bucket: string; path: string; mimeType: string; sizeBytes: number }
): Promise<{ submission: ComplianceSubmission; requirement: ComplianceRequirement }> {
  const current = await getSubmission(ctx, submissionId);
  if (!canTransitionSubmission(current.status, 'submitted')) throw new Error('state_conflict');
  const requirement = await loadRequirement(ctx, current.requirementId);
  if (!canTransitionRequirement(requirement.status, 'submitted')) throw new Error('state_conflict');

  const { data, error } = await ctx.storageAdmin.rpc('atlas_ride_compliance_finalize_submission', {
    p_submission_id: submissionId,
    p_organization_id: ctx.organizationId,
    p_actor_user_id: ctx.userId,
    p_storage_bucket: storage.bucket,
    p_storage_path: storage.path,
    p_mime_type: storage.mimeType,
    p_file_size_bytes: storage.sizeBytes
  });
  if (error) throwAtomicMutationError(error);
  return mapAtomicMutation(data);
}

type AtomicReviewTarget = 'under_review' | 'approved' | 'rejected';

async function transitionReviewState(
  ctx: RideComplianceContext,
  submissionId: string,
  targetStatus: AtomicReviewTarget,
  reason?: string
) {
  const { data, error } = await ctx.storageAdmin.rpc('atlas_ride_compliance_review_transition', {
    p_submission_id: submissionId,
    p_organization_id: ctx.organizationId,
    p_actor_user_id: ctx.userId,
    p_target_status: targetStatus,
    p_reason: reason ?? null
  });
  if (error) throwAtomicMutationError(error);
  return mapAtomicMutation(data);
}

export async function markSubmissionUnderReview(
  ctx: RideComplianceContext,
  submissionId: string
): Promise<ComplianceSubmission> {
  const current = await getSubmission(ctx, submissionId);
  const requirement = await loadRequirement(ctx, current.requirementId);
  if (current.status === 'under_review') {
    if (requirement.status !== 'under_review') throw new Error('state_conflict');
    return current;
  }
  if (!canTransitionSubmission(current.status, 'under_review')) throw new Error('state_conflict');
  if (!canTransitionRequirement(requirement.status, 'under_review')) throw new Error('state_conflict');
  const result = await transitionReviewState(ctx, submissionId, 'under_review');
  return result.submission;
}

export async function approveSubmission(
  ctx: RideComplianceContext,
  submissionId: string
): Promise<{ submission: ComplianceSubmission; requirement: ComplianceRequirement }> {
  const current = await getSubmission(ctx, submissionId);
  if (!canTransitionSubmission(current.status, 'approved')) throw new Error('state_conflict');
  const requirement = await loadRequirement(ctx, current.requirementId);
  if (!canTransitionRequirement(requirement.status, 'approved')) throw new Error('state_conflict');
  return transitionReviewState(ctx, submissionId, 'approved');
}

export async function rejectSubmission(
  ctx: RideComplianceContext,
  submissionId: string,
  reason: string
): Promise<{ submission: ComplianceSubmission; requirement: ComplianceRequirement }> {
  const decisionReason = requireRejectionReason(reason);
  const current = await getSubmission(ctx, submissionId);
  if (!canTransitionSubmission(current.status, 'rejected')) throw new Error('state_conflict');
  const requirement = await loadRequirement(ctx, current.requirementId);
  if (!canTransitionRequirement(requirement.status, 'rejected')) throw new Error('state_conflict');
  return transitionReviewState(ctx, submissionId, 'rejected', decisionReason);
}

function safeMetadata(metadata: Record<string, unknown>) {
  const forbidden = /(signed.?url|token|secret|password|service.?role|image.?bytes|photo.?bytes|biometric|embedding)/i;
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !forbidden.test(key)));
}

export async function recordComplianceAudit(
  ctx: RideComplianceContext,
  event: {
    subjectUserId: string;
    requirementId?: string | null;
    submissionId?: string | null;
    eventType: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await ctx.storageAdmin.from('compliance_audit_events').insert({
    tenant_id: ctx.tenantId,
    organization_id: ctx.organizationId,
    actor_user_id: ctx.userId,
    subject_user_id: event.subjectUserId,
    requirement_id: event.requirementId || null,
    submission_id: event.submissionId || null,
    event_type: event.eventType,
    metadata: safeMetadata(event.metadata || {})
  });
  if (error) throw new Error('internal_error');
}

export function requireReadableSubmission(ctx: RideComplianceContext, submission: ComplianceSubmission) {
  if (!canReadSubject(ctx, submission.subjectUserId)) throw new Error('authorization_denied');
}
