import { createSign } from 'node:crypto';

type FetchLike = typeof fetch;

export type GitHubAppCredentials = {
  appId: string;
  privateKey: string;
};

export type GitHubInstallationToken = {
  token: string;
  expiresAt: string;
  permissions: Record<string, string>;
  repositories: Array<{ id: number; name: string; fullName: string }>;
};

function base64Url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function normalizePrivateKey(value: string): string {
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
}

export function createGitHubAppJwt(
  credentials: GitHubAppCredentials,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const appId = credentials.appId.trim();
  const privateKey = normalizePrivateKey(credentials.privateKey.trim());
  if (!appId || !privateKey) throw new Error('ATLAS GitHub App credentials are incomplete');

  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iat: nowSeconds - 60,
    exp: nowSeconds + (9 * 60),
    iss: appId,
  }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey).toString('base64url');
  return `${unsigned}.${signature}`;
}

export async function createGitHubInstallationToken(input: {
  credentials: GitHubAppCredentials;
  installationId: number;
  repositoryIds?: number[];
  permissions?: Record<string, 'read' | 'write'>;
  fetchImpl?: FetchLike;
}): Promise<GitHubInstallationToken> {
  if (!Number.isSafeInteger(input.installationId) || input.installationId <= 0) {
    throw new Error('ATLAS GitHub installation id is invalid');
  }

  const jwt = createGitHubAppJwt(input.credentials);
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `https://api.github.com/app/installations/${input.installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${jwt}`,
        'content-type': 'application/json',
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify({
        ...(input.repositoryIds?.length ? { repository_ids: input.repositoryIds } : {}),
        ...(input.permissions ? { permissions: input.permissions } : {}),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub installation token request failed with HTTP ${response.status}`);
  }

  const value = await response.json() as {
    token?: string;
    expires_at?: string;
    permissions?: Record<string, string>;
    repositories?: Array<{ id: number; name: string; full_name: string }>;
  };

  if (!value.token || !value.expires_at) {
    throw new Error('GitHub installation token response is incomplete');
  }

  return {
    token: value.token,
    expiresAt: value.expires_at,
    permissions: value.permissions ?? {},
    repositories: (value.repositories ?? []).map((repository) => ({
      id: repository.id,
      name: repository.name,
      fullName: repository.full_name,
    })),
  };
}
