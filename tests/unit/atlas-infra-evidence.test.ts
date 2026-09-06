import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS infrastructure evidence ingress security contract', () => {
  const source = () => readFileSync('adapters/supabase/atlas-infra-evidence/index.ts', 'utf-8');

  it('accepts evidence only from the canonical main production workflow through GitHub OIDC', () => {
    const code = source();

    expect(code).toContain("const REPO = 'atlasenterprisesuite/atlasenterprisesuite'");
    expect(code).toContain("const AUDIENCE = 'atlas-infrastructure-evidence'");
    expect(code).toContain(".github/workflows/production-deploy.yml@refs/heads/main");
    expect(code).toContain("payload.ref !== 'refs/heads/main'");
    expect(code).not.toContain("Deno.env.get('GITHUB_TOKEN')");
  });

  it('reuses the governed runtime verification registry instead of creating a second evidence store', () => {
    const code = source();

    expect(code).toContain("from('atlas_runtime_verification_runs')");
    expect(code).toContain("verification_type: 'infrastructure-deployment'");
    expect(code).toContain("status: 'passed'");
  });
});
