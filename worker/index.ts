const ACCESS_AUD = 'fccf9afb05c59c6e1edf08f1aab547f259627d6783f27dafbae366230e203835';
const TEAM_ORIGIN = 'https://winder-aranguren.cloudflareaccess.com';
const JWKS_URL = `${TEAM_ORIGIN}/cdn-cgi/access/certs`;
const KEY_CACHE_TTL_MS = 5 * 60 * 1000;

interface AssetsBinding {
  fetch(request: Request): Promise<Response> | Response;
}

interface Env {
  ASSETS: AssetsBinding;
}

interface JwtHeader {
  alg?: unknown;
  kid?: unknown;
}

interface JwtPayload {
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  nbf?: unknown;
}

interface JwkSet {
  keys?: JsonWebKey[];
}

interface CachedKey {
  key: CryptoKey;
  expiresAt: number;
}

const keyCache = new Map<string, CachedKey>();
const keyLoads = new Map<string, Promise<CryptoKey>>();

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function decodeJson<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
}

function audienceMatches(audience: unknown): boolean {
  if (typeof audience === 'string') {
    return audience === ACCESS_AUD;
  }

  return Array.isArray(audience) && audience.some((entry) => entry === ACCESS_AUD);
}

async function loadPublicKey(kid: string): Promise<CryptoKey> {
  const jwksResponse = await fetch(JWKS_URL, {
    headers: { accept: 'application/json' }
  });
  if (!jwksResponse.ok) {
    throw new Error('Unable to load Access signing keys');
  }

  const jwks = (await jwksResponse.json()) as JwkSet;
  const jwk = jwks.keys?.find(
    (candidate) =>
      candidate.kid === kid &&
      candidate.kty === 'RSA' &&
      (candidate.alg === undefined || candidate.alg === 'RS256') &&
      (candidate.use === undefined || candidate.use === 'sig')
  );

  if (!jwk) {
    throw new Error('Unknown signing key');
  }

  return crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['verify']
  );
}

async function getPublicKey(kid: string): Promise<CryptoKey> {
  const now = Date.now();
  const cached = keyCache.get(kid);
  if (cached && now < cached.expiresAt) {
    return cached.key;
  }
  if (cached) {
    keyCache.delete(kid);
  }

  const existingLoad = keyLoads.get(kid);
  if (existingLoad) {
    return existingLoad;
  }

  const load = loadPublicKey(kid).then((key) => {
    keyCache.set(kid, { key, expiresAt: Date.now() + KEY_CACHE_TTL_MS });
    return key;
  });
  keyLoads.set(kid, load);

  try {
    return await load;
  } finally {
    keyLoads.delete(kid);
  }
}

async function verifyAccessAssertion(token: string): Promise<void> {
  const segments = token.split('.');
  if (segments.length !== 3 || segments.some((segment) => segment.length === 0)) {
    throw new Error('Malformed JWT');
  }

  const [headerSegment, payloadSegment, signatureSegment] = segments;
  const header = decodeJson<JwtHeader>(headerSegment);
  const payload = decodeJson<JwtPayload>(payloadSegment);

  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length === 0) {
    throw new Error('Unsupported JWT header');
  }

  const publicKey = await getPublicKey(header.kid);
  const signingInput = new TextEncoder().encode(`${headerSegment}.${payloadSegment}`);
  const signature = decodeBase64Url(signatureSegment);
  const signatureValid = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    publicKey,
    signature,
    signingInput
  );

  if (!signatureValid) {
    throw new Error('Invalid signature');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== TEAM_ORIGIN || !audienceMatches(payload.aud)) {
    throw new Error('Invalid Access claims');
  }
  if (typeof payload.exp !== 'number' || now >= payload.exp) {
    throw new Error('Expired Access assertion');
  }
  if (payload.nbf !== undefined && (typeof payload.nbf !== 'number' || now < payload.nbf)) {
    throw new Error('Access assertion not active');
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const token = request.headers.get('CF-Access-Jwt-Assertion');

    if (!token) {
      return new Response('Missing Access identity', { status: 401 });
    }

    try {
      await verifyAccessAssertion(token);
    } catch {
      return new Response('Invalid Access identity', { status: 403 });
    }

    return env.ASSETS.fetch(request);
  }
};
