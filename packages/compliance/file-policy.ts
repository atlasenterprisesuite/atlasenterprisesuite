export const COMPLIANCE_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const COMPLIANCE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export type ComplianceImageMetadata = {
  mimeType: string;
  sizeBytes: number;
};

export type ComplianceImageValidation =
  | { ok: true }
  | { ok: false; error: 'empty_image' | 'image_too_large' | 'unsupported_image_type' };

export function validateComplianceImageMetadata(
  input: ComplianceImageMetadata
): ComplianceImageValidation {
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, error: 'empty_image' };
  }
  if (input.sizeBytes > COMPLIANCE_IMAGE_MAX_BYTES) {
    return { ok: false, error: 'image_too_large' };
  }
  if (!(COMPLIANCE_IMAGE_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
    return { ok: false, error: 'unsupported_image_type' };
  }
  return { ok: true };
}
