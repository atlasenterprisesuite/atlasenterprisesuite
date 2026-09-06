export const VOICE_SESSION_STORAGE_KEY = 'atlas.voice.personal.session.v1';

export type StoredVoiceStep = 'setup' | 'sound-check' | 'record' | 'review' | 'generate';

export type StoredVoiceSession = {
  version: 1;
  profileId: string;
  step: StoredVoiceStep;
  consentAccepted: boolean;
  challengeVerified: boolean;
};

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const validSteps = new Set<StoredVoiceStep>(['setup', 'sound-check', 'record', 'review', 'generate']);

function isStoredVoiceSession(value: unknown): value is StoredVoiceSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredVoiceSession>;
  return candidate.version === 1
    && typeof candidate.profileId === 'string'
    && candidate.profileId.trim().length > 0
    && typeof candidate.step === 'string'
    && validSteps.has(candidate.step as StoredVoiceStep)
    && typeof candidate.consentAccepted === 'boolean'
    && typeof candidate.challengeVerified === 'boolean';
}

export class VoiceSessionStore {
  constructor(private readonly storage: KeyValueStorage) {}

  load(): StoredVoiceSession | null {
    const raw = this.storage.getItem(VOICE_SESSION_STORAGE_KEY);
    if (!raw) return null;

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isStoredVoiceSession(parsed)) {
        this.clear();
        return null;
      }
      return parsed;
    } catch {
      this.clear();
      return null;
    }
  }

  save(session: StoredVoiceSession): void {
    if (!isStoredVoiceSession(session)) throw new Error('Invalid Personal Voice session metadata.');
    this.storage.setItem(VOICE_SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  clear(): void {
    this.storage.removeItem(VOICE_SESSION_STORAGE_KEY);
  }
}
