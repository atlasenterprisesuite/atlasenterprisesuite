import { describe, expect, it } from 'vitest';
import {
  customVoiceAccessState,
  normalizeVoiceMimeType,
  openAICustomVoiceCapabilities
} from '../../supabase/functions/atlas-voice-provider/provider-core.mjs';

describe('ATLAS Custom Voice provider core', () => {
  it('treats a 200 read probe and validation-error write probe as eligible', () => {
    expect(customVoiceAccessState(200, 400)).toEqual({
      configured: true,
      readable: true,
      writable: true,
      state: 'ready'
    });
    expect(customVoiceAccessState(200, 422).state).toBe('ready');
  });

  it('fails closed when Custom Voices are unavailable or unauthorized', () => {
    expect(customVoiceAccessState(404, 404).state).toBe('access_not_enabled');
    expect(customVoiceAccessState(403, 403).state).toBe('permission_denied');
    expect(customVoiceAccessState(401, 401).state).toBe('authentication_failed');
    expect(customVoiceAccessState(429, 429).state).toBe('rate_limited');
  });

  it('normalizes browser codec MIME types to accepted base types', () => {
    expect(normalizeVoiceMimeType('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(normalizeVoiceMimeType('audio/x-wav')).toBe('audio/wav');
    expect(() => normalizeVoiceMimeType('application/octet-stream')).toThrow('voice_audio_type_not_allowed');
  });

  it('declares Custom Voice server capabilities without claiming telephony', () => {
    expect(openAICustomVoiceCapabilities).toEqual({
      localPlayback: false,
      audioExport: true,
      realtimeStream: true,
      telephony: false,
      serverSynthesis: true
    });
  });
});
