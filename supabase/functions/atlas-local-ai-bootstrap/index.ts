import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const REPO = 'atlasenterprisesuite/atlasenterprisesuite';
const OWNER = 'atlasenterprisesuite';
const AUDIENCE = 'atlas-local-ai-bootstrap';
const WORKFLOW_REF = `${REPO}/.github/workflows/atlas-local-ai-bootstrap.yml@refs/heads/main`;
const HOSTNAME = 'local-ai.atlasenterprisesuite.com';
const ZONE_NAME = 'atlasenterprisesuite.com';
const TUNNEL_NAME = 'atlas-local-ai-runtime';
const ACCESS_APP_NAME = 'ATLAS Local AI Runtime';
const ACCESS_TOKEN_NAME = 'ATLAS Local AI Service Auth';
const MODEL_HF_REPO = 'ggml-org/Qwen3.5-0.8B-GGUF:Q4_0';
const MODEL_ALIAS = 'atlas-local-default';
const LOCAL_CONTEXT = 8192;
const VERSION = 1;

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: HEADERS });

function b64u(input: string) {
  let value = input.replace(/-/g, '+').replace(/_/g, '/');
  while (value.length % 4) value += '=';
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

function decodePart(input: string) {
  return JSON.parse(new TextDecoder().decode(b64u(input)));
}

function randomSecret(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return btoa(String.fromCharCode(...value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

let jwksCache: { until: number; keys: Array<JsonWebKey & { kid?: string }> } | null = null;

async function githubKeys() {
  if (jwksCache && jwksCache.until > Date.now()) return jwksCache.keys;
  const configuration = await fetch(
    'https://token.actions.githubusercontent.com/.well-known/openid-configuration',
    { cache: 'no-store' },
  ).then((response) => response.json());
  const data = await fetch(configuration.jwks_uri, { cache: 'no-store' }).then((response) => response.json());
  const keys = Array.isArray(data?.keys) ? data.keys : [];
  jwksCache = { until: Date.now() + 10 * 60 * 1000, keys };
  return keys;
}

async function verifyGitHubOIDC(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false as const, status: 401, error: 'github_oidc_required' };

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

  const jwk = (await githubKeys()).find((candidate) => candidate.kid === header.kid);
  if (!jwk) return { ok: false as const, status: 401, error: 'github_oidc_key_not_found' };

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const signatureOk = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64u(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const workflowRef = String(payload.workflow_ref || '');
  const jobWorkflowRef = String(payload.job_workflow_ref || '');
  if (
    !signatureOk ||
    payload.iss !== 'https://token.actions.githubusercontent.com' ||
    !audiences.includes(AUDIENCE) ||
    Number(payload.exp || 0) <= now ||
    Number(payload.nbf || 0) > now + 30 ||
    payload.repository !== REPO ||
    payload.repository_owner !== OWNER ||
    payload.ref !== 'refs/heads/main' ||
    (workflowRef !== WORKFLOW_REF && jobWorkflowRef !== WORKFLOW_REF)
  ) {
    return { ok: false as const, status: 403, error: 'github_oidc_scope_denied' };
  }

  return {
    ok: true as const,
    claims: {
      sha: String(payload.sha || ''),
      run_id: String(payload.run_id || ''),
      run_attempt: String(payload.run_attempt || ''),
      actor: String(payload.actor || ''),
      workflow_ref: workflowRef,
      job_workflow_ref: jobWorkflowRef,
    },
  };
}

function adminClient() {
  if (!SERVICE_ROLE) throw Object.assign(new Error('service_role_not_configured'), { status: 503 });
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function cf(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  const error = Array.isArray(body?.errors) && body.errors[0]
    ? String(body.errors[0]?.message || body.errors[0]?.code || 'cloudflare_error')
    : null;
  return {
    ok: response.ok && body?.success !== false,
    status: response.status,
    result: body?.result,
    error,
  };
}

async function localConfig(admin: ReturnType<typeof createClient>) {
  const { data, error } = await admin.rpc('atlas_get_local_ai_runtime_config');
  if (error) throw Object.assign(new Error('local_ai_runtime_config_unavailable'), { status: 503 });
  return data && typeof data === 'object' ? data : {};
}

async function cloudflareControl(admin: ReturnType<typeof createClient>) {
  const { data, error } = await admin.rpc('atlas_get_cloudflare_control_credentials');
  if (error || !data?.api_token) {
    throw Object.assign(new Error('cloudflare_control_credentials_unavailable'), { status: 503 });
  }
  return {
    token: String(data.api_token),
    accountId: String(data.account_id || ''),
    zoneId: String(data.zone_id || ''),
  };
}

async function resolveCloudflareScope(token: string, accountId: string, zoneId: string) {
  let account = accountId;
  let zone = zoneId;
  if (!zone || !account) {
    const zones = await cf(token, `/zones?name=${encodeURIComponent(ZONE_NAME)}&per_page=1`);
    if (!zones.ok || !Array.isArray(zones.result) || !zones.result[0]) {
      throw Object.assign(new Error('cloudflare_zone_unresolved'), { status: 409 });
    }
    zone = String(zones.result[0].id || zone);
    account = String(zones.result[0].account?.id || account);
  }
  if (!zone || !account) throw Object.assign(new Error('cloudflare_scope_unresolved'), { status: 409 });
  return { accountId: account, zoneId: zone };
}

async function ensureTunnel(token: string, accountId: string) {
  const listed = await cf(
    token,
    `/accounts/${encodeURIComponent(accountId)}/cfd_tunnel?name=${encodeURIComponent(TUNNEL_NAME)}&is_deleted=false&per_page=100`,
  );
  if (!listed.ok) throw Object.assign(new Error('cloudflare_tunnel_read_denied'), { status: 409 });

  let tunnel = Array.isArray(listed.result)
    ? listed.result.find((item: any) => String(item?.name || '') === TUNNEL_NAME)
    : null;

  if (!tunnel) {
    const tunnelSecret = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    const created = await cf(token, `/accounts/${encodeURIComponent(accountId)}/cfd_tunnel`, {
      method: 'POST',
      body: JSON.stringify({
        name: TUNNEL_NAME,
        config_src: 'cloudflare',
        tunnel_secret: tunnelSecret,
      }),
    });
    if (!created.ok || !created.result?.id) {
      throw Object.assign(new Error('cloudflare_tunnel_create_denied'), { status: 409 });
    }
    tunnel = created.result;
  }

  const tunnelId = String(tunnel.id);
  const configured = await cf(
    token,
    `/accounts/${encodeURIComponent(accountId)}/cfd_tunnel/${encodeURIComponent(tunnelId)}/configurations`,
    {
      method: 'PUT',
      body: JSON.stringify({
        config: {
          ingress: [
            { hostname: HOSTNAME, service: 'http://127.0.0.1:8080' },
            { service: 'http_status:404' },
          ],
          'warp-routing': { enabled: false },
        },
      }),
    },
  );
  if (!configured.ok) throw Object.assign(new Error('cloudflare_tunnel_config_denied'), { status: 409 });

  const tokenResult = await cf(
    token,
    `/accounts/${encodeURIComponent(accountId)}/cfd_tunnel/${encodeURIComponent(tunnelId)}/token`,
  );
  if (!tokenResult.ok || !tokenResult.result) {
    throw Object.assign(new Error('cloudflare_tunnel_token_denied'), { status: 409 });
  }

  return { id: tunnelId, token: String(tokenResult.result) };
}

async function ensureDns(token: string, zoneId: string, tunnelId: string) {
  const target = `${tunnelId}.cfargotunnel.com`;
  const listed = await cf(
    token,
    `/zones/${encodeURIComponent(zoneId)}/dns_records?type=CNAME&name=${encodeURIComponent(HOSTNAME)}&per_page=10`,
  );
  if (!listed.ok) throw Object.assign(new Error('cloudflare_dns_read_denied'), { status: 409 });

  const existing = Array.isArray(listed.result) ? listed.result[0] : null;
  if (!existing) {
    const created = await cf(token, `/zones/${encodeURIComponent(zoneId)}/dns_records`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'CNAME',
        name: HOSTNAME,
        content: target,
        proxied: true,
        ttl: 1,
        comment: 'ATLAS Local AI private inference tunnel',
      }),
    });
    if (!created.ok) throw Object.assign(new Error('cloudflare_dns_create_denied'), { status: 409 });
    return;
  }

  if (String(existing.content || '') !== target || existing.proxied !== true) {
    const updated = await cf(
      token,
      `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(String(existing.id))}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ content: target, proxied: true, ttl: 1 }),
      },
    );
    if (!updated.ok) throw Object.assign(new Error('cloudflare_dns_update_denied'), { status: 409 });
  }
}

async function ensureAccess(
  token: string,
  accountId: string,
  existingConfig: Record<string, any>,
) {
  const apps = await cf(token, `/accounts/${encodeURIComponent(accountId)}/access/apps?per_page=100`);
  if (!apps.ok) throw Object.assign(new Error('cloudflare_access_apps_read_denied'), { status: 409 });

  let app = Array.isArray(apps.result)
    ? apps.result.find((item: any) => String(item?.domain || '').toLowerCase() === HOSTNAME)
    : null;

  if (!app) {
    const created = await cf(token, `/accounts/${encodeURIComponent(accountId)}/access/apps`, {
      method: 'POST',
      body: JSON.stringify({
        name: ACCESS_APP_NAME,
        domain: HOSTNAME,
        type: 'self_hosted',
        app_launcher_visible: false,
        service_auth_401_redirect: true,
        session_duration: '24h',
        destinations: [{ type: 'public', uri: HOSTNAME }],
      }),
    });
    if (!created.ok || !created.result?.id) {
      throw Object.assign(new Error('cloudflare_access_app_create_denied'), { status: 409 });
    }
    app = created.result;
  }

  const listedTokens = await cf(
    token,
    `/accounts/${encodeURIComponent(accountId)}/access/service_tokens?per_page=100`,
  );
  if (!listedTokens.ok) throw Object.assign(new Error('cloudflare_access_token_read_denied'), { status: 409 });

  let serviceToken = Array.isArray(listedTokens.result)
    ? listedTokens.result.find((item: any) => String(item?.name || '') === ACCESS_TOKEN_NAME)
    : null;

  let clientId = String(existingConfig?.access_client_id || '');
  let clientSecret = String(existingConfig?.access_client_secret || '');
  const savedTokenId = String(existingConfig?.access_service_token_id || '');

  if (
    serviceToken &&
    savedTokenId === String(serviceToken.id || '') &&
    clientId &&
    clientSecret
  ) {
    // Reuse the one-time secret from ATLAS Vault.
  } else {
    if (serviceToken?.id) {
      await cf(
        token,
        `/accounts/${encodeURIComponent(accountId)}/access/service_tokens/${encodeURIComponent(String(serviceToken.id))}`,
        { method: 'DELETE' },
      );
    }
    const created = await cf(token, `/accounts/${encodeURIComponent(accountId)}/access/service_tokens`, {
      method: 'POST',
      body: JSON.stringify({ name: ACCESS_TOKEN_NAME, duration: '8760h', enabled: true }),
    });
    if (
      !created.ok ||
      !created.result?.id ||
      !created.result?.client_id ||
      !created.result?.client_secret
    ) {
      throw Object.assign(new Error('cloudflare_access_token_create_denied'), { status: 409 });
    }
    serviceToken = created.result;
    clientId = String(created.result.client_id);
    clientSecret = String(created.result.client_secret);
  }

  const policies = await cf(
    token,
    `/accounts/${encodeURIComponent(accountId)}/access/apps/${encodeURIComponent(String(app.id))}/policies?per_page=100`,
  );
  if (!policies.ok) throw Object.assign(new Error('cloudflare_access_policy_read_denied'), { status: 409 });

  const desired = {
    name: 'ATLAS Local AI Service Auth',
    decision: 'non_identity',
    include: [{ service_token: { token_id: String(serviceToken.id) } }],
    precedence: 1,
  };
  const current = Array.isArray(policies.result)
    ? policies.result.find((item: any) => String(item?.name || '') === desired.name)
    : null;

  if (!current) {
    const created = await cf(
      token,
      `/accounts/${encodeURIComponent(accountId)}/access/apps/${encodeURIComponent(String(app.id))}/policies`,
      { method: 'POST', body: JSON.stringify(desired) },
    );
    if (!created.ok) throw Object.assign(new Error('cloudflare_access_policy_create_denied'), { status: 409 });
  } else {
    const currentToken = Array.isArray(current.include)
      ? current.include.find((rule: any) => rule?.service_token)?.service_token?.token_id
      : null;
    if (String(currentToken || '') !== String(serviceToken.id) || String(current.decision || '') !== 'non_identity') {
      const updated = await cf(
        token,
        `/accounts/${encodeURIComponent(accountId)}/access/apps/${encodeURIComponent(String(app.id))}/policies/${encodeURIComponent(String(current.id))}`,
        { method: 'PUT', body: JSON.stringify(desired) },
      );
      if (!updated.ok) throw Object.assign(new Error('cloudflare_access_policy_update_denied'), { status: 409 });
    }
  }

  return {
    clientId,
    clientSecret,
    serviceTokenId: String(serviceToken.id),
  };
}

async function issue(req: Request, caller: Awaited<ReturnType<typeof verifyGitHubOIDC>>) {
  if (!caller.ok) return json({ ok: false, error: caller.error }, caller.status);
  const admin = adminClient();
  const cfg = await localConfig(admin);
  const cloudflare = await cloudflareControl(admin);
  const scope = await resolveCloudflareScope(
    cloudflare.token,
    cloudflare.accountId,
    cloudflare.zoneId,
  );

  const tunnel = await ensureTunnel(cloudflare.token, scope.accountId);
  await ensureDns(cloudflare.token, scope.zoneId, tunnel.id);
  const access = await ensureAccess(cloudflare.token, scope.accountId, cfg);

  const runtimeToken = String(cfg?.runtime_token || '') || randomSecret(36);
  const { data: stored, error: storeError } = await admin.rpc(
    'atlas_store_local_ai_runtime_credentials',
    {
      p_runtime_token: runtimeToken,
      p_access_client_id: access.clientId,
      p_access_client_secret: access.clientSecret,
      p_access_service_token_id: access.serviceTokenId,
    },
  );
  if (storeError || stored !== true) {
    throw Object.assign(new Error('local_ai_vault_store_failed'), { status: 500 });
  }

  const { error: registryError } = await admin.from('atlas_local_ai_runtimes').upsert({
    runtime_key: 'primary',
    provider_id: 'atlas-local',
    endpoint_url: `https://${HOSTNAME}`,
    model_id: MODEL_ALIAS,
    tunnel_id: tunnel.id,
    tunnel_hostname: HOSTNAME,
    status: 'provisioning',
    source: 'github-self-hosted',
    last_error_code: null,
    metadata: {
      bootstrap_version: VERSION,
      github_sha: caller.claims.sha,
      github_run_id: caller.claims.run_id,
      model_hf_repo: MODEL_HF_REPO,
      context_size: LOCAL_CONTEXT,
    },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'runtime_key' });

  if (registryError) throw Object.assign(new Error('local_ai_registry_update_failed'), { status: 500 });

  return json({
    ok: true,
    state: 'provisioning',
    endpoint_url: `https://${HOSTNAME}`,
    model_alias: MODEL_ALIAS,
    model_hf_repo: MODEL_HF_REPO,
    context_size: LOCAL_CONTEXT,
    runtime_token: runtimeToken,
    tunnel_token: tunnel.token,
    tunnel_id: tunnel.id,
    secret_output: true,
  });
}

function localHeaders(cfg: Record<string, any>) {
  return {
    authorization: `Bearer ${String(cfg.runtime_token || '')}`,
    'CF-Access-Client-Id': String(cfg.access_client_id || ''),
    'CF-Access-Client-Secret': String(cfg.access_client_secret || ''),
    'content-type': 'application/json',
  };
}

function responseText(data: any) {
  if (typeof data?.output_text === 'string') return data.output_text.trim();
  const parts: string[] = [];
  for (const item of data?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === 'output_text' && part?.text) parts.push(String(part.text));
    }
  }
  return parts.join('\n').trim();
}

