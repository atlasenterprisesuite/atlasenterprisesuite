const U = 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const K = Deno.env.get('SUPABASE_ANON_KEY') || 'sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const OPENAI = Deno.env.get('OPENAI_API_KEY') || '';
const MODEL = Deno.env.get('ATLAS_OPENAI_REPAIR_MODEL') || 'gpt-5.6';
const REPO='atlasenterprisesuite/atlasenterprisesuite';
const OWNER='atlasenterprisesuite';
const WORKFLOW = `${REPO}/.github/workflows/atlas-ai-repair-executor.yml@refs/heads/main`;
const AUD='atlas-enterprise-suite-repair';
const VERSION = 4;

function h(extra: Record<string, string> = {}) {
  return {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    ...extra,
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: h({ 'content-type': 'application/json; charset=utf-8' }),
  });
}

function clean(value: unknown, max = 12_000) {
  return String(value ?? '').trim().slice(0, max);
}

function b64u(value: string) {
  let normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4) normalized += '=';
  return Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
}

function decodePart(value: string) {
  return JSON.parse(new TextDecoder().decode(b64u(value)));
}

function outputText(data: any) {
  const output: string[] = [];
  for (const item of data?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === 'output_text' && part?.text) output.push(part.text);
    }
  }
  return output.join('\n').trim();
}

async function authContext(req: Request) {
  const auth = req.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return { ok: false as const, status: 401, error: 'authentication_required' };
  const headers = { apikey: K, authorization: auth, 'content-type': 'application/json' };
  const userResponse = await fetch(`${U}/auth/v1/user`, { headers, cache: 'no-store' });
  if (!userResponse.ok) return { ok: false as const, status: 401, error: 'invalid_session' };
  const user = await userResponse.json();
  const memberResponse = await fetch(`${U}/rest/v1/organization_members?select=org_id,role,status&status=eq.active&limit=1`, { headers, cache: 'no-store' });
  if (!memberResponse.ok) return { ok: false as const, status: 403, error: 'organization_access_denied' };
  const members = await memberResponse.json();
  if (!members?.[0]) return { ok: false as const, status: 403, error: 'active_organization_required' };
  return { ok: true as const, auth, user, org: members[0] };
}

