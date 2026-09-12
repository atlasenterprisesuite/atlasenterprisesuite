import { validateComplianceImageMetadata } from '../../../../packages/compliance/file-policy.ts';
import type { RideComplianceContext } from './context.ts';
import { getSubmission, requireReadableSubmission } from './repository.ts';

export const COMPLIANCE_EVIDENCE_BUCKET = 'atlas-compliance-evidence' as const;

function safeFilename(name: string) {
  const cleaned = name
    .replace(/[\\/]+/g, '_')
    .replace(/[\u0000-\u001f\u007f]+/g, '')
    .trim()
    .slice(0, 160);
  return cleaned || 'profile-photo';
}

export async function uploadComplianceEvidence(
  ctx: RideComplianceContext,
  input: { submissionId: string; file: File }
): Promise<{ bucket: 'atlas-compliance-evidence'; path: string; mimeType: string; sizeBytes: number }> {
  const validation = validateComplianceImageMetadata({ mimeType: input.file.type, sizeBytes: input.file.size });
  if (!validation.ok) throw new Error(validation.error);

  const filename = safeFilename(input.file.name);
  const path = `${ctx.tenantId}/${ctx.organizationId}/${ctx.userId}/ride/profile-photo/${input.submissionId}/${filename}`;
  const { error } = await ctx.storageAdmin.storage
    .from(COMPLIANCE_EVIDENCE_BUCKET)
    .upload(path, input.file, { contentType: input.file.type, upsert: false });
  if (error) throw new Error('upload_failed');

  return {
    bucket: COMPLIANCE_EVIDENCE_BUCKET,
    path,
    mimeType: input.file.type,
    sizeBytes: input.file.size
  };
}

export async function removeComplianceEvidence(ctx: RideComplianceContext, path: string): Promise<void> {
  const { error } = await ctx.storageAdmin.storage.from(COMPLIANCE_EVIDENCE_BUCKET).remove([path]);
  if (error) throw new Error('upload_failed');
}

export async function createCompliancePreview(
  ctx: RideComplianceContext,
  submissionId: string
): Promise<{ signedUrl: string; expiresIn: 300 }> {
  const submission = await getSubmission(ctx, submissionId);
  requireReadableSubmission(ctx, submission);
  if (submission.storageBucket !== COMPLIANCE_EVIDENCE_BUCKET || submission.storagePath.startsWith('pending/')) {
    throw new Error('preview_unavailable');
  }

  const { data, error } = await ctx.storageAdmin.storage
    .from(COMPLIANCE_EVIDENCE_BUCKET)
    .createSignedUrl(submission.storagePath, 300);
  if (error || !data?.signedUrl) throw new Error('preview_unavailable');
  return { signedUrl: data.signedUrl, expiresIn: 300 };
}
