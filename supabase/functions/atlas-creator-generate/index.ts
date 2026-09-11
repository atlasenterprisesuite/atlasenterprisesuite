import { resolveIntelligenceContext } from '../atlas-copilot/atlas-intelligence-auth.mjs';

const PROVIDER_ID = 'flux-schnell-local';
const DEFAULT_ORIGIN = 'https://www.atlasenterprisesuite.com';

function corsHeaders(req: Request) {
  const allowed = (Deno.env.get('ATLAS_ALLOWED_ORIGIN') || DEFAULT_ORIGIN).trim();
  const requested = req.headers.get('origin') || '';
  return {
    'access-control-allow-origin': requested === allowed ? requested : allowed,
    'access-control-allow-headers': 'authorization, content-type, x-atlas-org-id, x-atlas-session-id',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff'
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders(req) });
}

function safeBaseUrl(value: string) {
  const raw = value.trim().replace(/\/+$/, '');
  const parsed = new URL(raw);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw Object.assign(new Error('invalid_local_provider_url'), { status: 503 });
  return parsed.toString().replace(/\/$/, '');
}

async function parseBody(req: Request) {
  try {
    return await req.json();
  } catch {
    throw Object.assign(new Error('invalid_input'), { status: 400 });
  }
}

function validateRequest(body: any) {
  const kind = String(body?.kind || 'image').trim();
  const prompt = String(body?.prompt || '').trim();
  const format = String(body?.format || 'Adaptive').trim();
  const visibility = String(body?.visibility || 'Private').trim();
  const zeroCostMode = body?.zeroCostMode !== false;

  if (kind !== 'image') throw Object.assign(new Error('capability_not_available'), { status: 422 });
  if (prompt.length < 8) throw Object.assign(new Error('invalid_prompt'), { status: 400 });
  if (!zeroCostMode) throw Object.assign(new Error('paid_provider_routing_disabled'), { status: 403 });

  return { kind, prompt, format, visibility, zeroCostMode };
}

async function resolveAtlasContext(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
  if (!supabaseUrl || !publishableKey) {
    throw Object.assign(new Error('identity_runtime_not_configured'), { status: 503 });
  }
  return resolveIntelligenceContext({ request: req, supabaseUrl, publishableKey, fetchFn: fetch });
}

function runtimeConfig() {
  const localUrl = Deno.env.get('ATLAS_FLUX_LOCAL_URL') || '';
  const runtimeToken = Deno.env.get('ATLAS_FLUX_RUNTIME_TOKEN') || '';
  if (!localUrl.trim() || !runtimeToken.trim()) return null;
  return { baseUrl: safeBaseUrl(localUrl), runtimeToken: runtimeToken.trim() };
}

function runtimeHeaders(runtimeToken: string, extra: Record<string, string> = {}) {
  return {
    'accept': 'application/json',
    'x-atlas-runtime-token': runtimeToken,
    ...extra
  };
}

async function probeFlux(baseUrl: string, runtimeToken: string) {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: runtimeHeaders(runtimeToken),
      signal: AbortSignal.timeout(5000)
    });
  } catch {
    return { ready: false, state: 'resource-blocked', message: 'The self-hosted FLUX runtime could not be reached.' };
  }

  if (response.status === 401 || response.status === 403) {
    return { ready: false, state: 'configuration-required', message: 'The FLUX runtime service credential was rejected.' };
  }
  if (!response.ok) {
    return { ready: false, state: 'resource-blocked', message: `The self-hosted FLUX runtime returned HTTP ${response.status}.` };
  }

  try {
    const body = await response.json();
    if (body?.ready === false) {
      return { ready: false, state: 'resource-blocked', message: String(body?.message || 'The local runtime reports insufficient resources.') };
    }
  } catch {
    return { ready: false, state: 'resource-blocked', message: 'The self-hosted FLUX runtime returned an invalid health response.' };
  }

  return { ready: true, state: 'ready', message: 'Self-hosted FLUX runtime verified for this request.' };
}

async function generateFlux(baseUrl: string, runtimeToken: string, input: ReturnType<typeof validateRequest>, organizationId: string, userId: string) {
  const response = await fetch(`${baseUrl}/generate`, {
    method: 'POST',
    headers: runtimeHeaders(runtimeToken, { 'content-type': 'application/json' }),
    body: JSON.stringify({
      model: 'FLUX.1-schnell',
      prompt: input.prompt,
      format: input.format,
      organization_id: organizationId,
      requested_by: userId
    }),
    signal: AbortSignal.timeout(120000)
  });

  if (response.status === 401 || response.status === 403) {
    throw Object.assign(new Error('local_provider_auth_failed'), { status: 503 });
  }
  if (!response.ok) {
    throw Object.assign(new Error('local_provider_failed'), { status: 502, providerStatus: response.status });
  }

  const result = await response.json();
  const asset = result?.asset || (result?.url ? { url: result.url } : null);
  if (!asset) throw Object.assign(new Error('provider_invalid_response'), { status: 502 });
  return asset;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  const url = new URL(req.url);

  try {
    if (req.method === 'GET' && url.searchParams.get('api') === 'readiness') {
      await resolveAtlasContext(req);
      const runtime = runtimeConfig();
      if (!runtime) {
        return json(req, {
          ok: true,
          providerId: PROVIDER_ID,
          state: 'configuration-required',
          zeroCostMode: true,
          message: 'Self-hosted FLUX runtime configuration is incomplete.'
        });
      }
      const probe = await probeFlux(runtime.baseUrl, runtime.runtimeToken);
      return json(req, {
        ok: true,
        providerId: PROVIDER_ID,
        state: probe.state,
        zeroCostMode: true,
        message: probe.message
      });
    }

    if (req.method !== 'POST') return json(req, { ok: false, state: 'failed', error: 'method_not_allowed' }, 405);

    const body = validateRequest(await parseBody(req));
    const resolved = await resolveAtlasContext(req);
    const runtime = runtimeConfig();

    if (!runtime) {
      return json(req, {
        ok: false,
        providerId: PROVIDER_ID,
        state: 'configuration-required',
        message: 'ATLAS_FLUX_LOCAL_URL and ATLAS_FLUX_RUNTIME_TOKEN must be configured. No paid fallback was attempted.'
      }, 503);
    }

    const probe = await probeFlux(runtime.baseUrl, runtime.runtimeToken);
    if (!probe.ready) {
      return json(req, { ok: false, providerId: PROVIDER_ID, ...probe }, 503);
    }

    const asset = await generateFlux(runtime.baseUrl, runtime.runtimeToken, body, resolved.context.organization_id, resolved.context.user_id);
    return json(req, {
      ok: true,
      providerId: PROVIDER_ID,
      state: 'completed',
      zeroCostMode: true,
      asset
    });
  } catch (error: any) {
    const status = Number(error?.status || 500);
    const code = String(error?.code || error?.message || 'internal_error');
    console.error('atlas_creator_generation_failed', { code });
    return json(req, { ok: false, providerId: PROVIDER_ID, state: 'failed', error: code }, status);
  }
});
