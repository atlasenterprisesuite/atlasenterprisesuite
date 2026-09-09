import { describe, expect, it } from 'vitest';
import { resolveAtlasIdentityTarget } from '../../apps/web/src/identity/identityTarget';

describe('ATLAS Identity return target', () => {
  it('preserves safe canonical app and legacy ATLAS routes including search and hash', () => {
    expect(resolveAtlasIdentityTarget('/app/finance?view=open#top')).toBe('/app/finance?view=open#top');
    expect(resolveAtlasIdentityTarget('/finance/accounting?view=open#top')).toBe('/finance/accounting?view=open#top');
    expect(resolveAtlasIdentityTarget('/people/payroll')).toBe('/people/payroll');
    expect(resolveAtlasIdentityTarget('/studio/voice')).toBe('/studio/voice');
  });

  it('fails closed for external, protocol-relative, backslash and recursive identity targets', () => {
    expect(resolveAtlasIdentityTarget('https://example.org/outside')).toBe('/app');
    expect(resolveAtlasIdentityTarget('//example.org/outside')).toBe('/app');
    expect(resolveAtlasIdentityTarget('/\\example.org/outside')).toBe('/app');
    expect(resolveAtlasIdentityTarget('/identity?app=%2Fapp%2Ffinance')).toBe('/app');
  });

  it('fails closed for malformed encoded targets', () => {
    expect(resolveAtlasIdentityTarget('%E0%A4%A')).toBe('/app');
  });
});
