import type { AtlasCapabilityState } from './types';
import { microphoneCapabilityFromBrowser } from './capabilities';

export async function detectMicrophoneCapability(): Promise<AtlasCapabilityState> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return 'unavailable';
  if (!navigator.permissions?.query) return 'permission-required';

  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return microphoneCapabilityFromBrowser({
      hasMediaDevices: true,
      permissionState: status.state === 'granted' ? 'granted' : status.state === 'denied' ? 'denied' : 'prompt'
    });
  } catch {
    return 'permission-required';
  }
}

export function detectSpeechOutputCapability(): AtlasCapabilityState {
  if (typeof window === 'undefined') return 'unavailable';
  return 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined' ? 'ready' : 'unavailable';
}

export async function requestMicrophoneCapture(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('microphone_unsupported');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (cause) {
    const name = cause instanceof DOMException ? cause.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new Error('microphone_permission_denied');
    throw new Error('microphone_unavailable');
  }
}

export function stopMicrophoneCapture(stream: MediaStream | null): void {
  for (const track of stream?.getTracks() || []) track.stop();
}

export function stopAssistantSpeech(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
}

export function speakAssistantText(text: string): Promise<void> {
  if (detectSpeechOutputCapability() !== 'ready') return Promise.reject(new Error('speech_unavailable'));
  const value = text.trim();
  if (!value) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error('speech_unavailable'));
    stopAssistantSpeech();
    window.speechSynthesis.speak(utterance);
  });
}
