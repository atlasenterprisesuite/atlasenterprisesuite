import { providerErrorState } from './provider-core.mjs';

export const elevenLabsVoice = Object.freeze({ id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', model: 'eleven_multilingual_v2' });
const BASE = 'https://api.elevenlabs.io/v1';

function failure(message, status = 503) {
  return Object.assign(new Error(message), { status });
}

export async function elevenLabsAccess(apiKey, fetcher = fetch) {
  const base = { provider: 'elevenlabs', configured: Boolean(apiKey), synthesis_verified: false, voice: elevenLabsVoice, max_characters: 1000 };
  if (!apiKey) return { ...base, state: 'provider_not_configured' };
  try {
    const response = await fetcher(`${BASE}/voices/${elevenLabsVoice.id}`, {
      method: 'GET', headers: { 'xi-api-key': apiKey }, cache: 'no-store', signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return { ...base, state: providerErrorState(response.status) };
    const voice = await response.json();
    return { ...base, state: voice?.voice_id === elevenLabsVoice.id ? 'access_verified' : 'provider_invalid_response' };
  } catch {
    return { ...base, state: 'provider_unreachable' };
  }
}

export async function elevenLabsSpeech(apiKey, text, fetcher = fetch) {
  if (!apiKey) throw failure('provider_not_configured');
  if (typeof text !== 'string' || !text.trim() || text.trim().length > 1000) throw failure('invalid_input', 400);
  let response;
  try {
    response = await fetcher(`${BASE}/text-to-speech/${elevenLabsVoice.id}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text: text.trim(), model_id: elevenLabsVoice.model }),
      cache: 'no-store', signal: AbortSignal.timeout(30000)
    });
  } catch {
    throw failure('provider_unreachable');
  }
  if (!response.ok) throw failure(providerErrorState(response.status), response.status === 429 ? 429 : 503);
  if (!response.body || !response.headers.get('content-type')?.toLowerCase().startsWith('audio/mpeg')) {
    throw failure('provider_invalid_response', 502);
  }
  return new Response(response.body, { headers: {
    'content-type': 'audio/mpeg', 'cache-control': 'no-store',
    'x-atlas-provider': 'elevenlabs', 'x-atlas-ai-voice': 'synthetic',
    'x-atlas-ai-disclosure': 'AI-generated voice'
  } });
}
