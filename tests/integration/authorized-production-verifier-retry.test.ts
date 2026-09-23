import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync(
  'supabase/functions/atlas-cloudflare-production-http-verify/index.ts',
  'utf8'
);

describe('authorized production verifier transient retry contract',()=>{
  it('retries only transient HTTP/network failures',()=>{
    expect(source).toContain('const MAX_PROBE_ATTEMPTS = 3');
    expect(source).toContain('const RETRYABLE_STATUSES = new Set([0, 408, 425, 429])');
    expect(source).toContain('status >= 500');
    expect(source).not.toContain('RETRYABLE_STATUSES = new Set([0, 403');
    expect(source).not.toContain('RETRYABLE_STATUSES = new Set([0, 404');
  });

  it('re-probes successful routes until exact expected SHA evidence appears',()=>{
    expect(source).toContain('result.status === 200');
    expect(source).toContain('!result.atlas_version_id || result.atlas_version_tag !== expectedSha');
    expect(source).toContain("probe('/', true, caller.claims.sha)");
    expect(source).toContain("probe('/business/network/compliance', true, caller.claims.sha)");
  });

  it('keeps protected deployment.json outside exact-SHA route retry contract',()=>{
    expect(source).toContain("probe('/deployment.json', false)");
    expect(source).toContain("const deploymentPathProtected = [302, 401, 403].includes(deployment.status)");
  });

  it('still fails closed after the final unsuccessful attempt',()=>{
    expect(source).toContain('attempt === MAX_PROBE_ATTEMPTS - 1');
    expect(source).toContain('const verified = publicShellOk');
    expect(source).toContain('verified ? 200 : 502');
  });
});
