import { validateComplianceImageMetadata } from '../../../packages/compliance/file-policy.ts';
import { requireCompliancePermission } from '../../../packages/compliance/permissions.ts';
import { resolveContext } from './_shared/context.ts';
import { errorResponse, json, optionsResponse, withCors } from './_shared/errors.ts';
import {
  approveSubmission,
  createProfilePhotoSubmission,
  finalizeProfilePhotoSubmission,
  getProfilePhotoRequirement,
  getSubmission,
  listTimeline,
  markSubmissionUnderReview,
  recordComplianceAudit,
  rejectSubmission
} from './_shared/repository.ts';
import {
  createCompliancePreview,
  removeComplianceEvidence,
  uploadComplianceEvidence
} from './_shared/storage.ts';

const VERSION = 1;

function queryValue(url: URL, name: string) {
  return String(url.searchParams.get(name) || '').trim().slice(0, 160);
}

async function parseJson(req: Request) {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? body as Record<string, unknown> : {};
  } catch {
    throw new Error('invalid_request');
  }
}

async function readiness(req: Request) {
  const ctx = await resolveContext(req);
  requireCompliancePermission(ctx.permissions, 'ride.compliance.read');
  return json({
    ok: true,
    service: 'atlas-ride-compliance',
    version: VERSION,
    organization_id: ctx.organizationId,
    tenant_id: ctx.tenantId,
    role: ctx.role,
    permissions: ctx.permissions,
    review_mode: 'manual',
    automated_identity_provider_connected: false,
    checked_at: new Date().toISOString()
  });
}

async function profilePhoto(req: Request) {
  const ctx = await resolveContext(req);
  requireCompliancePermission(ctx.permissions, 'ride.compliance.read');
  const requirement = await getProfilePhotoRequirement(ctx);
  if (requirement) {
    await recordComplianceAudit(ctx, {
      subjectUserId: requirement.subjectUserId,
      requirementId: requirement.id,
      eventType: 'requirement.viewed'
    });
  }
  return json({ ok: true, requirement });
}

async function submitProfilePhoto(req: Request) {
  const ctx = await resolveContext(req);
  requireCompliancePermission(ctx.permissions, 'ride.compliance.submit');
  const requirement = await getProfilePhotoRequirement(ctx);
  if (!requirement) throw new Error('requirement_not_found');
  if (!['action_required', 'rejected'].includes(requirement.status)) throw new Error('requirement_not_actionable');

  const form = await req.formData().catch(() => { throw new Error('invalid_request'); });
  const photos = form.getAll('photo').filter((value): value is File => value instanceof File);
  const allFiles = Array.from(form.values()).filter((value) => value instanceof File);
  if (photos.length !== 1 || allFiles.length !== 1) throw new Error('invalid_photo');
  const file = photos[0];
  const validation = validateComplianceImageMetadata({ mimeType: file.type, sizeBytes: file.size });
  if (!validation.ok) throw new Error(validation.error);

  const submission = await createProfilePhotoSubmission(ctx, {
    requirement,
    mimeType: file.type,
    sizeBytes: file.size
  });
  await recordComplianceAudit(ctx, {
    subjectUserId: ctx.userId,
    requirementId: requirement.id,
    submissionId: submission.id,
    eventType: 'submission.started'
  });

  let uploaded: Awaited<ReturnType<typeof uploadComplianceEvidence>> | null = null;
  try {
    uploaded = await uploadComplianceEvidence(ctx, { submissionId: submission.id, file });
    await recordComplianceAudit(ctx, {
      subjectUserId: ctx.userId,
      requirementId: requirement.id,
      submissionId: submission.id,
      eventType: 'submission.uploaded',
      metadata: { mime_type: uploaded.mimeType, file_size_bytes: uploaded.sizeBytes }
    });

    const finalized = await finalizeProfilePhotoSubmission(ctx, submission.id, uploaded);
    await recordComplianceAudit(ctx, {
      subjectUserId: ctx.userId,
      requirementId: requirement.id,
      submissionId: submission.id,
      eventType: 'submission.submitted'
    });
    return json({ ok: true, ...finalized }, 201);
  } catch (error) {
    if (uploaded?.path) {
      await removeComplianceEvidence(ctx, uploaded.path).catch(() => undefined);
    }
    await recordComplianceAudit(ctx, {
      subjectUserId: ctx.userId,
      requirementId: requirement.id,
      submissionId: submission.id,
      eventType: 'submission.failed'
    }).catch(() => undefined);
    throw error;
  }
}

