import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const wrangler = readFileSync('wrangler.jsonc', 'utf8');

describe('Cloudflare Access Worker gateway contract', () => {
  it('routes requests through an Access-aware Worker before static assets', () => {
    expect(wrangler).toContain('"main": "worker/index.ts"');
    expect(wrangler).toContain('"binding": "ASSETS"');
    expect(wrangler).toContain('"run_worker_first": true');
  });

  it('pins the expected Cloudflare Access application and team JWKS endpoint', () => {
    const worker = readFileSync('worker/index.ts', 'utf8');

    expect(worker).toContain('fccf9afb05c59c6e1edf08f1aab547f259627d6783f27dafbae366230e203835');
    expect(worker).toContain('https://winder-aranguren.cloudflareaccess.com/cdn-cgi/access/certs');
    expect(worker).toContain('CF-Access-Jwt-Assertion');
  });

  it('fails closed before serving static assets', () => {
    const worker = readFileSync('worker/index.ts', 'utf8');

    expect(worker).toContain('Missing Access identity');
    expect(worker).toContain('Invalid Access identity');
    expect(worker).toContain('env.ASSETS.fetch(request)');
  });
});
