import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('tools/local-agent/atlas-work-browser-runtime.mjs', 'utf8');

describe('ATLAS governed browser runtime', () => {
  it('uses the Work runtime queue rather than unrestricted desktop control', () => {
    expect(source).toContain("'claim_work_runtime_job'");
    expect(source).toContain("'complete_work_runtime_job'");
    expect(source).toContain('execution_envelope');
    expect(source).not.toContain('child_process');
    expect(source).not.toContain('eval(');
  });

  it('requires loopback CDP and HTTPS navigation', () => {
    expect(source).toContain('browser_cdp_must_be_loopback');
    expect(source).toContain("url.protocol !== 'https:'");
    expect(source).toContain('browser_navigation_target_denied');
  });

  it('fails closed for sensitive typing and ordinary OAuth-looking clicks', () => {
    expect(source).toContain('browser_sensitive_input_denied');
    expect(source).toContain('oauth_consent_requires_approved_action');
    expect(source).toContain("'oauth_consent'");
  });

  it('never sends browser cookies or credentials as result data', () => {
    expect(source).toContain('SENSITIVE_KEY');
    expect(source).toMatch(/cookie\\|authorization\\|credential/);
    expect(source).not.toContain('Network.getAllCookies');
    expect(source).not.toContain('Storage.getCookies');
    expect(source).toContain("url.search = ''");
    expect(source).toContain("url.hash = ''");
  });
});
