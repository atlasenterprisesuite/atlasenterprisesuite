import { describe, expect, it } from 'vitest';
import {
  createInnerMindPlaylist, ORIGINAL_AFFIRMATIONS, NO_VOICE_CONSENT,
  grantVoiceConsent, revokeVoiceConsent, mayRecordVoice, mayUploadVoice
} from '../../apps/web/src/modules/wellbeing/innermind-core';

describe('InnerMind 777 domain and permission boundary', () => {
  it('builds a language- and goal-scoped deterministic playlist with original content', () => {
    const playlist = createInnerMindPlaylist('focus1', 'es', 'focus');
    expect(playlist.affirmationIds).toEqual(['es-focus-01']);
    expect(ORIGINAL_AFFIRMATIONS.every((item) => item.text.trim().length > 0)).toBe(true);
    expect(createInnerMindPlaylist('focus1', 'es', 'focus')).toEqual(playlist);
  });

  it('rejects invalid IDs, language, goal and duplicate catalog IDs', () => {
    expect(() => createInnerMindPlaylist('../bad', 'es', 'focus')).toThrow();
    expect(() => createInnerMindPlaylist('a', 'fr' as never, 'focus')).toThrow();
    expect(() => createInnerMindPlaylist('a', 'es', 'unknown' as never)).toThrow();
    expect(() => createInnerMindPlaylist('a', 'es', 'focus', [
      ORIGINAL_AFFIRMATIONS[0], ORIGINAL_AFFIRMATIONS[0]
    ])).toThrow(/duplicate/i);
  });

  it('fails closed before a direct user gesture or microphone permission', () => {
    expect(mayRecordVoice(NO_VOICE_CONSENT, 'session123', 'granted')).toBe(false);
    expect(() => grantVoiceConsent('session123', false)).toThrow();
    const state = grantVoiceConsent('session123', true);
    expect(mayRecordVoice(state, 'session123', 'prompt')).toBe(false);
    expect(mayRecordVoice(state, 'session123', 'denied')).toBe(false);
    expect(mayRecordVoice(state, 'different123', 'granted')).toBe(false);
    expect(mayRecordVoice(state, 'session123', 'granted')).toBe(true);
    expect(mayRecordVoice(revokeVoiceConsent(), 'session123', 'granted')).toBe(false);
  });

  it('requires separate explicit authorization and authentication for voice upload', () => {
    expect(mayUploadVoice(false, true)).toBe(false);
    expect(mayUploadVoice(true, false)).toBe(false);
    expect(mayUploadVoice(true, true)).toBe(true);
  });
});
