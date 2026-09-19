import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import worker from '../../worker/index';

const source = readFileSync(`${process.cwd()}/worker/index.ts`, 'utf8');

describe('Cloudflare public Worker security headers', () => {
  it('adds browser hardening headers to public asset responses', async () => {
    const assetFetch = vi.fn(async () => new Response('ATLAS asset', { status: 200 }));
    const request = new Request('https://atlas.example/');
    const response = await worker.fetch(request, { ASSETS: { fetch: assetFetch } });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ATLAS asset');
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(response.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('Permissions-Policy')).toContain('camera=()');
    expect(response.headers.get('Permissions-Policy')).toContain('xr-spatial-tracking=(self)');
    expect(assetFetch).toHaveBeenCalledOnce();
    expect(assetFetch).toHaveBeenCalledWith(request);
  });

  it('attests Cloudflare version metadata on normal Worker responses with one asset fetch', async () => {
    const assetFetch = vi.fn(async () => new Response('ATLAS asset', { status: 200 }));
    const request = new Request('https://atlas.example/finance');
    const response = await worker.fetch(request, {
      ASSETS: { fetch: assetFetch },
      CF_VERSION_METADATA: {
        id: 'version-123',
        tag: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        timestamp: '2026-09-17T03:00:00.000Z',
      },
    });

    expect(response.headers.get('X-Atlas-Version-Id')).toBe('version-123');
    expect(response.headers.get('X-Atlas-Version-Tag')).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(response.headers.get('X-Atlas-Commit-Sha')).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(assetFetch).toHaveBeenCalledOnce();
    expect(assetFetch).toHaveBeenCalledWith(request);
  });

  it('falls back to the build deployment manifest when Cloudflare version metadata has no commit tag', async () => {
    const commitSha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const assetFetch = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (url.pathname === '/deployment.json') {
        return new Response(JSON.stringify({ commit_sha: commitSha }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('ATLAS native build', { status: 200 });
    });
    const request = new Request('https://atlas.example/crm');
    const response = await worker.fetch(request, {
      ASSETS: { fetch: assetFetch },
      CF_VERSION_METADATA: {
        id: 'native-version-456',
        timestamp: '2026-09-19T06:45:00.000Z',
      },
    });

    expect(response.headers.get('X-Atlas-Version-Id')).toBe('native-version-456');
    expect(response.headers.get('X-Atlas-Version-Tag')).toBe(commitSha);
    expect(response.headers.get('X-Atlas-Commit-Sha')).toBe(commitSha);
    expect(assetFetch).toHaveBeenCalledTimes(2);
    expect(new URL(assetFetch.mock.calls[1][0].url).pathname).toBe('/deployment.json');
  });

  it('fails closed when neither Cloudflare metadata nor the build manifest proves a valid commit SHA', async () => {
    const assetFetch = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (url.pathname === '/deployment.json') {
        return new Response(JSON.stringify({ commit_sha: 'not-a-valid-sha' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('ATLAS unverified build', { status: 200 });
    });
    const response = await worker.fetch(new Request('https://atlas.example/finance'), {
      ASSETS: { fetch: assetFetch },
      CF_VERSION_METADATA: {
        id: 'native-version-invalid',
        tag: 'untagged-native-build',
        timestamp: '2026-09-19T06:46:00.000Z',
      },
    });

    expect(response.headers.get('X-Atlas-Version-Id')).toBe('native-version-invalid');
    expect(response.headers.get('X-Atlas-Version-Tag')).toBeNull();
    expect(response.headers.get('X-Atlas-Commit-Sha')).toBeNull();
  });

  it('preserves the current public-shell authorization architecture', () => {
    expect(source).not.toContain('CF-Access-Jwt-Assertion');
    expect(source).toContain('env.ASSETS.fetch(request)');
  });
});
