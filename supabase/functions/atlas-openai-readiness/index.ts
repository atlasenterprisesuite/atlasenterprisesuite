const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const MODEL = 'gpt-6-astra';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  }
});

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
  if (!OPENAI_API_KEY) return json({ ok: true, provider: 'openai', model: MODEL, configured: false, available: false, state: 'provider_not_configured' });
  try {
    const response = await fetch(`https://api.openai.com/v1/models/${MODEL}`, {
      headers: { authorization: `Bearer ${OPENAI_API_KEY}` },
      cache: 'no-store'
    });
    const requestId = response.headers.get('x-request-id');
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return json({ ok: true, provider: 'openai', model: MODEL, configured: true, available: true, state: 'ready', resolved_model: data?.id || MODEL, request_id: requestId });
    }
    const state = response.status === 429 ? 'rate_limited' : response.status === 401 ? 'authentication_failed' : response.status === 403 || response.status === 404 ? 'model_not_available' : 'provider_unavailable';
    return json({ ok: true, provider: 'openai', model: MODEL, configured: true, available: false, state, provider_status: response.status, request_id: requestId });
  } catch {
    return json({ ok: true, provider: 'openai', model: MODEL, configured: true, available: false, state: 'provider_unreachable' });
  }
});
