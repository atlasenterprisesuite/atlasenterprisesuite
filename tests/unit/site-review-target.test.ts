import { describe, expect, it } from 'vitest';
import { prepareSiteReviewTarget } from '../../apps/web/src/modules/integration/site-review-target';

describe('Site Review safe offline target intake', () => {
  it('normalizes HTTPS public hostname and returns only non-sensitive metadata', () => {
    const result = prepareSiteReviewTarget('https://WWW.Example.com/products/item?token=DO_NOT_EXPOSE#private');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.target).toEqual({
      origin: 'https://www.example.com',
      hostname: 'www.example.com',
      pathDepth: 2,
      queryParameterCount: 1,
      fragmentPresent: true,
      remoteInspection: 'not_configured'
    });
    expect(JSON.stringify(result)).not.toContain('DO_NOT_EXPOSE');
    expect(JSON.stringify(result)).not.toContain('/products/item');
    expect(JSON.stringify(result)).not.toContain('private');
  });

  it.each([
    'http://example.com', 'file:///etc/passwd', 'javascript:alert(1)',
    'https://user:secret@example.com', 'https://127.0.0.1',
    'https://2130706433', 'https://[::1]', 'https://localhost',
    'https://admin.local', 'https://intranet.internal',
    'https://example.com:8443', 'https://singlelabel',
    'https://foo..com', 'https://example.com\\nmalicious'
  ])('rejects unsafe or unsupported target %s', (input) => {
    expect(prepareSiteReviewTarget(input).ok).toBe(false);
  });

  it('does not treat a syntactically prepared URL as evidence of a live scan', () => {
    const result = prepareSiteReviewTarget('https://docs.example.org/');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.target.remoteInspection).toBe('not_configured');
  });

  it('fails closed for missing and excessive input', () => {
    expect(prepareSiteReviewTarget(' ').ok).toBe(false);
    expect(prepareSiteReviewTarget(`https://example.com/${'a'.repeat(2100)}`).ok).toBe(false);
  });
});
