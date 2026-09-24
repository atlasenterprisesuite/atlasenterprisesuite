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

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
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

export function detectAudioRecordingCapability(): AtlasCapabilityState {
  if (typeof window === 'undefined') return 'unavailable';
  return typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) ? 'ready' : 'unavailable';
}

export async function recordAssistantAudioChunk(durationMs = 4200): Promise<Blob> {
  if (detectAudioRecordingCapability() !== 'ready') throw new Error('audio_recording_unavailable');
  const stream = await requestMicrophoneCapture();
  return new Promise((resolve, reject) => {
    const chunks: BlobPart[] = [];
    let recorder: MediaRecorder;
    let settled = false;
    let timer = 0;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (timer) window.clearTimeout(timer);
      stopMicrophoneCapture(stream);
      if (error) {
        reject(error);
        return;
      }
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      if (!blob.size) {
        reject(new Error('voice_no_speech'));
        return;
      }
      resolve(blob);
    };

    try {
      recorder = new MediaRecorder(stream);
    } catch {
      stopMicrophoneCapture(stream);
      reject(new Error('audio_recording_unavailable'));
      return;
    }

    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    recorder.onerror = () => finish(new Error('audio_recording_failed'));
    recorder.onstop = () => finish();

    try {
      recorder.start();
      timer = window.setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, Math.max(1000, Math.min(10000, durationMs)));
    } catch {
      finish(new Error('audio_recording_failed'));
    }
  });
}

function audioContextConstructor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
}

export function detectPcmWavRecordingCapability(): AtlasCapabilityState {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return 'unavailable';
  return audioContextConstructor() ? 'ready' : 'unavailable';
}

function resampleMono(samples: Float32Array, inputRate: number, outputRate = 16000): Float32Array {
  if (!samples.length || inputRate <= 0 || outputRate <= 0) return new Float32Array();
  if (inputRate === outputRate) return samples;

  const ratio = inputRate / outputRate;
  const outputLength = Math.max(1, Math.floor(samples.length / ratio));
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.max(start + 1, Math.min(samples.length, Math.floor((index + 1) * ratio)));
    let sum = 0;
    for (let cursor = start; cursor < end; cursor += 1) sum += samples[cursor];
    output[index] = sum / Math.max(1, end - start);
  }

  return output;
}

export function encodePcm16Wav(samples: Float32Array, sampleRate = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (const raw of samples) {
    const sample = Math.max(-1, Math.min(1, raw));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function recordAssistantPcmWavChunk(durationMs = 4200): Promise<Blob> {
  if (detectPcmWavRecordingCapability() !== 'ready') throw new Error('audio_recording_unavailable');

  const AudioContextCtor = audioContextConstructor();
  if (!AudioContextCtor) throw new Error('audio_recording_unavailable');

  const stream = await requestMicrophoneCapture();
  const context = new AudioContextCtor();
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const mute = context.createGain();
  mute.gain.value = 0;

  const chunks: Float32Array[] = [];
  let settled = false;
  let timer = 0;

  return new Promise((resolve, reject) => {
    const finish = async (error?: Error) => {
      if (settled) return;
      settled = true;
      if (timer) window.clearTimeout(timer);

      processor.onaudioprocess = null;
      try { source.disconnect(); } catch {}
      try { processor.disconnect(); } catch {}
      try { mute.disconnect(); } catch {}
      stopMicrophoneCapture(stream);
      try { await context.close(); } catch {}

      if (error) {
        reject(error);
        return;
      }

      const total = chunks.reduce((count, chunk) => count + chunk.length, 0);
      if (!total) {
        reject(new Error('voice_no_speech'));
        return;
      }

      const combined = new Float32Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const resampled = resampleMono(combined, context.sampleRate, 16000);
      if (!resampled.length) {
        reject(new Error('voice_no_speech'));
        return;
      }
      resolve(encodePcm16Wav(resampled, 16000));
    };

    processor.onaudioprocess = (event) => {
      const channel = event.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(channel));
    };

    try {
      source.connect(processor);
      processor.connect(mute);
      mute.connect(context.destination);
      void context.resume();
      timer = window.setTimeout(() => void finish(), Math.max(1200, Math.min(8000, durationMs)));
    } catch {
      void finish(new Error('audio_recording_failed'));
    }
  });
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
