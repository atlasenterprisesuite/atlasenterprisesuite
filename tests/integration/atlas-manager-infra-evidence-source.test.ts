import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/functions/atlas-infra-evidence/index.ts', 'utf8');

describe('atlas-infra-evidence provider-neutral contract', () => {
  it('does not hard-code Vercel as the deployment evidence provider', () => {
    expect(source).not.toContain("provider: 'vercel'");
    expect(source).toContain("const ALLOWED_PROVIDERS = new Set(['github', 'supabase', 'cloudflare', 'vercel'])");
  });

  it('requires explicit validated provider and verification status', () => {
    expect(source).toContain("if (!ALLOWED_PROVIDERS.has(provider))");
    expect(source).toContain("if (!ALLOWED_STATUSES.has(status))");
    expect(source).toContain("if (!ALLOWED_VERIFICATION_TYPES.has(verificationType))");
  });

  it('accepts Cloudflare edge challenge as a distinct evidence status', () => {
    expect(source).toContain("'blocked_by_edge_challenge'");
    expect(source).toContain('statuses: [...ALLOWED_STATUSES]');
  });

  it('allows only approved main-branch infrastructure workflows through OIDC', () => {
    expect(source).toContain(".github/workflows/production-deploy.yml@refs/heads/main");
    expect(source).toContain(".github/workflows/cloudflare-deploy.yml@refs/heads/main");
    expect(source).toContain("ALLOWED_WORKFLOWS.has(String(payload.workflow_ref || ''))");
  });
});
