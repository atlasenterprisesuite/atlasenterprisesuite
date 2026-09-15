import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import worker from '../../worker/index';

const ACCESS_AUD = 'fccf9afb05c59c6e1edf08f1aab547f259627d6783f27dafbae366230e203835';
const TEAM_ORIGIN = 'https://winder-aranguren.cloudflareaccess.com';
const JWKS_URL = `${TEAM_ORIGIN}/cdn-cgi/access/certs`;
const wrangler = readFileSync('wrangler.jsonc', 'utf8');

let privateKey: CryptoKey;
let publicJwk: JsonWebKey;

beforeAll(async () => {
  const keyPair = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['sign', 'verify']
  )) as CryptoKeyPair;

  privateKey = keyPair.privateKey;
  publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  publicJwk.kid = 'atlas-test-key';
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function makeToken(
  payloadOverrides: Record<string, unknown> = {},
  headerOverrides: Record<string, unknown> = {}
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: 'atlas-test-key',
    ...headerOverrides
  };
  const payload = {
    iss: TEAM_ORIGIN,
    aud: ACCESS_AUD,
    email: 'admin@example.com',
    nbf: now - 30,
    exp: now + 300,
    ...payloadOverrides
  };
  const signingInput = `${encodeJson(header)}.${encodeJson(payload)}`;
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${Buffer.from(signature).toString('base64url')}`;
}

function stubJwks(kid = 'atlas-test-key'): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url !== JWKS_URL) {
      throw new Error(`Unexpected fetch: ${url}`);
    }
    return Response.json({ keys: [{ ...publicJwk, kid }] });
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function createEnv() {
  const assetFetch = vi.fn(async () => new Response('ATLAS asset', { status: 200 }));
  return {
    env: { ASSETS: { fetch: assetFetch } },
    assetFetch
  };
}

describe('Cloudflare Access Worker gateway contract', () => {
  it('routes every request through the Worker before static assets', () => {
    expect(wrangler).toContain('"main": "worker/index.ts"');
    expect(wrangler).toContain('"binding": "ASSETS"');
    expect(wrangler).toContain('"run_worker_first": true');
  });

  it('rejects a request with no Access assertion before serving assets', async () => {
    const { env, assetFetch } = createEnv();

    const response = await worker.fetch(new Request('https://atlas.example/'), env);

    expect(response.status).toBe(401);
    expect(await response.text()).toBe('Missing Access identity');
    expect(assetFetch).not.toHaveBeenCalled();
  });

  it('rejects a correctly signed assertion for a different audience', async () => {
    stubJwks();
    const token = await makeToken({ aud: 'different-application' });
    const { env, assetFetch } = createEnv();

    const response = await worker.fetch(
      new Request('https://atlas.example/', {
        headers: { 'CF-Access-Jwt-Assertion': token }
      }),
      env
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Invalid Access identity');
    expect(assetFetch).not.toHaveBeenCalled();
  });

  it('rejects an expired Access assertion', async () => {
    stubJwks();
    const token = await makeToken({ exp: Math.floor(Date.now() / 1000) - 1 });
    const { env, assetFetch } = createEnv();

    const response = await worker.fetch(
      new Request('https://atlas.example/', {
        headers: { 'CF-Access-Jwt-Assertion': token }
      }),
      env
    );

    expect(response.status).toBe(403);
    expect(assetFetch).not.toHaveBeenCalled();
  });

  it('serves static assets only after signature and claims validation succeed', async () => {
    stubJwks();
    const token = await makeToken();
    const { env, assetFetch } = createEnv();
    const request = new Request('https://atlas.example/app', {
      headers: { 'CF-Access-Jwt-Assertion': token }
    });

    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ATLAS asset');
    expect(assetFetch).toHaveBeenCalledOnce();
    expect(assetFetch).toHaveBeenCalledWith(request);
  });

  it('reuses a recently validated signing key instead of fetching JWKS for every asset', async () => {
    const cacheKid = 'atlas-cache-key';
    const fetchMock = stubJwks(cacheKid);
    const token = await makeToken({}, { kid: cacheKid });
    const first = createEnv();
    const second = createEnv();

    const firstResponse = await worker.fetch(
      new Request('https://atlas.example/assets/app.js', {
        headers: { 'CF-Access-Jwt-Assertion': token }
      }),
      first.env
    );
    const secondResponse = await worker.fetch(
      new Request('https://atlas.example/assets/app.css', {
        headers: { 'CF-Access-Jwt-Assertion': token }
      }),
      second.env
    );

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.assetFetch).toHaveBeenCalledOnce();
    expect(second.assetFetch).toHaveBeenCalledOnce();
  });
});
