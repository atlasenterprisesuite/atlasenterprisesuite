import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const path = 'supabase/functions/atlas-creator-e2e-verifier/index.ts';
const source = existsSync(path) ? readFileSync(path, 'utf8') : '';
const workflowPath = '.github/workflows/verify-creator-production-e2e.yml';
const workflow = existsSync(workflowPath) ? readFileSync(workflowPath, 'utf8') : '';

describe('ATLAS Creator privileged E2E verifier contract', () => {
  it('uses a dedicated synthetic owner identity and scoped authorization', () => {
    expect(source).toContain("atlas-creator-e2e@atlas.invalid");
    expect(source).toContain("ATLAS Creator E2E");
    expect(source).toContain("role:'owner'");
    expect(source).toContain('atlas_verify_runtime_invocation');
    expect(source).toContain("const PURPOSE = 'creator-privileged-production-e2e'");
    expect(source).toContain('purpose: PURPOSE');
  });

  it('accepts GitHub OIDC only from the canonical main workflow', () => {
    expect(source).toContain("const REPO = 'atlasenterprisesuite/atlasenterprisesuite'");
    expect(source).toContain("const OWNER = 'atlasenterprisesuite'");
    expect(source).toContain("const OIDC_AUDIENCE = 'atlas-enterprise-suite-creator-e2e'");
    expect(source).toContain("verifyGitHubOIDC");
    expect(source).toContain("https://token.actions.githubusercontent.com");
    expect(source).toContain("payload.repository !== REPO");
    expect(source).toContain("payload.repository_owner !== OWNER");
    expect(source).toContain("payload.ref !== 'refs/heads/main'");
    expect(source).toContain('payload.workflow_ref !== WORKFLOW_REF');
  });

  it('ships a secretless manual workflow that requests OIDC and asserts cleanup', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('id-token: write');
    expect(workflow).toContain('contents: read');
    expect(workflow).toContain('atlas-enterprise-suite-creator-e2e');
    expect(workflow).toContain('atlas-creator-e2e-verifier?api=verify');
    expect(workflow).toContain('.generation_enabled == false');
    expect(workflow).toContain('.cleanup.production_deleted == true');
    expect(workflow).toContain('.cleanup.membership_demoted == true');
    expect(workflow).toContain('.cleanup.session_revoked == true');
    expect(workflow).not.toMatch(/secrets\./);
  });

  it('fails closed instead of claiming an existing synthetic org owned by another user', () => {
    expect(source).toContain("select('id,created_by')");
    expect(source).toContain('synthetic_org_ownership_mismatch');
    expect(source).toContain('created_by');
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

  it('revokes temporary privilege and credentials after every run', () => {
    expect(source).toContain("role:'staff'");
    expect(source).toContain('/auth/v1/logout?scope=global');
    expect(source).toContain('finally');
  });

  it('never returns credentials or bearer tokens', () => {
    expect(source).not.toMatch(/return\s+json\([^\n]*(password|accessToken|access_token|refresh_token)/);
    expect(source).toContain("generation_enabled===false");
  });
});
