export const openAICustomVoiceCapabilities = Object.freeze({
  localPlayback: false,
  audioExport: true,
  realtimeStream: true,
  telephony: false,
  serverSynthesis: true
});

export function customVoiceAccessState(readStatus, writeStatus) {
  const statuses = [Number(readStatus || 0), Number(writeStatus || 0)];
  if (statuses.includes(401)) return { configured: true, readable: false, writable: false, state: 'authentication_failed' };
  if (statuses.includes(403)) return { configured: true, readable: false, writable: false, state: 'permission_denied' };
  if (statuses.includes(429)) return { configured: true, readable: false, writable: false, state: 'rate_limited' };
  if (statuses.includes(404)) return { configured: true, readable: false, writable: false, state: 'access_not_enabled' };
  const readable = Number(readStatus) === 200;
  const writable = [400, 422].includes(Number(writeStatus));
  if (readable && writable) return { configured: true, readable: true, writable: true, state: 'ready' };
  return { configured: true, readable, writable, state: 'provider_unavailable' };
}

export function normalizeVoiceMimeType(value) {
  const base = String(value || '').toLowerCase().split(';')[0].trim();
  if (base === 'audio/x-wav') return 'audio/wav';
  if (['audio/webm','audio/mp4','audio/mpeg','audio/wav','audio/aac','audio/ogg','audio/flac'].includes(base)) return base;
  throw new Error('voice_audio_type_not_allowed');
}

export function extensionForVoiceMime(value) {
  const base = normalizeVoiceMimeType(value);
  return {
    'audio/webm': 'webm',
    'audio/mp4': 'mp4',
    'audio/mpeg': 'mpeg',
    'audio/wav': 'wav',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac'
  }[base];
}

export function providerErrorState(status) {
  const code = Number(status || 0);
  if (code === 401) return 'authentication_failed';
  if (code === 403) return 'permission_denied';
  if (code === 404) return 'access_not_enabled';
  if (code === 429) return 'rate_limited';
  if (code >= 400 && code < 500) return 'invalid_provider_request';
  return 'provider_unavailable';
}