async function verifyRuntime(req: Request, caller: Awaited<ReturnType<typeof verifyGitHubOIDC>>) {
  if (!caller.ok) return json({ ok: false, error: caller.error }, caller.status);
  const admin = adminClient();
  const cfg = await localConfig(admin);
  const endpoint = String(cfg?.endpoint_url || '');
  const model = String(cfg?.model_id || '');
  if (
    !endpoint.startsWith('https://') ||
    !model ||
    !cfg?.runtime_token ||
    !cfg?.access_client_id ||
    !cfg?.access_client_secret
  ) {
    return json({ ok: false, state: 'configuration_incomplete' }, 503);
  }

  try {
    const health = await fetch(`${endpoint}/health`, {
      headers: localHeaders(cfg),
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
    if (!health.ok) throw Object.assign(new Error('local_ai_health_failed'), { status: health.status });

    const inference = await fetch(`${endpoint}/v1/responses`, {
      method: 'POST',
      headers: localHeaders(cfg),
      body: JSON.stringify({
        model,
        instructions: 'Return exactly ATLAS_LOCAL_READY.',
        input: [{ role: 'user', content: 'ATLAS local readiness check.' }],
        max_output_tokens: 16,
        store: false,
      }),
      signal: AbortSignal.timeout(90_000),
    });
    const body = await inference.json().catch(() => ({}));
    const text = responseText(body);
    if (!inference.ok || !text.includes('ATLAS_LOCAL_READY')) {
      throw Object.assign(new Error('local_ai_inference_failed'), { status: inference.status || 502 });
    }

    await admin.from('atlas_local_ai_runtimes').update({
      status: 'verified',
      last_verified_at: new Date().toISOString(),
      last_error_code: null,
      metadata: {
        bootstrap_version: VERSION,
        github_sha: caller.claims.sha,
        github_run_id: caller.claims.run_id,
        model_hf_repo: MODEL_HF_REPO,
        context_size: LOCAL_CONTEXT,
        health_verified: true,
        inference_verified: true,
      },
      updated_at: new Date().toISOString(),
    }).eq('runtime_key', 'primary');

    return json({
      ok: true,
      state: 'verified',
      provider: 'atlas-local',
      endpoint_url: endpoint,
      model,
      health_verified: true,
      inference_verified: true,
      automatic_api_cost_usd: 0,
      secret_output: false,
    });
  } catch (error: any) {
    const code = String(error?.message || 'local_ai_verification_failed').slice(0, 120);
    await admin.from('atlas_local_ai_runtimes').update({
      status: 'degraded',
      last_error_code: code,
      updated_at: new Date().toISOString(),
    }).eq('runtime_key', 'primary');
    return json({ ok: false, state: 'degraded', error: code, secret_output: false }, 503);
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const api = url.searchParams.get('api');

  if (req.method === 'GET' && api === 'readiness') {
    return json({
      ok: true,
      service: 'atlas-local-ai-bootstrap',
      version: VERSION,
      auth: 'github-oidc-main-workflow',
      hostname: HOSTNAME,
      secret_output: false,
    });
  }

  if (req.method !== 'POST' || !['issue', 'verify'].includes(String(api || ''))) {
    return json({ ok: false, error: 'not_found' }, 404);
  }

  const caller = await verifyGitHubOIDC(req);
  try {
    if (api === 'issue') return await issue(req, caller);
    return await verifyRuntime(req, caller);
  } catch (error: any) {
    const status = Number(error?.status) || 500;
    const code = String(error?.message || 'internal_error').slice(0, 120);
    if (status >= 500) console.error('atlas_local_ai_bootstrap_failed', { code });
    return json({ ok: false, error: code, secret_output: false }, status);
  }
});