async function userFetch(auth: string, path: string, init: RequestInit = {}) {
  return fetch(`${U}${path}`, {
    ...init,
    headers: { apikey: K, authorization: auth, 'content-type': 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
  });
}

async function svc(path: string, init: RequestInit = {}) {
  if (!SERVICE) throw new Error('service_role_not_configured');
  return fetch(`${U}${path}`, {
    ...init,
    headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}`, 'content-type': 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
  });
}

let jwksCache: { until: number; keys: any[] } | null = null;

async function githubKeys() {
  if (jwksCache && jwksCache.until > Date.now()) return jwksCache.keys;
  const config = await fetch('https://token.actions.githubusercontent.com/.well-known/openid-configuration', { cache: 'no-store' }).then((response) => response.json());
  const data = await fetch(config.jwks_uri, { cache: 'no-store' }).then((response) => response.json());
  jwksCache = { until: Date.now() + 10 * 60 * 1000, keys: data.keys || [] };
  return jwksCache.keys;
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
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!valid || payload.iss !== 'https://token.actions.githubusercontent.com' || !audiences.includes(AUD) || Number(payload.exp || 0) <= now || Number(payload.nbf || 0) > now + 30) {
    return { ok: false as const, status: 401, error: 'github_oidc_verification_failed' };
  }
  if (payload.repository !== REPO || payload.repository_owner !== OWNER || payload.ref !== 'refs/heads/main' || payload.workflow_ref !== WORKFLOW) {
    return { ok: false as const, status: 403, error: 'github_oidc_scope_denied' };
  }
  return { ok: true as const, claims: payload, runner: `github-actions:${payload.run_id || 'unknown'}:${payload.run_attempt || '1'}` };
}

function validatePatch(patch: string) {
  if (!patch || patch.length > 100_000) throw new Error('patch_size_invalid');
  if (/GIT binary patch/i.test(patch) || /deleted file mode/i.test(patch)) throw new Error('binary_or_delete_patch_forbidden');
  const protectedPaths = ['.github/', 'adapters/supabase/atlas-repair-bridge/', 'scripts/atlas-ai-repair-runner.mjs', '.env', 'credentials', 'secrets'];
  const allowed = ['modules/', 'atlas/', 'apps/', 'adapters/', 'scripts/', 'docs/', 'rideos-router.js', 'package.json', 'README.md'];
  const paths = [...patch.matchAll(/^\+\+\+\s+(?:b\/)?(.+)$/gm)].map((match) => match[1]).filter((path) => path !== '/dev/null');
  if (!paths.length) throw new Error('patch_has_no_files');
  for (const path of paths) {
    if (path.includes('..') || protectedPaths.some((protectedPath) => path.includes(protectedPath)) || !allowed.some((prefix) => path === prefix || path.startsWith(prefix))) {
      throw new Error(`patch_path_forbidden:${path}`);
    }
  }
  return paths;
}

function safeTests(values: unknown) {
  const allowed = new Set(['npm run test:unit', 'npm run test:integration', 'npm run typecheck', 'npm run build']);
  const requested = Array.isArray(values) ? values.map((value) => String(value).trim()).filter(Boolean) : [];
  const selected = requested.filter((value) => allowed.has(value));
  if (!selected.includes('npm run test:unit')) selected.push('npm run test:unit');
  if (!selected.includes('npm run typecheck')) selected.push('npm run typecheck');
  return [...new Set(selected)].slice(0, 4);
}

function normalizePlan(input: any) {
  const plan = {
    summary: clean(input?.summary, 1000),
    classification: clean(input?.classification, 80) || 'mixed',
    patch: clean(input?.patch, 100_000),
    tests: safeTests(input?.tests),
    risk: clean(input?.risk, 2000),
  };
  if (!['runtime', 'configuration', 'frontend', 'backend', 'integration', 'mixed', 'insufficient-context'].includes(plan.classification)) plan.classification = 'mixed';
  validatePatch(plan.patch);
  return plan;
}

async function enqueue(req: Request) {
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const ctx = await authContext(req);
  if (!ctx.ok) return json({ ok: false, error: ctx.error }, ctx.status);
  if (!['owner', 'admin'].includes(String(ctx.org.role))) return json({ ok: false, error: 'owner_or_admin_required' }, 403);
  let body: any = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }
  const requestText = clean(body?.request, 12_000);
  if (requestText.length < 3) return json({ ok: false, error: 'repair_request_required' }, 400);
  const context = body?.context && typeof body.context === 'object' ? body.context : {};
  const response = await userFetch(ctx.auth, '/rest/v1/rpc/atlas_enqueue_repair_job', {
    method: 'POST',
    body: JSON.stringify({ p_org_id: ctx.org.org_id, p_request_text: requestText, p_context: context }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return json({ ok: false, error: data?.message || 'enqueue_failed' }, response.status);
  const job = Array.isArray(data) ? data[0] : data;
  return json({ ok: true, job: { id: job?.id, status: job?.status || 'pending', created_at: job?.created_at }, execution: 'github-actions-oidc', repository: REPO });
}

async function status(req: Request) {
  const ctx = await authContext(req);
  if (!ctx.ok) return json({ ok: false, error: ctx.error }, ctx.status);
  const response = await userFetch(ctx.auth, `/rest/v1/atlas_ai_repair_jobs?org_id=eq.${encodeURIComponent(ctx.org.org_id)}&select=id,request_text,status,attempts,branch_name,pull_request_url,source_commit,result,created_at,updated_at,completed_at&order=created_at.desc&limit=20`);
  const data = await response.json().catch(() => []);
  return json({ ok: response.ok, jobs: response.ok ? data : [], error: response.ok ? undefined : 'status_failed' }, response.ok ? 200 : response.status);
}

async function claim(req: Request) {
  const github = await verifyGitHubOIDC(req);
  if (!github.ok) return json({ ok: false, error: github.error }, github.status);
  const response = await svc('/rest/v1/rpc/atlas_claim_repair_job', { method: 'POST', body: JSON.stringify({ p_runner: github.runner }) });
  const data = await response.json().catch(() => []);
  if (!response.ok) return json({ ok: false, error: data?.message || 'claim_failed' }, response.status);
  const job = Array.isArray(data) ? data[0] : data;
  if (!job) return json({ ok: true, job: null });
  return json({ ok: true, job, repository: REPO });
}

async function getJobService(id: string) {
  const response = await svc(`/rest/v1/atlas_ai_repair_jobs?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
  const data = await response.json().catch(() => []);
  return response.ok ? data?.[0] : null;
}

async function finishService(id: string, statusValue: string, plan: any = null, result: any = null, branch: string | null = null, pr: string | null = null, commit: string | null = null) {
  const response = await svc('/rest/v1/rpc/atlas_finish_repair_job', {
    method: 'POST',
    body: JSON.stringify({ p_id: id, p_status: statusValue, p_plan: plan, p_result: result, p_branch_name: branch, p_pull_request_url: pr, p_source_commit: commit }),
  });
  if (!response.ok) throw new Error('finish_job_failed');
}

async function plan(req: Request) {
  const github = await verifyGitHubOIDC(req);
  if (!github.ok) return json({ ok: false, error: github.error }, github.status);
  let body: any = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }
  const id = clean(body?.job_id, 80);
  const repositoryContext = clean(body?.repository_context, 230_000);
  if (!id || !repositoryContext) return json({ ok: false, error: 'job_id_and_repository_context_required' }, 400);
  const job = await getJobService(id);
  if (!job || !['claimed', 'planning'].includes(job.status)) return json({ ok: false, error: 'repair_job_not_claimable' }, 409);
  if (!OPENAI) return json({ ok: false, configured: false, error: 'openai_not_configured' }, 503);

  await finishService(id, 'planning');
  const instructions = `You are the ATLAS IA repository repair planner. Produce the smallest safe unified git diff that fixes the requested issue in the canonical repository ${REPO}. Preserve existing routes, auth, RBAC, tenant isolation, auditability, truthful runtime status, current ATLAS identity and all newer functionality. Never edit .github workflows, this repair bridge, the repair runner, env/secret/credential files, lock files, or delete files. Never add secrets. Do not fabricate test results. Use only repository context supplied below. If the evidence is insufficient, classify it as insufficient-context and do not fabricate a fix. Tests must be selected only from: npm run test:unit, npm run test:integration, npm run typecheck, npm run build.`;
  const input = `Repair request:\n${job.request_text}\n\nWebsite/runtime context:\n${JSON.stringify(job.context || {})}\n\nRepository context:\n${repositoryContext}`;
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      summary: { type: 'string' },
      classification: { type: 'string', enum: ['runtime', 'configuration', 'frontend', 'backend', 'integration', 'mixed', 'insufficient-context'] },
      patch: { type: 'string' },
      tests: { type: 'array', items: { type: 'string' }, maxItems: 4 },
      risk: { type: 'string' },
    },
    required: ['summary', 'classification', 'patch', 'tests', 'risk'],
  };

  let upstream: Response;
  try {
    upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${OPENAI}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, instructions, input, store: false, max_output_tokens: 10_000, text: { format: { type: 'json_schema', name: 'atlas_repair_plan', strict: true, schema } } }),
    });
  } catch (error) {
    return json({ ok: false, error: 'openai_unreachable', detail: error instanceof Error ? error.message : String(error) }, 502);
  }

  const raw = await upstream.json().catch(() => ({}));
  if (!upstream.ok) return json({ ok: false, error: raw?.error?.message || 'openai_request_failed' }, 502);
  let normalized: any;
  try { normalized = normalizePlan(JSON.parse(outputText(raw))); }
  catch (error) { return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 422); }
  await finishService(id, 'applying', normalized);
  return json({ ok: true, plan: normalized, planner: 'openai-responses', model: raw?.model || MODEL, store: false });
}

