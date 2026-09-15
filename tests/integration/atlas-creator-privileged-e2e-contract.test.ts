import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const path = 'supabase/functions/atlas-creator-e2e-verifier/index.ts';
const source = existsSync(path) ? readFileSync(path, 'utf8') : '';

describe('ATLAS Creator privileged E2E verifier contract', () => {
  it('uses a dedicated synthetic owner identity and runtime-token authorization', () => {
    expect(source).toContain("atlas-creator-e2e@atlas.invalid");
    expect(source).toContain("ATLAS Creator E2E");
    expect(source).toContain("role:'owner'");
    expect(source).toContain('atlas_verify_runtime_invocation');
    expect(source).toContain("purpose:'creator-privileged-production-e2e'");
  });

  it('verifies save, read, audit and cleanup without generation', () => {
    expect(source).toContain("?api=readiness");
    expect(source).toContain("?api=save");
    expect(source).toContain("?api=production");
    expect(source).toContain("creator.director.saved");
    expect(source).toContain("from('creator_productions').delete()");
    expect(source).not.toContain("?api=submit");
    expect(source).not.toContain('provider_adapter');
  });

  it('never returns credentials or bearer tokens', () => {
    expect(source).not.toMatch(/return\s+json\([^\n]*(password|accessToken|access_token|refresh_token)/);
    expect(source).toContain("generation_enabled===false");
  });
});
