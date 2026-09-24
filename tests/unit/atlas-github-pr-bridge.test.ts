import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/functions/atlas-github-pr-bridge/index.ts', 'utf8');
const workflow = readFileSync('.github/workflows/atlas-intelligent-issue-router.yml', 'utf8');
const bootstrap = readFileSync('.github/workflows/lib/atlas-issue-work-bootstrap.cjs', 'utf8');

describe('ATLAS GitHub PR bridge', () => {
  it('accepts only canonical main router GitHub OIDC', () => {
    expect(source).toContain("const REPO = 'atlasenterprisesuite/atlasenterprisesuite'");
    expect(source).toContain("const OWNER = 'atlasenterprisesuite'");
    expect(source).toContain("const AUDIENCE = 'atlas-github-pr-bridge'");
    expect(source).toContain("atlas-intelligent-issue-router.yml@refs/heads/main");
    expect(source).toContain("payload.repository !== REPO");
    expect(source).toContain("payload.repository_owner !== OWNER");
    expect(source).toContain("payload.ref !== 'refs/heads/main'");
    expect(source).toContain('https://token.actions.githubusercontent.com');
    expect(workflow).toContain('id-token: write');
  });

  it('never returns or exposes the GitHub control token', () => {
    expect(source).toContain("Deno.env.get('ATLAS_GITHUB_TOKEN')");
    expect(source).toContain("Deno.env.get('GITHUB_TOKEN')");
    expect(source).toContain('secrets_returned: false');
    expect(source).not.toContain('github_control_token:');
    expect(source).not.toContain('token: token');
  });

  it('revalidates issue governance and branch scope server-side', () => {
    expect(source).toContain("'execution:auto-eligible'");
    expect(source).toContain("'review:human-required'");
    expect(source).toContain("'security:sensitive'");
    expect(source).toContain("'production:mutation'");
    expect(source).toContain("'priority:p0'");
    expect(source).toContain("expectedPrefix = 'atlas/issue-' + issueNumber + '-'");
    expect(source).toContain("'/branches/' + encodeURIComponent(head)");
    expect(source).toContain("error: 'issue_not_auto_eligible'");
  });

  it('creates only draft PRs and remains idempotent', () => {
    expect(source).toContain("'/pulls?state=open&head='");
    expect(source).toContain("draft: true");
    expect(source).toContain("base: 'main'");
    expect(source).toContain('created: false');
    expect(source).toContain('created: true');
  });

  it('falls back only for the repository Actions PR-creation restriction', () => {
    expect(bootstrap).toContain("not permitted to create or approve pull requests");
    expect(bootstrap).toContain("core.getIDToken(PR_BRIDGE_AUDIENCE)");
    expect(bootstrap).toContain("atlas-github-pr-bridge?api=create-draft");
    expect(bootstrap).toContain("'work:pr-blocked'");
    expect(bootstrap).toContain('ATLAS Auto-Work PR Blocked');
  });
});
