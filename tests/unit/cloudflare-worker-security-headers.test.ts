import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(`${process.cwd()}/worker/index.ts`, 'utf8');

describe('Cloudflare worker security headers', () => {
  it('adds browser hardening headers to authenticated asset responses', () => {
    expect(source).toContain('Content-Security-Policy');
    expect(source).toContain('Strict-Transport-Security');
    expect(source).toContain('X-Content-Type-Options');
    expect(source).toContain('Referrer-Policy');
    expect(source).toContain('Permissions-Policy');
  });

  it('preserves fail-closed Access identity checks before asset delivery', () => {
    expect(source).toContain("request.headers.get('CF-Access-Jwt-Assertion')");
    expect(source).toContain("status: 401");
    expect(source).toContain("status: 403");
    expect(source.indexOf('verifyAccessAssertion(token)')).toBeLessThan(source.indexOf('env.ASSETS.fetch(request)'));
  });
});