async function acceptPlan(req: Request) {
  const github = await verifyGitHubOIDC(req);
  if (!github.ok) return json({ ok: false, error: github.error }, github.status);
  let body: any = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }
  const id = clean(body?.job_id, 80);
  if (!id) return json({ ok: false, error: 'job_id_required' }, 400);
  const job = await getJobService(id);
  if (!job || !['claimed', 'planning'].includes(job.status)) return json({ ok: false, error: 'repair_job_not_claimable' }, 409);
  let normalized: any;
  try { normalized = normalizePlan(body?.plan); }
  catch (error) { return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 422); }
  await finishService(id, 'applying', normalized);
  return json({ ok: true, plan: normalized, planner: 'external-reviewed-plan' });
}

async function complete(req: Request) {
  const github = await verifyGitHubOIDC(req);
  if (!github.ok) return json({ ok: false, error: github.error }, github.status);
  let body: any = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }
  const id = clean(body?.job_id, 80);
  const state = body?.success ? 'completed' : 'failed';
  if (!id) return json({ ok: false, error: 'job_id_required' }, 400);
  await finishService(id, state, null, body?.result || {}, clean(body?.branch, 200) || null, clean(body?.pull_request_url, 500) || null, clean(body?.commit, 80) || null);
  return json({ ok: true, status: state });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const api = url.searchParams.get('api');
  if (api === 'readiness') return json({
    ok: true,
    state: OPENAI ? 'configured' : 'blocked',
    service: 'atlas-repair-bridge',
    version: VERSION,
    repository: REPO,
    queue: true,
    githubAuth: 'oidc',
    workflow: WORKFLOW,
    primaryPlanner: 'openai-responses',
    openaiConfigured: Boolean(OPENAI),
    model: OPENAI ? MODEL : null,
    store: false,
    blocker: OPENAI ? null : 'openai_not_configured',
  });
  if (api === 'enqueue') return enqueue(req);
  if (api === 'status') return status(req);
  if (api === 'claim') return claim(req);
  if (api === 'plan') return plan(req);
  if (api === 'accept-plan') return acceptPlan(req);
  if (api === 'complete') return complete(req);
  return json({ ok: true, service: 'atlas-repair-bridge', version: VERSION, endpoints: ['readiness', 'enqueue', 'status', 'claim', 'plan', 'accept-plan', 'complete'] });
});
