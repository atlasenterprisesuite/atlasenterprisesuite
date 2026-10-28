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
  /** Mandatory server-side membership lookup by signed subject and token id only.
   * Never trust tenant_id or organization_id from JWT claims for authorization.
   */
  resolveIdentity: (subject: string, tokenId: string) => Promise<{ tenantId: string; organizationId: string; active: boolean } | null>;
  /** Mandatory revocation check. Fail closed on errors. */
  isRevoked: (jti: string, subject: string) => Promise<boolean>;
  /** Optional one-time token-use guard; only enable when issuer issues one-use tokens. */
  rejectReplay?: (jti: string, expiresAt: number) => Promise<boolean>;
  nowSeconds?: () => number;
}
const base64UrlBytes = (segment: string): Uint8Array => {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
};
const decode = (segment: string): Record<string, unknown> | null => {
  try {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(base64UrlBytes(segment)));
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
      const key = await crypto.subtle.importKey(
        'jwk', matches[0], { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
      );
      // Copy into an ArrayBuffer-backed view required by WebCrypto's BufferSource type.
      const decodedSignature = base64UrlBytes(encodedSignature);
      const signature = new Uint8Array(new ArrayBuffer(decodedSignature.byteLength));
      signature.set(decodedSignature);
      const signingInput = new TextEncoder().encode(encodedHeader + '.' + encodedPayload);
      if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signingInput)) return null;
      const now = options.nowSeconds?.() ?? Math.floor(Date.now() / 1000);
      if (claims.iss !== options.issuer || !str(claims.sub) || !str(claims.jti) ||
          !(claims.aud === options.audience || Array.isArray(claims.aud) && claims.aud.includes(options.audience)) ||
          typeof claims.exp !== 'number' || !Number.isSafeInteger(claims.exp) || claims.exp <= now ||
          typeof claims.nbf !== 'number' || !Number.isSafeInteger(claims.nbf) || claims.nbf > now ||
          typeof claims.iat !== 'number' || !Number.isSafeInteger(claims.iat) || claims.iat > now ||
          claims.iat > claims.exp) return null;
      const scopes = str(claims.scope) ? claims.scope.split(' ').filter(Boolean) : [];
      if (!scopes.includes('atlas:apps:read')) return null;
      const identity = await options.resolveIdentity(claims.sub, claims.jti);
      if (identity?.active !== true || !str(identity.tenantId) || !str(identity.organizationId)) return null;
      if (await options.isRevoked(claims.jti, claims.sub) !== false) return null;
      if (options.rejectReplay && await options.rejectReplay(claims.jti, claims.exp) !== false) return null;
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
