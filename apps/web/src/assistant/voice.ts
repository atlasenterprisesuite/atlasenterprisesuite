import type { AtlasCapabilityState } from './types';
import { microphoneCapabilityFromBrowser } from './capabilities';

type RecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string; confidence?: number } }>;
};

export type AssistantRecognitionController = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: RecognitionEventLike) => void) | null;
};

type RecognitionConstructor = new () => AssistantRecognitionController;

type RecognitionWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

export type AssistantRecognitionResult = {
  transcript: string;
  confidence?: number;
};

export type AssistantRecognitionCallbacks = {
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onFinal: (result: AssistantRecognitionResult) => void;
  onError: (error: Error) => void;
};

function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const speechWindow = window as RecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

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

export function detectSpeechRecognitionCapability(): AtlasCapabilityState {
  return recognitionConstructor() ? 'ready' : 'unavailable';
}

export function detectSpeechOutputCapability(): AtlasCapabilityState {
  if (typeof window === 'undefined') return 'unavailable';
  return 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined' ? 'ready' : 'unavailable';
}

export function speechRecognitionErrorCode(code: string): string {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'microphone_permission_denied';
  if (code === 'audio-capture') return 'microphone_unavailable';
  if (code === 'no-speech') return 'voice_no_speech';
  if (code === 'network') return 'voice_transcription_unavailable';
  return 'voice_transcription_failed';
}

export function createAssistantSpeechRecognition(
  callbacks: AssistantRecognitionCallbacks
): AssistantRecognitionController | null {
  const Recognition = recognitionConstructor();
  if (!Recognition) return null;

  const recognition = new Recognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = callbacks.lang || (typeof navigator !== 'undefined' ? navigator.language : 'es-US') || 'es-US';
  recognition.onstart = () => callbacks.onStart?.();
  recognition.onend = () => callbacks.onEnd?.();
  recognition.onerror = (event) => callbacks.onError(new Error(speechRecognitionErrorCode(event.error)));
  recognition.onresult = (event) => {
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (!result.isFinal) continue;
      const transcript = String(result[0]?.transcript || '').trim();
      if (!transcript) {
        callbacks.onError(new Error('voice_no_speech'));
        return;
      }
      callbacks.onFinal({ transcript, confidence: result[0]?.confidence });
      return;
    }
  };
  return recognition;
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

export function speakAssistantText(text: string, lang?: string): Promise<void> {
  if (detectSpeechOutputCapability() !== 'ready') return Promise.reject(new Error('speech_unavailable'));
  const value = text.trim();
  if (!value) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = lang || (typeof navigator !== 'undefined' ? navigator.language || 'es-US' : 'es-US');
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error('speech_unavailable'));
    stopAssistantSpeech();
    window.speechSynthesis.speak(utterance);
  });
}
