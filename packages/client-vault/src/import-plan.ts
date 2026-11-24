/** Metadata-only intake planning. Never send document bytes or secrets to logs. */
export type IntakeKind = 'client_folder' | 'document_review' | 'secrets_quarantine' | 'unsupported';
export interface DriveEntry { id: string; title: string; mimeType: string; }
export interface IntakePlan { sourceId: string; kind: IntakeKind; requiresHumanReview: boolean; }
export function classifyDriveEntry(entry: DriveEntry): IntakePlan {
  if (!entry.id || !entry.title || !entry.mimeType) return { sourceId: '', kind: 'unsupported', requiresHumanReview: true };
  if (/password|credential|secret|contraseñ|clave|token/i.test(entry.title))
    return { sourceId: entry.id, kind: 'secrets_quarantine', requiresHumanReview: true };
  if (entry.mimeType === 'application/vnd.google-apps.folder')
    return { sourceId: entry.id, kind: 'client_folder', requiresHumanReview: true };
  if (entry.mimeType === 'application/pdf')
    return { sourceId: entry.id, kind: 'document_review', requiresHumanReview: true };
  return { sourceId: entry.id, kind: 'unsupported', requiresHumanReview: true };
}
