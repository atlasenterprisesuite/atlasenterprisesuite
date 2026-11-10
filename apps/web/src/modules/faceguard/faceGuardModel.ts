/** ATLAS FaceGuard: consent-first evidence review. No remote facial identification. */
export type EvidenceKind = 'public-post' | 'broadcast-transcript' | 'user-upload';
export type ReviewStatus = 'unreviewed' | 'verified' | 'dismissed';
export interface FaceGuardConsent {
  subjectId: string;
  grantedAt: string;
  revokedAt?: string;
  purposes: readonly ('self-image-review' | 'name-mention-monitoring')[];
}
export interface EvidenceItem {
  id: string;
  subjectId: string;
  kind: EvidenceKind;
  sourceUrl?: string;
  quotedText?: string;
  observedAt: string;
  status: ReviewStatus;
}
export function isConsentActive(consent: FaceGuardConsent | undefined, purpose: FaceGuardConsent['purposes'][number]): boolean {
  return Boolean(consent && !consent.revokedAt && consent.purposes.includes(purpose) && Number.isFinite(Date.parse(consent.grantedAt)));
}
export function acceptEvidence(item: EvidenceItem, consent: FaceGuardConsent | undefined): EvidenceItem {
  if (!consent || consent.subjectId !== item.subjectId || !isConsentActive(consent, 'name-mention-monitoring')) {
    throw new Error('FACEGUARD_CONSENT_REQUIRED');
  }
  if (!item.id.trim() || !Number.isFinite(Date.parse(item.observedAt))) throw new Error('FACEGUARD_INVALID_EVIDENCE');
  if (item.sourceUrl) {
    const url = new URL(item.sourceUrl);
    if (url.protocol !== 'https:') throw new Error('FACEGUARD_HTTPS_REQUIRED');
  }
  return { ...item, status: 'unreviewed' };
}
export function revokeConsent(consent: FaceGuardConsent, at: string): FaceGuardConsent {
  if (!Number.isFinite(Date.parse(at))) throw new Error('FACEGUARD_INVALID_DATE');
  return { ...consent, revokedAt: at };
}
