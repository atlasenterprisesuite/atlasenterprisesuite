import { describe, expect, it, vi } from 'vitest';
import {
  ATLAS_GITHUB_APP_REPOSITORY,
  buildGitHubAppManifest,
  createGitHubSetupState,
  exchangeGitHubAppManifestCode,
  renderGitHubManifestRegistrationForm,
  verifyGitHubSetupState,
} from '../../apps/atlas-orchestrator/src/github/manifest';

describe('ATLAS GitHub App manifest activation', () => {
  it('builds a private least-privilege manifest for the sovereign orchestrator', () => {
    const manifest = buildGitHubAppManifest('https://atlas-sovereign-orchestrator.onrender.com');
    expect(manifest).toMatchObject({
      public: false,
      redirect_url: 'https://atlas-sovereign-orchestrator.onrender.com/github-app/setup/callback',
      setup_url: 'https://atlas-sovereign-orchestrator.onrender.com/github-app/setup/installed',
      hook_attributes: {
        url: 'https://atlas-sovereign-orchestrator.onrender.com/webhooks/github',
        active: true,
      },
      default_permissions: {
        actions: 'read',
        checks: 'read',
        contents: 'write',
        deployments: 'read',
        issues: 'write',
        pull_requests: 'write',
        statuses: 'read',
      },
    });
    expect(ATLAS_GITHUB_APP_REPOSITORY).toBe('atlasenterprisesuite/atlasenterprisesuite');
  });

  it('signs short-lived setup state and rejects expired or forged state', () => {
    const state = createGitHubSetupState('setup-secret', 1_800_000_000);
    expect(verifyGitHubSetupState('setup-secret', state, 1_800_000_100)).toBe(true);
    expect(verifyGitHubSetupState('wrong-secret', state, 1_800_000_100)).toBe(false);
    expect(verifyGitHubSetupState('setup-secret', state, 1_800_004_000)).toBe(false);
  });

  it('renders a POST form to GitHub rather than placing the manifest in a query string', () => {
    const html = renderGitHubManifestRegistrationForm({
      state: 'signed-state',
      manifest: buildGitHubAppManifest('https://atlas-sovereign-orchestrator.onrender.com'),
    });
    expect(html).toContain('action="https://github.com/settings/apps/new?state=signed-state"');
    expect(html).toContain('method="post"');
    expect(html).toContain('name="manifest"');
    expect(html).not.toContain('ATLAS_GITHUB_PRIVATE_KEY');
  });

  it('exchanges a temporary manifest code without logging or persisting credentials itself', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      id: 123456,
      pem: '-----BEGIN PRIVATE KEY-----\nprivate\n-----END PRIVATE KEY-----',
      webhook_secret: 'webhook-secret',
      client_id: 'Iv1.client',
      client_secret: 'client-secret',
      slug: 'atlas-enterprise-director',
      html_url: 'https://github.com/apps/atlas-enterprise-director',
    }), { status: 201, headers: { 'content-type': 'application/json' } }));

    const result = await exchangeGitHubAppManifestCode({
      code: 'temporary_code_123',
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result).toMatchObject({
      appId: '123456',
      webhookSecret: 'webhook-secret',
      slug: 'atlas-enterprise-director',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.github.com/app-manifests/temporary_code_123/conversions',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
