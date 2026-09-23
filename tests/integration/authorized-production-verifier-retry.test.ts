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

  it('preserves canonical probe calls consumed by route release contracts',()=>{
    expect(source).toContain("probe('/commerce')");
    expect(source).toContain("probe('/work')");
    expect(source).toContain("probe('/business/network/compliance')");
  });

  it('keeps protected deployment.json outside normal route probing',()=>{
    expect(source).toContain("probe('/deployment.json', false)");
    expect(source).toContain("const deploymentPathProtected = [302, 401, 403].includes(deployment.status)");
  });

  it('still fails closed on exact-SHA evidence after retries are exhausted',()=>{
    expect(source).toContain('attempt === MAX_PROBE_ATTEMPTS - 1');
    expect(source).toContain('const versionIdConsistent');
    expect(source).toContain('const productionCommitVerified');
    expect(source).toContain('verified ? 200 : 502');
  });
});
