import { describe, expect, it } from 'vitest';
import { authorizeScribeGuide, type ScribeGuide, type ScribeViewer } from './scribeAccess';

const guide: ScribeGuide = {
  id: 'guide-1', organizationId: 'org-a', title: 'Onboarding',
  url: 'https://scribehow.com/shared/guide-1', visibility: 'organization', enabled: true
};
const viewer: ScribeViewer = {
  authenticated: true, organizationId: 'org-a', roles: ['viewer'], consentToExternalContent: true
};
describe('Scribe fail-closed access gate', () => {
  it('allows an explicitly consented, authenticated member of the same tenant', () => {
    expect(authorizeScribeGuide(guide, viewer)).toEqual({ allowed: true, embedUrl: guide.url });
  });
  it.each([
    [{ authenticated: false }, 'unauthenticated'],
    [{ organizationId: 'org-b' }, 'tenant_mismatch'],
    [{ organizationId: null }, 'tenant_mismatch'],
    [{ roles: [] }, 'forbidden'],
    [{ roles: ['untrusted'] }, 'forbidden'],
    [{ consentToExternalContent: false }, 'consent_required']
  ] as const)('denies invalid viewer %j', (change, reason) => {
    expect(authorizeScribeGuide(guide, { ...viewer, ...change })).toMatchObject({ allowed: false, reason });
  });
  it.each([
    'http://scribehow.com/shared/guide-1',
    'https://scribehow.com.evil.example/shared/guide-1',
    'https://evil.example/shared/guide-1',
    'https://scribehow.com@evil.example/shared/guide-1',
    'https://scribehow.com/settings?token=secret',
    'https://scribehow.com/shared/guide-1?token=secret',
    'https://scribehow.com/shared/guide-1#private',
    'javascript:alert(1)'
  ])('rejects unsafe provider URLs: %s', url => {
    expect(authorizeScribeGuide({ ...guide, url }, viewer)).toMatchObject({ allowed: false, reason: 'invalid_url' });
  });
  it('denies disabled guides', () => {
    expect(authorizeScribeGuide({ ...guide, enabled: false }, viewer)).toMatchObject({ allowed: false, reason: 'disabled' });
  });
});
