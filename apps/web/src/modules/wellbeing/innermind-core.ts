/**
 * ATLAS InnerMind 777 — dependency-free, offline-compatible domain rules.
 * No audio recording or network access occurs in this module.
 * Content is original ATLAS text, not imported from another application's catalog.
 */
export type InnerMindLanguage = 'es' | 'en';
export type InnerMindGoal = 'focus' | 'confidence' | 'rest' | 'gratitude';

export interface Affirmation {
  id: string;
  language: InnerMindLanguage;
  goal: InnerMindGoal;
  text: string;
}

export interface InnerMindPlaylist {
  id: string;
  language: InnerMindLanguage;
  goal: InnerMindGoal;
  affirmationIds: string[];
}

export const ORIGINAL_AFFIRMATIONS: readonly Affirmation[] = [
  { id: 'es-focus-01', language: 'es', goal: 'focus', text: 'Puedo dedicar mi atención a una tarea a la vez.' },
  { id: 'es-confidence-01', language: 'es', goal: 'confidence', text: 'Puedo aprender, practicar y mejorar con paciencia.' },
  { id: 'es-rest-01', language: 'es', goal: 'rest', text: 'Puedo darme un momento de tranquilidad.' },
  { id: 'es-gratitude-01', language: 'es', goal: 'gratitude', text: 'Hoy puedo reconocer algo que valoro.' },
  { id: 'en-focus-01', language: 'en', goal: 'focus', text: 'I can give one task my attention at a time.' },
  { id: 'en-confidence-01', language: 'en', goal: 'confidence', text: 'I can learn, practice, and improve with patience.' },
  { id: 'en-rest-01', language: 'en', goal: 'rest', text: 'I can take a moment for calm.' },
  { id: 'en-gratitude-01', language: 'en', goal: 'gratitude', text: 'Today I can notice something I value.' }
];

const MAX_ITEMS = 100;
const MAX_PLAYLIST_ID_LENGTH = 128;

export function createInnerMindPlaylist(
  id: string,
  language: InnerMindLanguage,
  goal: InnerMindGoal,
  available: readonly Affirmation[] = ORIGINAL_AFFIRMATIONS
): InnerMindPlaylist {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id) || id.length > MAX_PLAYLIST_ID_LENGTH) {
    throw new Error('Invalid playlist ID');
  }
  if (!['es', 'en'].includes(language) || !['focus', 'confidence', 'rest', 'gratitude'].includes(goal)) {
    throw new Error('Unsupported playlist settings');
  }
  const matches = available.filter((entry) => entry.language === language && entry.goal === goal);
  const ids = new Set<string>();
  for (const entry of matches) {
    if (!entry.id || ids.has(entry.id)) throw new Error('Invalid or duplicate affirmation ID');
    ids.add(entry.id);
  }
  if (ids.size > MAX_ITEMS) throw new Error('Playlist exceeds item limit');
  return { id, language, goal, affirmationIds: [...ids] };
}

/**
 * Consent is ephemeral by design and must never be recovered from offline storage.
 * Each permission is tied to the currently authorized session.
 */
export interface VoiceConsentState {
  sessionId: string | null;
  granted: boolean;
}

export const NO_VOICE_CONSENT: Readonly<VoiceConsentState> = Object.freeze({ sessionId: null, granted: false });

export function grantVoiceConsent(sessionId: string, userGesture: boolean): VoiceConsentState {
  if (!userGesture || !/^[a-zA-Z0-9_-]{8,128}$/.test(sessionId)) {
    throw new Error('Explicit user gesture and valid session are required');
  }
  return { sessionId, granted: true };
}

export function revokeVoiceConsent(): VoiceConsentState {
  return { ...NO_VOICE_CONSENT };
}

export function mayRecordVoice(
  consent: VoiceConsentState,
  activeSessionId: string,
  microphonePermission: 'granted' | 'denied' | 'prompt'
): boolean {
  return Boolean(
    consent.granted &&
    consent.sessionId &&
    consent.sessionId === activeSessionId &&
    microphonePermission === 'granted'
  );
}

/** Never assume uploads are permitted just because local recording is allowed. */
export function mayUploadVoice(explicitUploadConsent: boolean, authenticated: boolean): boolean {
  return explicitUploadConsent === true && authenticated === true;
}
