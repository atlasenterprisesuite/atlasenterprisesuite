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
    expect(assetFetch).toHaveBeenCalledWith(request);
  });

  it('attests the bundled commit on normal Worker responses without exposing deployment.json', async () => {
    const assetFetch = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (url.pathname === '/deployment.json') {
        return new Response(JSON.stringify({ commit_sha: 'commit-abc123' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('ATLAS asset', { status: 200 });
    });

    const response = await worker.fetch(new Request('https://atlas.example/finance'), { ASSETS: { fetch: assetFetch } });
    expect(response.headers.get('X-Atlas-Commit-Sha')).toBe('commit-abc123');
  });

  it('preserves the current public-shell authorization architecture', () => {
    expect(source).not.toContain('CF-Access-Jwt-Assertion');
    expect(source).toContain('env.ASSETS.fetch(request)');
  });
});