async function maybeStartReview(ctx: Awaited<ReturnType<typeof resolveContext>>, submissionId: string) {
  const submission = await getSubmission(ctx, submissionId);
  if (submission.subjectUserId === ctx.userId) return submission;
  requireCompliancePermission(ctx.permissions, 'ride.compliance.review');
  if (submission.status !== 'submitted') return submission;
  const reviewed = await markSubmissionUnderReview(ctx, submissionId);
  await recordComplianceAudit(ctx, {
    subjectUserId: reviewed.subjectUserId,
    requirementId: reviewed.requirementId,
    submissionId: reviewed.id,
    eventType: 'review.started'
  });
  return reviewed;
}

async function preview(req: Request, url: URL) {
  const ctx = await resolveContext(req);
  requireCompliancePermission(ctx.permissions, 'ride.compliance.read');
  const submissionId = queryValue(url, 'submission_id');
  if (!submissionId) throw new Error('invalid_request');
  await maybeStartReview(ctx, submissionId);
  const result = await createCompliancePreview(ctx, submissionId);
  return json({ ok: true, signed_url: result.signedUrl, expires_in: result.expiresIn });
}

async function timeline(req: Request, url: URL) {
  const ctx = await resolveContext(req);
  requireCompliancePermission(ctx.permissions, 'ride.compliance.read');
  const requirementId = queryValue(url, 'requirement_id');
  if (!requirementId) throw new Error('invalid_request');
  return json({ ok: true, events: await listTimeline(ctx, requirementId) });
}

async function approve(req: Request) {
  const ctx = await resolveContext(req);
  requireCompliancePermission(ctx.permissions, 'ride.compliance.review');
  const body = await parseJson(req);
  const submissionId = String(body.submission_id || '').trim().slice(0, 160);
  if (!submissionId) throw new Error('invalid_request');
  const staged = await maybeStartReview(ctx, submissionId);
  const result = await approveSubmission(ctx, staged.id);
  await recordComplianceAudit(ctx, {
    subjectUserId: result.submission.subjectUserId,
    requirementId: result.requirement.id,
    submissionId: result.submission.id,
    eventType: 'review.approved'
  });
  return json({ ok: true, ...result });
}

async function reject(req: Request) {
  const ctx = await resolveContext(req);
  requireCompliancePermission(ctx.permissions, 'ride.compliance.review');
  const body = await parseJson(req);
  const submissionId = String(body.submission_id || '').trim().slice(0, 160);
  const reason = String(body.reason || '');
  if (!submissionId) throw new Error('invalid_request');
  const staged = await maybeStartReview(ctx, submissionId);
  const result = await rejectSubmission(ctx, staged.id, reason);
  await recordComplianceAudit(ctx, {
    subjectUserId: result.submission.subjectUserId,
    requirementId: result.requirement.id,
    submissionId: result.submission.id,
    eventType: 'review.rejected',
    metadata: { reason: result.submission.decisionReason }
  });
  return json({ ok: true, ...result });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return optionsResponse(origin);
  const url = new URL(req.url);
  const api = queryValue(url, 'api') || 'readiness';

  try {
    let response: Response;
    switch (api) {
      case 'readiness': response = await readiness(req); break;
      case 'profile-photo': response = await profilePhoto(req); break;
      case 'submit-profile-photo': response = await submitProfilePhoto(req); break;
      case 'preview': response = await preview(req, url); break;
      case 'timeline': response = await timeline(req, url); break;
      case 'approve': response = await approve(req); break;
      case 'reject': response = await reject(req); break;
      default: throw new Error('invalid_request');
    }
    return withCors(response, origin);
  } catch (error) {
    return withCors(errorResponse(error), origin);
  }
});
