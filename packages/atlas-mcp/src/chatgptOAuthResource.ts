import { createPublicKey, verify as verifySignature, type JsonWebKey } from 'node:crypto';
import type { VerifiedChatGptPrincipal, VerifyChatGptAccessToken } from './chatgptReadOnlyAdapter';

export interface AtlasJwtClaims {
  iss?: unknown; aud?: unknown; sub?: unknown; exp?: unknown; nbf?: unknown;
  iat?: unknown; jti?: unknown; scope?: unknown; tenant_id?: unknown; organization_id?: unknown;
}
export interface AtlasOAuthVerifierOptions {
  issuer: string;
  audience: string;
  /** Trusted JWKS provider. Fetch only from a preconfigured trusted issuer endpoint. */
  getJwks: () => Promise<{ keys: Array<JsonWebKey & { kid?: string; alg?: string; use?: string }> }>;
  /** Mandatory server-side session/tenant membership and revocation lookup. */
  resolveIdentity: (claims: AtlasJwtClaims) => Promise<{ tenantId: string; organizationId: string; active: boolean } | null>;
  /** Mandatory revocation check. Fail closed on errors. */
  isRevoked: (jti: string, subject: string) => Promise<boolean>;
  /** Optional one-time token-use guard; only enable when issuer issues one-use tokens. */
  rejectReplay?: (jti: string, expiresAt: number) => Promise<boolean>;
  nowSeconds?: () => number;
}
const decode = (segment: string): Record<string, unknown> | null => {
  try {
    const value = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
};
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
export function createAtlasJwtVerifier(options: AtlasOAuthVerifierOptions): VerifyChatGptAccessToken {
  return async (token) => {
    try {
      if (!/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(token) || token.length > 16384) return null;
      const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
      const header = decode(encodedHeader);
      const claims = decode(encodedPayload) as AtlasJwtClaims | null;
      if (!header || !claims || header.alg !== 'RS256' || !str(header.kid) || header.typ && header.typ !== 'at+jwt' && header.typ !== 'JWT') return null;
      const jwks = await options.getJwks();
      if (!Array.isArray(jwks?.keys)) return null;
      const matches = jwks.keys.filter(k => k.kid === header.kid && k.kty === 'RSA' && (!k.alg || k.alg === 'RS256') && (!k.use || k.use === 'sig'));
      if (matches.length !== 1) return null;
      const key = createPublicKey({ key: matches[0], format: 'jwk' });
      const signature = Buffer.from(encodedSignature, 'base64url');
      if (!verifySignature('RSA-SHA256', Buffer.from(encodedHeader + '.' + encodedPayload), key, signature)) return null;
      const now = options.nowSeconds?.() ?? Math.floor(Date.now() / 1000);
      if (claims.iss !== options.issuer || !str(claims.sub) || !str(claims.jti) ||
          !(claims.aud === options.audience || Array.isArray(claims.aud) && claims.aud.includes(options.audience)) ||
          typeof claims.exp !== 'number' || !Number.isSafeInteger(claims.exp) || claims.exp <= now ||
          typeof claims.nbf !== 'number' || !Number.isSafeInteger(claims.nbf) || claims.nbf > now ||
          typeof claims.iat !== 'number' || !Number.isSafeInteger(claims.iat) || claims.iat > now ||
          claims.iat > claims.exp) return null;
      const scopes = str(claims.scope) ? claims.scope.split(' ').filter(Boolean) : [];
      if (!scopes.includes('atlas:apps:read')) return null;
      const identity = await options.resolveIdentity(claims);
      if (!identity?.active || !str(identity.tenantId) || !str(identity.organizationId)) return null;
      if (await options.isRevoked(claims.jti, claims.sub)) return null;
      if (options.rejectReplay && await options.rejectReplay(claims.jti, claims.exp)) return null;
      return { subject: claims.sub, tenantId: identity.tenantId, organizationId: identity.organizationId,
        scopes, issuer: options.issuer, audience: options.audience, expiresAt: claims.exp, revoked: false } satisfies VerifiedChatGptPrincipal;
    } catch { return null; }
  };
}
export function atlasProtectedResourceMetadata(resource: string, issuer: string) {
  const a = new URL(resource); const b = new URL(issuer);
  if (a.protocol !== 'https:' || b.protocol !== 'https:' || a.username || a.password || b.username || b.password || a.hash || b.hash) throw new Error('HTTPS resource and issuer required');
  return { resource: a.href.replace(/\/$/, ''), authorization_servers: [b.href.replace(/\/$/, '')], scopes_supported: ['atlas:apps:read'] };
}
