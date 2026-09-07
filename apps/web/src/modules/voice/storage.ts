export const PERSONAL_VOICE_SESSION_KEY = 'atlas.voice.personal.session.v1';

export type StoredVoiceSession = {
  version: 1;
  profileId: string;
  step: 'setup' | 'sound-check' | 'record' | 'review' | 'generate';
  consentAccepted: boolean;
};

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const steps: StoredVoiceSession['step'][] = ['setup', 'sound-check', 'record', 'review', 'generate'];

function isStoredVoiceSession(value: unknown): value is StoredVoiceSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredVoiceSession>;
  return candidate.version === 1
    && typeof candidate.profileId === 'string'
    && steps.includes(candidate.step as StoredVoiceSession['step'])
    && typeof candidate.consentAccepted === 'boolean';
}

export class LocalVoiceSessionStore {
  constructor(private readonly storage: StorageLike) {}

  save(session: Omit<StoredVoiceSession, 'version'> | StoredVoiceSession) {
    const normalized: StoredVoiceSession = { ...session, version: 1 };
    this.storage.setItem(PERSONAL_VOICE_SESSION_KEY, JSON.stringify(normalized));
  }

  load(): StoredVoiceSession | null {
    const raw = this.storage.getItem(PERSONAL_VOICE_SESSION_KEY);
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

  clear() {
    this.storage.removeItem(PERSONAL_VOICE_SESSION_KEY);
  }
}
