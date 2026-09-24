import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import worker from '../../worker/index';

const wrangler = readFileSync('wrangler.jsonc', 'utf8');

function createEnv() {
  const assetFetch = vi.fn(async () => new Response('ATLAS asset', { status: 200 }));
  return {
    env: { ASSETS: { fetch: assetFetch } },
    assetFetch
  };
}

describe('Cloudflare public web shell contract', () => {
  it('routes every request through the Worker before static assets', () => {
    expect(wrangler).toContain('"main": "worker/index.ts"');
    expect(wrangler).toContain('"binding": "ASSETS"');
    expect(wrangler).toContain('"run_worker_first": true');
  });

  it('serves the public landing page without a Cloudflare Access assertion', async () => {
    const { env, assetFetch } = createEnv();
    const request = new Request('https://atlas.example/');

    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ATLAS asset');
    expect(assetFetch).toHaveBeenCalledOnce();
    expect(assetFetch).toHaveBeenCalledWith(request);
  });

  it('serves ATLAS Identity publicly so module access can request credentials', async () => {
    const { env, assetFetch } = createEnv();
    const request = new Request('https://atlas.example/identity?app=%2Ffinance');

    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
    expect(assetFetch).toHaveBeenCalledWith(request);
  });

  it('serves the SPA shell for module routes and leaves authorization to RequireAtlasIdentity', async () => {
    const { env, assetFetch } = createEnv();
    const request = new Request('https://atlas.example/finance');

    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
    expect(assetFetch).toHaveBeenCalledWith(request);
  });

  it('serves public static bundles required by both the landing page and Identity screen', async () => {
    const { env, assetFetch } = createEnv();
    const request = new Request('https://atlas.example/assets/app.js');

    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
    expect(assetFetch).toHaveBeenCalledWith(request);
  });
});
