import { describe, expect, it } from 'vitest';
import { sanitizeBrowserResult } from '../../packages/execution/src/browser-executor';

describe('ATLAS 777 browser untrusted page text secret handling', () => {
  it.each([
    'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456',
    'password=hunter2-example-secret',
    'api_key=private-test-value-123456',
    'sk-proj-' + 'a'.repeat(32),
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnopqrstuvwxyz',
  ])('does not return credential-looking raw text: %s', raw => {
    const output = sanitizeBrowserResult('Page content: ' + raw + ' trailing text');
    expect(output).toBe('[redacted-sensitive-content]');
    expect(JSON.stringify(output)).not.toContain(raw);
  });
  it('redacts nested sensitive values, not only sensitive object keys', () => {
    expect(sanitizeBrowserResult({ title: 'Bearer abcdefghijklmnopqrstuvwxyz', safe: 'public' }))
      .toEqual({ title: '[redacted-sensitive-content]', safe: 'public' });
  });
  it('preserves ordinary non-secret text and existing output length limit', () => {
    expect(sanitizeBrowserResult('Public heading')).toBe('Public heading');
    expect((sanitizeBrowserResult('x'.repeat(5000)) as string).length).toBe(2000);
  });
});
