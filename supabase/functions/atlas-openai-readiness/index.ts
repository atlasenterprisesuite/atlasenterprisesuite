const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const MODEL = 'gpt-6-astra';
const OPENAI_BASE = 'https://api.openai.com/v1';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  }
});

function customVoiceState(readStatus: number, writeStatus: number) {
  if (readStatus === 401 || writeStatus === 401) return 'authentication_failed';
  if (readStatus === 403 || writeStatus === 403) return 'permission_denied';
  if (readStatus === 404 || writeStatus === 404) return 'access_not_enabled';
  if (readStatus === 429 || writeStatus === 429) return 'rate_limited';
  if (readStatus === 200 && [400, 422].includes(writeStatus)) return 'ready';
  return 'provider_unavailable';
}

async function probeCustomVoice() {
  if (!OPENAI_API_KEY) {
    return { state: 'provider_not_configured', read_probe: 0, write_probe: 0, readable: false, writable: false };
  }
  try {
    const authorization = { authorization: `Bearer ${OPENAI_API_KEY}` };
    const read = await fetch('https://api.openai.com/v1/audio/consent_phrases', {
      headers: authorization,
      cache: 'no-store'
    });
    const probe = new FormData();
    probe.set('name', 'atlas_access_probe');
    probe.set('language', 'en');
    const write = await fetch('https://api.openai.com/v1/audio/voice_consents', {
      method: 'POST',
      headers: authorization,
      body: probe,
      cache: 'no-store'
    });
    const state = customVoiceState(read.status, write.status);
    return {
      state,
      read_probe: read.status,
      write_probe: write.status,
      readable: read.status === 200,
      writable: [400, 422].includes(write.status)
    };
  } catch {
    return { state: 'provider_unreachable', read_probe: 0, write_probe: 0, readable: false, writable: false };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
  if (!OPENAI_API_KEY) {
    return json({
      ok: true,
      provider: 'openai',
      model: MODEL,
      configured: false,
      available: false,
      state: 'provider_not_configured',
      custom_voice: await probeCustomVoice()
    });
  }

  const custom_voice = await probeCustomVoice();
  try {
    const response = await fetch(`${OPENAI_BASE}/models/${MODEL}`, {
      headers: { authorization: `Bearer ${OPENAI_API_KEY}` },
      cache: 'no-store'
    });
    const requestId = response.headers.get('x-request-id');
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return json({
        ok: true,
        provider: 'openai',
        model: MODEL,
        configured: true,
        available: true,
        state: 'ready',
        resolved_model: data?.id || MODEL,
        request_id: requestId,
        custom_voice
      });
    }
    const state = response.status === 429
      ? 'rate_limited'
      : response.status === 401
        ? 'authentication_failed'
        : response.status === 403 || response.status === 404
          ? 'model_not_available'
          : 'provider_unavailable';
    return json({
      ok: true,
      provider: 'openai',
      model: MODEL,
      configured: true,
      available: false,
      state,
      provider_status: response.status,
      request_id: requestId,
      custom_voice
    });
  } catch {
    return json({
      ok: true,
      provider: 'openai',
      model: MODEL,
      configured: true,
      available: false,
      state: 'provider_unreachable',
      custom_voice
    });
  }
});
