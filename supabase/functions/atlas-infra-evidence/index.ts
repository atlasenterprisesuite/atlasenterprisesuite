import { createClient } from 'npm:@supabase/supabase-js@2';
import { createGitHubOidcScope } from '../_shared/github-oidc-scope.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const GITHUB_SCOPE = createGitHubOidcScope([
  'production-deploy.yml',
  'cloudflare-deploy.yml'
]);
const REPO = GITHUB_SCOPE.canonicalRepository;
const AUDIENCE = 'atlas-infrastructure-evidence';
const VERSION = 4;

const ALLOWED_WORKFLOWS = GITHUB_SCOPE.workflowRefs;
const ALLOWED_PROVIDERS = new Set(['github', 'supabase', 'cloudflare', 'vercel']);
const ALLOWED_STATUSES = new Set([
  'passed',
  'failed',
  'blocked',
  'blocked_by_edge_challenge'
]);
const ALLOWED_VERIFICATION_TYPES = new Set([
  'infrastructure-deployment',
  'infrastructure-control',
  'public-edge-verification'
]);

const baseHeaders = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer'
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: baseHeaders });

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

  const config = await fetch(
    'https://token.actions.githubusercontent.com/.well-known/openid-configuration',
    { cache: 'no-store' }
  ).then((response) => response.json());
  const data = await fetch(config.jwks_uri, { cache: 'no-store' }).then((response) =>
    response.json()
  );
  const keys = Array.isArray(data?.keys) ? data.keys : [];
  jwksCache = { until: Date.now() + 10 * 60 * 1000, keys };
  return keys;
}

async function verifyGitHubOIDC(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false as const, status: 401, error: 'github_oidc_required' };
  }

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = decodePart(parts[0]);
    payload = decodePart(parts[1]);
  } catch {
    return { ok: false as const, status: 401, error: 'invalid_github_oidc' };
  }

  if (header.alg !== 'RS256' || !header.kid) {
    return { ok: false as const, status: 401, error: 'unsupported_github_oidc' };
  }

  const jwk = (await githubKeys()).find(
    (candidate: JsonWebKey & { kid?: string }) => candidate.kid === header.kid
  );
  if (!jwk) {
    return { ok: false as const, status: 401, error: 'github_oidc_key_not_found' };
  }

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const validSignature = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64u(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (
    !validSignature ||
    payload.iss !== 'https://token.actions.githubusercontent.com' ||
    !audiences.includes(AUDIENCE) ||
    Number(payload.exp || 0) <= now ||
    Number(payload.nbf || 0) > now + 30
  ) {
    return { ok: false as const, status: 401, error: 'github_oidc_verification_failed' };
  }

  if (
    !GITHUB_SCOPE.allowsRepository(payload.repository, payload.repository_owner) ||
    payload.ref !== 'refs/heads/main' ||
    !ALLOWED_WORKFLOWS.has(String(payload.workflow_ref || ''))
  ) {
    return { ok: false as const, status: 403, error: 'github_oidc_scope_denied' };
  }

  return { ok: true as const, claims: payload };
}

function safeObject(value: unknown, maxBytes = 12000) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const serialized = JSON.stringify(value);
  if (serialized.length > maxBytes) throw new Error('evidence_payload_too_large');
  return value as Record<string, unknown>;
}

function safeString(value: unknown, maxLength = 1000) {
  if (value === null || value === undefined || value === '') return null;
  return String(value)
    .slice(0, maxLength)
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/(?:sk-|sb_secret_)[A-Za-z0-9_-]+/gi, '[REDACTED]')
    .replace(/(password|api[_-]?key|token)\s*[:=]\s*[^,;\s]+/gi, '$1=[REDACTED]');
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
      workflows: [...ALLOWED_WORKFLOWS],
      auth: 'github-oidc',
      evidence_store: 'atlas_runtime_verification_runs',
      providers: [...ALLOWED_PROVIDERS],
      statuses: [...ALLOWED_STATUSES],
      verification_types: [...ALLOWED_VERIFICATION_TYPES]
    });
  }

  if (req.method !== 'POST' || api !== 'record') {
    return json({ ok: false, error: 'not_found' }, 404);
  }
  if (!SERVICE_ROLE) {
    return json({ ok: false, error: 'service_role_not_configured' }, 503);
  }

  const github = await verifyGitHubOIDC(req);
  if (!github.ok) {
    return json({ ok: false, error: github.error }, github.status);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  try {
    const provider = String(body.provider || '').toLowerCase();
    const status = String(body.status || '').toLowerCase();
    const verificationType = String(body.verification_type || '').toLowerCase();
    const targetService = safeString(body.target_service, 120);

    if (!ALLOWED_PROVIDERS.has(provider)) {
      return json({ ok: false, error: 'invalid_provider' }, 400);
    }
    if (!ALLOWED_STATUSES.has(status)) {
      return json({ ok: false, error: 'invalid_status' }, 400);
    }
    if (!ALLOWED_VERIFICATION_TYPES.has(verificationType)) {
      return json({ ok: false, error: 'invalid_verification_type' }, 400);
    }
    if (!targetService) {
      return json({ ok: false, error: 'target_service_required' }, 400);
    }

    const checks = safeObject(body.checks);
    const suppliedMetadata = safeObject(body.metadata, 8000);
    const completedAt = new Date().toISOString();
    const targetVersion =
      safeString(body.target_version || github.claims.sha, 100) || null;
    const durationMs =
      Number.isFinite(Number(body.duration_ms)) && Number(body.duration_ms) >= 0
        ? Math.floor(Number(body.duration_ms))
        : null;
    const providerState = safeString(body.provider_state, 120);
    const storageState = safeString(body.storage_state, 120);
    const errorCode = safeString(body.error_code, 120);
    const errorDetail = safeString(body.error_detail, 1000);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data, error } = await admin
      .from('atlas_runtime_verification_runs')
      .insert({
        verification_type: verificationType,
        target_service: targetService,
        target_version: targetVersion,
        environment: 'production',
        status,
        started_at: completedAt,
        completed_at: completedAt,
        duration_ms: durationMs,
        trace_id: `github:${github.claims.run_id || 'unknown'}:${github.claims.run_attempt || '1'}`,
        provider,
        provider_state: providerState,
        storage_state: storageState,
        error_code: errorCode,
        error_detail: errorDetail,
        checks,
        metadata: {
          ...suppliedMetadata,
          source: 'github-actions-oidc',
          repository: REPO,
          workflow: github.claims.workflow_ref || null,
          run_id: github.claims.run_id || null,
          run_attempt: github.claims.run_attempt || null,
          actor: github.claims.actor || null,
          ref: github.claims.ref || null
        }
      })
      .select(
        'id,verification_type,target_service,target_version,status,provider,provider_state,created_at'
      )
      .single();

    if (error) {
      return json({ ok: false, error: 'evidence_persistence_failed' }, 500);
    }

    return json({ ok: true, evidence: data }, 201);
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'evidence_rejected'
      },
      400
    );
  }
});
