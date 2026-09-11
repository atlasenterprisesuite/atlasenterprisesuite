import { useCallback, useEffect, useRef, useState } from 'react';
import type { AtlasCapabilityState } from './types';
import { readSpeechPreference, writeSpeechPreference } from './storage';
import {
  detectMicrophoneCapability,
  detectSpeechOutputCapability,
  requestMicrophoneCapture,
  speakAssistantText,
  stopMicrophoneCapture
} from './voice';

export function useAssistantVoice() {
  const [microphoneCapability, setMicrophoneCapability] = useState<AtlasCapabilityState>('unavailable');
  const [speechCapability, setSpeechCapability] = useState<AtlasCapabilityState>(() => detectSpeechOutputCapability());
  const [speechEnabled, setSpeechEnabledState] = useState(() => readSpeechPreference());
  const [microphoneActive, setMicrophoneActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    void detectMicrophoneCapability().then((state) => {
      if (!cancelled) setMicrophoneCapability(state);
    });
    setSpeechCapability(detectSpeechOutputCapability());
    return () => {
      cancelled = true;
      stopMicrophoneCapture(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  const setSpeechEnabled = useCallback((enabled: boolean) => {
    writeSpeechPreference(enabled);
    setSpeechEnabledState(enabled);
  }, []);

  const startMicrophone = useCallback(async () => {
    if (streamRef.current) return;
    const stream = await requestMicrophoneCapture();
    streamRef.current = stream;
    setMicrophoneCapability('ready');
    setMicrophoneActive(true);
  }, []);

  const stopMicrophone = useCallback(() => {
    stopMicrophoneCapture(streamRef.current);
    streamRef.current = null;
    setMicrophoneActive(false);
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!speechEnabled) return false;
    if (speechCapability !== 'ready') throw new Error('speech_unavailable');
    await speakAssistantText(text);
    return true;
  }, [speechCapability, speechEnabled]);

  return {
    microphoneCapability,
    microphoneActive,
    speechCapability,
    speechEnabled,
    setSpeechEnabled,
    startMicrophone,
    stopMicrophone,
    speak
  };
}
