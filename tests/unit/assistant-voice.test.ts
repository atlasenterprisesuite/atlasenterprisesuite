import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  detectMicrophoneCapability,
  detectSpeechOutputCapability,
  requestMicrophoneCapture,
  stopMicrophoneCapture
} from '../../apps/web/src/assistant/voice';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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
});
