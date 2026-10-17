import { describe, expect, it } from 'vitest';
import { acceptEvidence, isConsentActive, revokeConsent, type FaceGuardConsent, type EvidenceItem } from './faceGuardModel';
const consent: FaceGuardConsent = { subjectId: 'self', grantedAt: '2026-10-17T00:00:00Z', purposes: ['name-mention-monitoring'] };
const item: EvidenceItem = { id: 'e1', subjectId: 'self', kind: 'public-post', sourceUrl: 'https://example.org/post', observedAt: '2026-10-17T01:00:00Z', status: 'verified' };
describe('FaceGuard consent and evidence gates', () => {
  it('defaults evidence to unreviewed, never verified', () => expect(acceptEvidence(item, consent).status).toBe('unreviewed'));
  it('rejects evidence without consent', () => expect(() => acceptEvidence(item, undefined)).toThrow('FACEGUARD_CONSENT_REQUIRED'));
  it('rejects evidence for another subject', () => expect(() => acceptEvidence({ ...item, subjectId: 'other' }, consent)).toThrow('FACEGUARD_CONSENT_REQUIRED'));
  it('rejects revoked consent', () => expect(() => acceptEvidence(item, revokeConsent(consent, '2026-10-17T02:00:00Z'))).toThrow('FACEGUARD_CONSENT_REQUIRED'));
  it('rejects insecure source URLs', () => expect(() => acceptEvidence({ ...item, sourceUrl: 'http://example.org' }, consent)).toThrow('FACEGUARD_HTTPS_REQUIRED'));
  it('rejects unrelated consent purposes', () => expect(isConsentActive({ ...consent, purposes: ['self-image-review'] }, 'name-mention-monitoring')).toBe(false));
});
