// Authenticated ingestion: GitHub Actions OIDC only (never browser tokens or shared API keys).
// JWT is intentionally verified in-function because GitHub OIDC is not a Supabase JWT.
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const ISSUER = 'https://token.actions.githubusercontent.com';
const AUDIENCE = 'atlas-certificate-monitor';
const REPOSITORY = 'atlasenterprisesuite/atlasenterprisesuite';
const WORKFLOW_REF = REPOSITORY + '/.github/workflows/certificate-monitor.yml@refs/heads/main';
const HOST = 'www.atlasenterprisesuite.com';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';

class Denied extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}
function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
}
function decodePart(part: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(part) || part.length > 12000) throw new Denied('invalid_oidc', 401);
  const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
function jsonPart(part: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(decodePart(part)));
}
async function trustedGithubClaims(req: Request) {
  const bearer = /^Bearer ([-\w.]+)$/i.exec(req.headers.get('authorization') || '');
  if (!bearer) throw new Denied('authentication_required', 401);
  const pieces = bearer[1].split('.');
  if (pieces.length !== 3) throw new Denied('invalid_oidc', 401);
  const header = jsonPart(pieces[0]);
  const claims = jsonPart(pieces[1]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.typ !== 'JWT') {
    throw new Denied('unsupported_oidc_algorithm', 401);
  }
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== ISSUER
    || (claims.aud !== AUDIENCE && !(Array.isArray(claims.aud) && claims.aud.includes(AUDIENCE)))
    || claims.repository !== REPOSITORY
    || claims.ref !== 'refs/heads/main'
    || claims.workflow_ref !== WORKFLOW_REF
    || !['schedule', 'workflow_dispatch'].includes(String(claims.event_name))
    || typeof claims.exp !== 'number' || claims.exp <= now
    || typeof claims.iat !== 'number' || claims.iat > now + 60
    || (typeof claims.nbf === 'number' && claims.nbf > now + 60)
    || !/^\d+$/.test(String(claims.run_id || ''))
    || !/^\d+$/.test(String(claims.run_attempt || ''))) {
    throw new Denied('oidc_claims_denied', 403);
  }
  const res = await fetch(ISSUER + '/.well-known/jwks', { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Denied('oidc_keys_unavailable', 503);
  const jwks = await res.json() as { keys?: Array<JsonWebKey & { kid?: string; alg?: string; use?: string }> };
  const jwk = jwks.keys?.find((key) => key.kid === header.kid && key.kty === 'RSA' && key.use === 'sig');
  if (!jwk) throw new Denied('oidc_key_unrecognized', 401);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, decodePart(pieces[2]),
    new TextEncoder().encode(pieces[0] + '.' + pieces[1])
  );
  if (!verified) throw new Denied('oidc_signature_invalid', 401);
  return claims;
}
async function digestHex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((v) => v.toString(16).padStart(2, '0')).join('');
}
function limited(value: unknown, max = 512) {
  return typeof value === 'string' ? value.slice(0, max) : null;
}
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return response({ ok: false, error: 'method_not_allowed' }, 405);
  try {
    if (!SERVICE_KEY || !SUPABASE_URL) throw new Denied('server_not_configured', 503);
    const claims = await trustedGithubClaims(req);
    const raw = await req.text();
    if (raw.length > 8192) throw new Denied('payload_too_large', 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (body.hostname !== HOST || body.port !== 443
        || !['verified_tls', 'tls_failure'].includes(String(body.observation_status))) {
      throw new Denied('unapproved_target', 422);
    }
    const successful = body.observation_status === 'verified_tls';
    const observedAt = Date.parse(String(body.observed_at || ''));
    if (!Number.isFinite(observedAt) || Math.abs(Date.now() - observedAt) > 5 * 60 * 1000) {
      throw new Denied('stale_observation', 422);
    }
    const fingerprint = limited(body.certificate_sha256, 64);
    const notBefore = typeof body.not_before === 'string' ? body.not_before : null;
    const notAfter = typeof body.not_after === 'string' ? body.not_after : null;
    if (successful && (!body.hostname_verified || !body.chain_verified
        || !fingerprint?.match(/^[a-f0-9]{64}$/)
        || !notBefore || !notAfter || Date.parse(notAfter) <= observedAt)) {
      throw new Denied('invalid_verified_evidence', 422);
    }
    const client = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const organizations = await client.from('organizations').select('id').eq('name','ATLAS').eq('active',true).limit(2);
    if (organizations.error || organizations.data?.length !== 1) throw new Denied('organization_not_resolved', 503);
    const orgId = organizations.data[0].id;
    const query = await client.from('atlas_certificate_targets').select('id,org_id')
      .eq('org_id', orgId).eq('hostname', HOST).eq('port', 443)
      .eq('environment', 'production').eq('purpose', 'server_tls').eq('monitoring_approved', true).limit(2);
    if (query.error || query.data?.length !== 1) throw new Denied('target_not_approved', 403);
    const targetId = query.data[0].id;
    const evidenceRef = `github-actions:${REPOSITORY}:${claims.run_id}:${claims.run_attempt}`;
    const evidenceSha = await digestHex(JSON.stringify({ ref: evidenceRef, targetId, body }));
    const record = {
      org_id: orgId, target_id: targetId, observed_at: new Date(observedAt).toISOString(),
      observation_status: body.observation_status, source: 'github_actions_oidc',
      certificate_sha256: successful ? fingerprint : null,
      certificate_subject: successful ? limited(body.certificate_subject) : null,
      certificate_issuer: successful ? limited(body.certificate_issuer) : null,
      not_before: successful ? new Date(notBefore!).toISOString() : null,
      not_after: successful ? new Date(notAfter!).toISOString() : null,
      tls_protocol: successful ? limited(body.tls_protocol, 40) : null,
      hostname_verified: successful, chain_verified: successful, mtls_verified: false,
      evidence_sha256: evidenceSha, evidence_ref: evidenceRef
    };
    const insert = await client.from('atlas_certificate_observations').insert(record).select('id').single();
    if (insert.error) throw new Denied('evidence_persistence_failed', 502);
    return response({ ok: true, evidence_id: insert.data.id, observation_status: body.observation_status });
  } catch (error) {
    return response({ ok: false, error: error instanceof Denied ? error.code : 'invalid_request' },
      error instanceof Denied ? error.status : 400);
  }
});
