/** Governed, generic, self-hosted narration only. Never accepts a personal voice reference. */
export const NATIVE_GENERIC_LOCALES = Object.freeze(['es-ES', 'es-MX', 'en-US', 'en-GB']);
const MAX_AUDIO_BYTES = 20_000_000;

export function validateNativeGenericInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['mode','text','locale','speechRate'].includes(key))) {
    throw Object.assign(new Error('invalid_input'), { status: 400 });
  }
  if (body.mode !== 'generic') throw Object.assign(new Error('personal_voice_not_supported'), { status: 409 });
  if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 1000 || body.text.includes('\0')) {
    throw Object.assign(new Error('invalid_input'), { status: 400 });
  }
  if (!NATIVE_GENERIC_LOCALES.includes(body.locale)) {
    throw Object.assign(new Error('locale_not_supported'), { status: 422 });
  }
  if (!Number.isInteger(body.speechRate) || body.speechRate < 100 || body.speechRate > 250) {
    throw Object.assign(new Error('speech_rate_invalid'), { status: 422 });
  }
  return {mode:'generic', text:body.text.trim(), locale:body.locale, speechRate:body.speechRate};
}

export async function nativeGenericStatus(config, fetcher = fetch) {
  if (!config?.url || !config?.token) {
    return { configured:false, state:'provider_not_configured', synthesis_verified:false, mode:'generic', locales:NATIVE_GENERIC_LOCALES };
  }
  try {
    const result = await fetcher(config.url + '/health', {
      method:'GET', headers: { authorization: 'Bearer ' + config.token }, cache:'no-store'
    });
    if (!result.ok) throw new Error('native_health_unavailable');
    const state = await result.json();
    const configured = Boolean(state?.dependencies?.espeak && state?.dependencies?.ffmpeg && state?.dependencies?.ffprobe &&
      state?.state === 'ready' && Array.isArray(state.capabilities) && state.capabilities.includes('local-tts'));
    return {configured:true, state:configured ? 'runtime_ready' : 'runtime_unavailable',
      synthesis_verified:false, mode:'generic', locales:NATIVE_GENERIC_LOCALES};
  } catch {
    return {configured:true, state:'runtime_unavailable', synthesis_verified:false, mode:'generic', locales:NATIVE_GENERIC_LOCALES};
  }
}

export async function nativeGenericSpeech(config, input, fetcher = fetch) {
  const body = validateNativeGenericInput(input);
  if (!config?.url || !config?.token) {
    throw Object.assign(new Error('provider_not_configured'), {status:503});
  }
  let response;
  try {
    response = await fetcher(config.url + '/speech', {
      method:'POST',
      headers: {authorization:'Bearer ' + config.token,'content-type':'application/json'},
      body:JSON.stringify(body),
      cache:'no-store'
    });
  } catch {
    throw Object.assign(new Error('runtime_unavailable'), {status:503});
  }
  if (!response.ok) throw Object.assign(new Error('runtime_unavailable'), {status:503});
  const contentType = response.headers.get('content-type') || '';
  if (!/^audio\/wav(?:\s*;|$)/i.test(contentType) ||
      response.headers.get('x-atlas-voice-mode') !== 'generic') {
    await response.body?.cancel();
    throw Object.assign(new Error('native_invalid_response'), {status:502});
  }
  const indicatedLength = Number(response.headers.get('content-length'));
  if (response.headers.has('content-length') && (!Number.isFinite(indicatedLength) ||
      indicatedLength <= 44 || indicatedLength > MAX_AUDIO_BYTES)) {
    await response.body?.cancel();
    throw Object.assign(new Error('native_invalid_response'), {status:502});
  }
  const audio = new Uint8Array(await response.arrayBuffer());
  if (audio.length <= 44 || audio.length > MAX_AUDIO_BYTES ||
      String.fromCharCode(...audio.slice(0,4)) !== 'RIFF' ||
      String.fromCharCode(...audio.slice(8,12)) !== 'WAVE') {
    throw Object.assign(new Error('native_invalid_response'), {status:502});
  }
  return new Response(audio, {status:200,headers:{
    'content-type':'audio/wav','cache-control':'private, no-store',
    'x-atlas-voice-mode':'generic','x-atlas-provider':'atlas-native',
    'x-atlas-ai-disclosure':'AI-generated generic voice'
  }});
}
