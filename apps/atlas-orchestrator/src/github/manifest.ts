import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

type FetchLike = typeof fetch;

export const ATLAS_GITHUB_APP_NAME = 'ATLAS Enterprise Director';
export const ATLAS_GITHUB_APP_HOMEPAGE = 'https://www.atlasenterprisesuite.com';
export const ATLAS_GITHUB_APP_REPOSITORY = 'atlasenterprisesuite/atlasenterprisesuite';
export const ATLAS_GITHUB_APP_REPOSITORY_ID = 1329354275;

export type GitHubAppManifestConversion = {
  appId: string;
  privateKey: string;
  webhookSecret: string;
  clientId: string | null;
  clientSecret: string | null;
  slug: string | null;
  htmlUrl: string | null;
};

function hmac(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function createGitHubSetupState(secret: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const normalized = secret.trim();
  if (!normalized) throw new Error('ATLAS GitHub setup secret is not configured');
  const payload = `${nowSeconds}.${randomBytes(18).toString('base64url')}`;
  return `${payload}.${hmac(normalized, payload)}`;
}

export function verifyGitHubSetupState(
  secret: string,
  state: string | null | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const normalized = secret.trim();
  if (!normalized || !state) return false;
  const parts = state.split('.');
  if (parts.length !== 3) return false;
  const [timestampRaw, nonce, supplied] = parts;
  const timestamp = Number(timestampRaw);
  if (!Number.isSafeInteger(timestamp) || !nonce || !supplied) return false;
  if (timestamp > nowSeconds + 60 || nowSeconds - timestamp > 3600) return false;
  const expected = hmac(normalized, `${timestampRaw}.${nonce}`);
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function buildGitHubAppManifest(baseUrl: string): Record<string, unknown> {
  const origin = baseUrl.replace(/\/+$/, '');
  return {
    name: ATLAS_GITHUB_APP_NAME,
    url: ATLAS_GITHUB_APP_HOMEPAGE,
    description: 'Least-privilege GitHub control plane for ATLAS Enterprise Suite.',
    redirect_url: `${origin}/github-app/setup/callback`,
    setup_url: `${origin}/github-app/setup/installed`,
    setup_on_update: true,
    public: false,
    hook_attributes: {
      url: `${origin}/webhooks/github`,
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
    default_events: [
      'check_run',
      'check_suite',
      'deployment',
      'deployment_status',
      'issue_comment',
      'issues',
      'pull_request',
      'pull_request_review',
      'pull_request_review_comment',
      'push',
      'workflow_run',
    ],
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderGitHubManifestRegistrationForm(input: {
  state: string;
  manifest: Record<string, unknown>;
}): string {
  const action = `https://github.com/settings/apps/new?state=${encodeURIComponent(input.state)}`;
  const manifest = escapeHtml(JSON.stringify(input.manifest));
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Register ATLAS GitHub App</title></head>
<body>
<main>
  <h1>ATLAS GitHub App</h1>
  <p>GitHub requires the account owner to confirm creation of this private GitHub App.</p>
  <form id="atlas-github-app-manifest" action="${action}" method="post">
    <input type="hidden" name="manifest" value="${manifest}">
    <button type="submit">Continue to GitHub</button>
  </form>
</main>
<script>document.getElementById('atlas-github-app-manifest').submit();</script>
</body>
</html>`;
}

export async function exchangeGitHubAppManifestCode(input: {
  code: string;
  fetchImpl?: FetchLike;
}): Promise<GitHubAppManifestConversion> {
  const code = input.code.trim();
  if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) throw new Error('GitHub manifest code is invalid');
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`,
    {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
      },
    },
  );
  if (!response.ok) {
    throw new Error(`GitHub App manifest conversion failed with HTTP ${response.status}`);
  }
  const value = await response.json() as {
    id?: number;
    pem?: string;
    webhook_secret?: string;
    client_id?: string;
    client_secret?: string;
    slug?: string;
    html_url?: string;
  };
  if (!value.id || !value.pem || !value.webhook_secret) {
    throw new Error('GitHub App manifest conversion response is incomplete');
  }
  return {
    appId: String(value.id),
    privateKey: value.pem,
    webhookSecret: value.webhook_secret,
    clientId: value.client_id ?? null,
    clientSecret: value.client_secret ?? null,
    slug: value.slug ?? null,
    htmlUrl: value.html_url ?? null,
  };
}
