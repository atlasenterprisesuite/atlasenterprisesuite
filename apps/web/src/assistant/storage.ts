export const ATLAS_ASSISTANT_GREETING_KEY = 'atlas_assistant_greeted';
export const ATLAS_ASSISTANT_SPEECH_KEY = 'atlas_assistant_speech_enabled';

function storageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readSpeechPreference(): boolean {
  return storageAvailable() && window.localStorage.getItem(ATLAS_ASSISTANT_SPEECH_KEY) === 'true';
}

export function writeSpeechPreference(enabled: boolean): void {
  if (!storageAvailable()) return;
  window.localStorage.setItem(ATLAS_ASSISTANT_SPEECH_KEY, String(enabled));
}

export function readGreetingSeen(): boolean {
  return storageAvailable() && window.sessionStorage.getItem(ATLAS_ASSISTANT_GREETING_KEY) === 'true';
}

export function markGreetingSeen(): void {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return;
  window.sessionStorage.setItem(ATLAS_ASSISTANT_GREETING_KEY, 'true');
}
