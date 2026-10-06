const BASE = 'https://api.elevenlabs.io/v1';
export const elevenLabsMusic = Object.freeze({
  engineId: 'elevenlabs-music-v2',
  displayName: 'ElevenLabs Music v2',
  model: 'music_v2',
  minDurationSeconds: 3,
  maxDurationSeconds: 600
});

function stateFromStatus(status) {
  if (status === 401 || status === 403) return 'configured-unverified';
  if (status === 402 || status === 429) return 'insufficient-credit';
  if (status >= 500) return 'error';
  return 'unavailable';
}

function failure(message, status = 503) {
  return Object.assign(new Error(message), { status });
}

export async function elevenLabsMusicReadiness(apiKey, fetcher = fetch) {
  const base = {
    engineId: elevenLabsMusic.engineId,
    displayName: elevenLabsMusic.displayName,
    executionClass: 'byo-provider',
    connectionState: 'unconfigured',
    ready: false,
    mediaKinds: ['music'],
    capabilityNotes: [
      'model:music_v2',
      'duration:3-600s',
      'instrumental:true',
      'format:mp3_48000_192',
      'c2pa:true'
    ],
    lastVerifiedAt: null
  };
  if (!apiKey) return base;
  let response;
  try {
    response = await fetcher(`${BASE}/models`, {
      method: 'GET',
      headers: { 'xi-api-key': apiKey, accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    });
  } catch {
    return { ...base, connectionState: 'error' };
  }
  if (!response.ok) return { ...base, connectionState: stateFromStatus(response.status) };
  const models = await response.json().catch(() => []);
  const available = Array.isArray(models) && models.some(model =>
    ['music_v2', 'music_v2_5'].includes(String(model?.model_id || ''))
  );
  return available
    ? { ...base, connectionState: 'ready', ready: true, lastVerifiedAt: new Date().toISOString() }
    : { ...base, connectionState: 'unavailable' };
}

export async function elevenLabsMusicGenerate(apiKey, input, fetcher = fetch) {
  if (!apiKey) throw failure('music_provider_not_configured');
  const prompt = String(input?.prompt || '').trim();
  const durationSeconds = Number(input?.durationSeconds ?? 60);
  const instrumental = input?.instrumental !== false;
  if (prompt.length < 8 || prompt.length > 4100) throw failure('music_prompt_invalid', 400);
  if (!Number.isFinite(durationSeconds) || durationSeconds < 3 || durationSeconds > 600) {
    throw failure('music_duration_invalid', 400);
  }

  let response;
  try {
    response = await fetcher(`${BASE}/music?output_format=mp3_48000_192`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'content-type': 'application/json',
        accept: 'audio/mpeg'
      },
      body: JSON.stringify({
        prompt,
        music_length_ms: Math.round(durationSeconds * 1000),
        model_id: elevenLabsMusic.model,
        force_instrumental: instrumental,
        sign_with_c2pa: true
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(180000)
    });
  } catch {
    throw failure('music_provider_unreachable');
  }

  if (!response.ok) {
    const status = response.status === 402 || response.status === 429 ? 429 : 503;
    throw failure(`music_provider_${stateFromStatus(response.status).replaceAll('-', '_')}`, status);
  }
  if (!response.body || !String(response.headers.get('content-type') || '').toLowerCase().startsWith('audio/')) {
    throw failure('music_provider_invalid_response', 502);
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      'content-type': response.headers.get('content-type') || 'audio/mpeg',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-atlas-provider': 'elevenlabs',
      'x-atlas-model': elevenLabsMusic.model,
      'x-atlas-ai-disclosure': 'AI-generated music',
      'x-atlas-song-id': response.headers.get('song-id') || ''
    }
  });
}
