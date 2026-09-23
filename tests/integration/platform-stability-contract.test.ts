import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const adapter = readFileSync('supabase/functions/atlas-copilot/atlas-local-responses-adapter.mjs', 'utf8');
const verifier = readFileSync('supabase/functions/atlas-runtime-verifier/index.ts', 'utf8');
const bootstrap = readFileSync('.github/workflows/atlas-local-ai-bootstrap.yml', 'utf8');
const reconcile = readFileSync('.github/workflows/cloudflare-builds-reconcile.yml', 'utf8');

describe('ATLAS platform stability contract', () => {
  it('retries transient local runtime health and inference failures without enabling a paid fallback', () => {
    expect(adapter).toContain('LOCAL_PROBE_ATTEMPTS=4');
    expect(adapter).toContain('LOCAL_EXECUTION_ATTEMPTS=4');
    expect(adapter).toContain('retryableStatus(response.status)');
    expect(adapter).toContain("verified:false,provider:'atlas-local'");
  });

  it('retries only transient verifier HTTP failures while preserving authorization failures', () => {
    expect(verifier).toContain('const TRANSIENT_HTTP=new Set([500,502,503,504,520,522,524,546])');
    expect(verifier).toContain('requestWithRetry');
    expect(verifier).toContain("03_anonymous_status_rejected");
    expect(verifier).toContain("15_cross_tenant_denied");
  });

  it('keeps the self-hosted bootstrap out of the automatic main queue', () => {
    expect(bootstrap).toContain('workflow_dispatch:');
    expect(bootstrap).not.toContain('  push:');
    expect(bootstrap).toContain('runs-on: self-hosted');
  });

  it('disconnects only the legacy Cloudflare build trigger and preserves the canonical Worker', () => {
    expect(reconcile).toContain('CANONICAL_WORKER: atlas-enterprise-suite-web');
    expect(reconcile).toContain('LEGACY_WORKER: atlas-enterprise-suite');
    expect(reconcile).toContain('user/tokens/verify');
    expect(reconcile).toContain('/builds/workers/$LEGACY_TAG/triggers');
    expect(reconcile).toContain('/builds/triggers/$TRIGGER_ID');
    expect(reconcile).toContain('GITHUB_REPOSITORY_OWNER');
    expect(reconcile).not.toContain('/workers/scripts/$LEGACY_WORKER');
  });
});
