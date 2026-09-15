import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/functions/atlas-infra-evidence/index.ts', 'utf8');
const statusMigration = readFileSync(
  'supabase/migrations/20260915164724_allow_cloudflare_edge_challenge_verification_status.sql',
  'utf8'
);

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

  it('persists Cloudflare edge challenge as a completed verification status', () => {
    expect(statusMigration).toContain("'blocked_by_edge_challenge'");
    expect(statusMigration).toContain("status in ('running', 'passed', 'failed', 'blocked', 'blocked_by_edge_challenge')");
    expect(statusMigration).toContain("status in ('passed', 'failed', 'blocked', 'blocked_by_edge_challenge') and completed_at is not null");
  });

  it('allows only approved main-branch infrastructure workflows through OIDC', () => {
    expect(source).toContain(".github/workflows/production-deploy.yml@refs/heads/main");
    expect(source).toContain(".github/workflows/cloudflare-deploy.yml@refs/heads/main");
    expect(source).toContain("ALLOWED_WORKFLOWS.has(String(payload.workflow_ref || ''))");
  });
});
