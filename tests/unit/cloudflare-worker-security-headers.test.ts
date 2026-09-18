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
        tag: 'commit-abc123',
        timestamp: '2026-09-17T03:00:00.000Z',
      },
    });

    expect(response.headers.get('X-Atlas-Version-Id')).toBe('version-123');
    expect(response.headers.get('X-Atlas-Version-Tag')).toBe('commit-abc123');
    expect(assetFetch).toHaveBeenCalledOnce();
    expect(assetFetch).toHaveBeenCalledWith(request);
  });

  it('preserves the current public-shell authorization architecture', () => {
    expect(source).not.toContain('CF-Access-Jwt-Assertion');
    expect(source).toContain('env.ASSETS.fetch(request)');
  });
});
