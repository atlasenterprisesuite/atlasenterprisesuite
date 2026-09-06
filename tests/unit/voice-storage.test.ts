import { expect, it } from 'vitest';
import { VoiceSessionStore, type KeyValueStorage } from '../../apps/web/src/modules/voice/storage';

class MapStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

it('persists only resumable non-audio Personal Voice metadata', () => {
  const storage = new MapStorage();
  const store = new VoiceSessionStore(storage);
  store.save({
    version: 1,
    profileId: 'vp-1',
    step: 'record',
    consentAccepted: true,
    challengeVerified: false,
  });

  expect(store.load()).toEqual({
    version: 1,
    profileId: 'vp-1',
    step: 'record',
    consentAccepted: true,
    challengeVerified: false,
  });
});

it('clears invalid or unsupported session data instead of trusting it', () => {
  const storage = new MapStorage();
  storage.setItem('atlas.voice.personal.session.v1', JSON.stringify({ version: 99, audio: 'raw-bytes' }));
  const store = new VoiceSessionStore(storage);

  expect(store.load()).toBeNull();
  expect(storage.getItem('atlas.voice.personal.session.v1')).toBeNull();
});
