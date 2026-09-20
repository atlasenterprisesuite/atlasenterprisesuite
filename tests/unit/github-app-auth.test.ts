import { generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  createGitHubAppJwt,
  createGitHubInstallationToken,
} from '../../apps/atlas-orchestrator/src/github/appAuth';

describe('ATLAS GitHub App authentication', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const credentials = {
    appId: '123456',
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };

  it('creates a short-lived RS256 app JWT', () => {
    const jwt = createGitHubAppJwt(credentials, 1_800_000_000);
    const [headerRaw, payloadRaw, signatureRaw] = jwt.split('.');
    const header = JSON.parse(Buffer.from(headerRaw, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(payloadRaw, 'base64url').toString('utf8'));

    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(payload).toEqual({
      iat: 1_799_999_940,
      exp: 1_800_000_540,
      iss: '123456',
    });
    expect(verify(
      'RSA-SHA256',
      Buffer.from(`${headerRaw}.${payloadRaw}`),
      publicKey,
      Buffer.from(signatureRaw, 'base64url'),
    )).toBe(true);
  });

  it('mints an installation token with scoped permissions and repository ids', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers.authorization).toMatch(/^Bearer /);
      expect(headers['x-github-api-version']).toBe('2022-11-28');
      expect(JSON.parse(String(init?.body))).toEqual({
        repository_ids: [1329354275],
        permissions: { contents: 'write', pull_requests: 'write' },
      });
      return new Response(JSON.stringify({
        token: 'installation-token',
        expires_at: '2026-09-20T16:40:00Z',
        permissions: { contents: 'write', pull_requests: 'write' },
        repositories: [{
          id: 1329354275,
          name: 'atlasenterprisesuite',
          full_name: 'atlasenterprisesuite/atlasenterprisesuite',
        }],
      }), { status: 201, headers: { 'content-type': 'application/json' } });
    });

    const result = await createGitHubInstallationToken({
      credentials,
      installationId: 42,
      repositoryIds: [1329354275],
      permissions: { contents: 'write', pull_requests: 'write' },
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result.token).toBe('installation-token');
    expect(result.repositories[0]?.fullName).toBe('atlasenterprisesuite/atlasenterprisesuite');
  });
});
