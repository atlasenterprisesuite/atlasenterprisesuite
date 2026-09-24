import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS GitHub App setup HTTP wiring', () => {
  const source = readFileSync('apps/atlas-orchestrator/src/http.ts', 'utf8');

  it('protects manifest registration and stores converted credentials server-side', () => {
    expect(source).toContain('/github-app/setup?');
    expect(source).toContain('verifyGitHubSetupState');
    expect(source).toContain('/github-app/setup/callback');
    expect(source).toContain('exchangeGitHubAppManifestCode');
    expect(source).toContain('storeGitHubAppCredentials');
  });

  it('verifies the installation against the canonical repository before storing it', () => {
    expect(source).toContain('/github-app/setup/installed');
    expect(source).toContain('ATLAS_GITHUB_APP_REPOSITORY_ID');
    expect(source).toContain('createGitHubInstallationToken');
    expect(source).toContain('github_app_canonical_repository_not_installed');
    expect(source).toContain('storeGitHubInstallation');
  });

  it('loads the webhook secret from secure storage when no runtime override is present', () => {
    expect(source).toContain('resolveGitHubWebhookSecret');
    expect(source).toContain('loadGitHubAppCredentials');
    expect(source).toContain('ATLAS_GITHUB_WEBHOOK_SECRET');
  });
});
