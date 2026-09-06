import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const REPO = 'atlasenterprisesuite/atlasenterprisesuite';
const OWNER = 'atlasenterprisesuite';
const WORKFLOW = `${REPO}/.github/workflows/production-deploy.yml@refs/heads/main`;
const AUDIENCE = 'atlas-infrastructure-evidence';
const VERSION = 1;

const baseHeaders = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: baseHeaders });

function b64u(input: string) {
  let value = input.replace(/-/g, '+').replace(/_/g, '/');
  while (value.length % 4) value += '=';
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

function decodePart(input: string) {
  return JSON.parse(new TextDecoder().decode(b64u(input)));
}

let jwksCache: { until: number; keys: JsonWebKey[] } | null = null;

async function githubKeys() {
  if (jwksCache && jwksCache.until > Date.now()) return jwksCache.keys;
  const config = await fetch('https://token.actions.githubusercontent.com/.well-known/openid-configuration', { cache: 'no-store' }).then((r) => r.json());
  const data = await fetch(config.jwks_uri, { cache: 'no-store' }).then((r) => r.json());
  const keys = Array.isArray(data?.keys) ? data.keys : [];
  jwksCache = { until: Date.now() + 10 * 60 * 1000, keys };
  return keys;
}

async function verifyGitHubOIDC(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false as const, status: 401, error: 'github_oidc_required' };

  let header: any;
  let payload: any;
  try {
    header = decodePart(parts[0]);
    payload = decodePart(parts[1]);
  } catch {
    return { ok: false as const, status: 401, error: 'invalid_github_oidc' };
  }

  if (header.alg !== 'RS256' || !header.kid) return { ok: false as const, status: 401, error: 'unsupported_github_oidc' };
  const jwk = (await githubKeys()).find((key: any) => key.kid === header.kid);
  if (!jwk) return { ok: false as const, status: 401, error: 'github_oidc_key_not_found' };

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const validSignature = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64u(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (
    !validSignature ||
    payload.iss !== 'https://token.actions.githubusercontent.com' ||
    !audiences.includes(AUDIENCE) ||
    Number(payload.exp || 0) <= now ||
    Number(payload.nbf || 0) > now + 30
  ) return { ok: false as const, status: 401, error: 'github_oidc_verification_failed' };

  if (
    payload.repository !== REPO ||
    payload.repository_owner !== OWNER ||
    payload.ref !== 'refs/heads/main' ||
    payload.workflow_ref !== WORKFLOW
  ) return { ok: false as const, status: 403, error: 'github_oidc_scope_denied' };

  return { ok: true as const, claims: payload };
}

function safeObject(value: unknown, maxBytes = 12000) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const serialized = JSON.stringify(value);
  if (serialized.length > maxBytes) throw new Error('evidence_payload_too_large');
  return value as Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const api = url.searchParams.get('api');

  if (req.method === 'GET' && api === 'readiness') {
    return json({
      ok: true,
      service: 'atlas-infra-evidence',
      version: VERSION,
      repository: REPO,
      workflow: WORKFLOW,
      auth: 'github-oidc',
      evidence_store: 'atlas_runtime_verification_runs',
    });
  }

  if (req.method !== 'POST' || api !== 'record') return json({ ok: false, error: 'not_found' }, 404);
  if (!SERVICE_ROLE) return json({ ok: false, error: 'service_role_not_configured' }, 503);

  const github = await verifyGitHubOIDC(req);
  if (!github.ok) return json({ ok: false, error: github.error }, github.status);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  try {
    const checks = safeObject(body?.checks);
    const suppliedMetadata = safeObject(body?.metadata, 8000);
    const completedAt = new Date().toISOString();
    const targetVersion = String(body?.target_version || github.claims.sha || '').slice(0, 100) || null;
    const durationMs = Number.isFinite(Number(body?.duration_ms)) && Number(body.duration_ms) >= 0 ? Math.floor(Number(body.duration_ms)) : null;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await admin
      .from('atlas_runtime_verification_runs')
      .insert({
        verification_type: 'infrastructure-deployment',
        target_service: 'atlas-enterprise-suite-web',
        target_version: targetVersion,
        environment: 'production',
        status: 'passed',
        started_at: completedAt,
        completed_at: completedAt,
        duration_ms: durationMs,
        trace_id: `github:${github.claims.run_id || 'unknown'}:${github.claims.run_attempt || '1'}`,
        provider: 'vercel',
        provider_state: 'verified',
        storage_state: 'configured',
        checks,
        metadata: {
          ...suppliedMetadata,
          source: 'github-actions-oidc',
          repository: REPO,
          workflow: WORKFLOW,
          run_id: github.claims.run_id || null,
          run_attempt: github.claims.run_attempt || null,
          actor: github.claims.actor || null,
          ref: github.claims.ref || null,
        },
      })
      .select('id,verification_type,target_service,target_version,status,provider,provider_state,created_at')
      .single();

    if (error) return json({ ok: false, error: 'evidence_persistence_failed' }, 500);
    return json({ ok: true, evidence: data }, 201);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'evidence_rejected' }, 400);
  }
});
