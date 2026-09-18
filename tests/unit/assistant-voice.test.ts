import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAssistantSpeechRecognition,
  detectMicrophoneCapability,
  detectSpeechOutputCapability,
  detectSpeechRecognitionCapability,
  requestMicrophoneCapture,
  speechRecognitionErrorCode,
  stopMicrophoneCapture
} from '../../apps/web/src/assistant/voice';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (window as any).SpeechRecognition;
  delete (window as any).webkitSpeechRecognition;
});

describe('ATLAS Assistant browser voice primitives', () => {
  it('reports microphone unavailable without getUserMedia', async () => {
    vi.stubGlobal('navigator', { mediaDevices: undefined, permissions: undefined });
    await expect(detectMicrophoneCapability()).resolves.toBe('unavailable');
  });

  it('reports microphone ready only when permission is granted', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn() },
      permissions: { query: vi.fn().mockResolvedValue({ state: 'granted' }) }
    });
    await expect(detectMicrophoneCapability()).resolves.toBe('ready');
  });

  it('maps denied getUserMedia to an explicit permission error', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')) }
    });
    await expect(requestMicrophoneCapture()).rejects.toThrow('microphone_permission_denied');
  });

  it('stops every media track during cleanup', () => {
    const stopA = vi.fn();
    const stopB = vi.fn();
    const stream = { getTracks: () => [{ stop: stopA }, { stop: stopB }] } as unknown as MediaStream;
    stopMicrophoneCapture(stream);
    expect(stopA).toHaveBeenCalledOnce();
    expect(stopB).toHaveBeenCalledOnce();
  });

  it('does not claim speech output when browser speech synthesis is absent', () => {
    vi.stubGlobal('SpeechSynthesisUtterance', undefined);
    expect(detectSpeechOutputCapability()).toBe('unavailable');
  });

  it('reports browser speech recognition only when a constructor exists', () => {
    expect(detectSpeechRecognitionCapability()).toBe('unavailable');
    (window as any).webkitSpeechRecognition = class {};
    expect(detectSpeechRecognitionCapability()).toBe('ready');
  });

  it('emits one final recognized utterance through the shared bridge', () => {
    const onFinal = vi.fn();
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = '';
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onresult: ((event: any) => void) | null = null;
      start() {
        this.onstart?.();
        this.onresult?.({
          resultIndex: 0,
          results: [{ isFinal: true, 0: { transcript: 'Review my dashboard', confidence: 0.92 } }]
        });
      }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    (window as any).SpeechRecognition = FakeRecognition;

    const recognition = createAssistantSpeechRecognition({
      onFinal,
      onError: vi.fn()
    });

    expect(recognition).not.toBeNull();
    recognition?.start();
    expect(onFinal).toHaveBeenCalledWith({ transcript: 'Review my dashboard', confidence: 0.92 });
  });

  it('maps browser recognition errors to stable ATLAS error codes', () => {
    expect(speechRecognitionErrorCode('not-allowed')).toBe('microphone_permission_denied');
    expect(speechRecognitionErrorCode('no-speech')).toBe('voice_no_speech');
    expect(speechRecognitionErrorCode('network')).toBe('voice_transcription_unavailable');
    expect(speechRecognitionErrorCode('other')).toBe('voice_transcription_failed');
  });
});
