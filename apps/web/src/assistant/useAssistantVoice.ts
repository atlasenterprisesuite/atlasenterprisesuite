import { useCallback, useEffect, useRef, useState } from 'react';
import type { AtlasCapabilityState } from './types';
import { readSpeechPreference, writeSpeechPreference } from './storage';
import {
  createAssistantSpeechRecognition,
  detectMicrophoneCapability,
  detectSpeechOutputCapability,
  detectSpeechRecognitionCapability,
  requestMicrophoneCapture,
  speakAssistantText,
  stopAssistantSpeech,
  stopMicrophoneCapture,
  type AssistantRecognitionController
} from './voice';

export function useAssistantVoice() {
  const [microphoneCapability, setMicrophoneCapability] = useState<AtlasCapabilityState>('unavailable');
  const [transcriptionCapability, setTranscriptionCapability] = useState<AtlasCapabilityState>(() => detectSpeechRecognitionCapability());
  const [speechCapability, setSpeechCapability] = useState<AtlasCapabilityState>(() => detectSpeechOutputCapability());
  const [speechEnabled, setSpeechEnabledState] = useState(() => readSpeechPreference());
  const [microphoneActive, setMicrophoneActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<AssistantRecognitionController | null>(null);

  useEffect(() => {
    let cancelled = false;
    void detectMicrophoneCapability().then((state) => {
      if (!cancelled) setMicrophoneCapability(state);
    });
    setTranscriptionCapability(detectSpeechRecognitionCapability());
    setSpeechCapability(detectSpeechOutputCapability());
    return () => {
      cancelled = true;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      stopMicrophoneCapture(streamRef.current);
      streamRef.current = null;
      stopAssistantSpeech();
    };
  }, []);

  const setSpeechEnabled = useCallback((enabled: boolean) => {
    writeSpeechPreference(enabled);
    setSpeechEnabledState(enabled);
    if (!enabled) stopAssistantSpeech();
  }, []);

  const startMicrophone = useCallback(async () => {
    if (streamRef.current) return;
    const stream = await requestMicrophoneCapture();
    streamRef.current = stream;
    setMicrophoneCapability('ready');
    setMicrophoneActive(true);
  }, []);

  const startVoiceTurn = useCallback((
    onFinal: (transcript: string, confidence?: number) => void,
    onError?: (error: Error) => void
  ) => {
    if (transcriptionCapability !== 'ready') {
      return Promise.reject(new Error('voice_transcription_unavailable'));
    }

    recognitionRef.current?.abort();
    recognitionRef.current = null;
    stopAssistantSpeech();

    return new Promise<void>((resolve, reject) => {
      let started = false;
      const recognition = createAssistantSpeechRecognition({
        onStart: () => {
          started = true;
          setMicrophoneActive(true);
          resolve();
        },
        onEnd: () => {
          setMicrophoneActive(false);
          recognitionRef.current = null;
        },
        onFinal: (result) => {
          setMicrophoneActive(false);
          recognitionRef.current = null;
          onFinal(result.transcript, result.confidence);
        },
        onError: (error) => {
          setMicrophoneActive(false);
          recognitionRef.current = null;
          if (started) onError?.(error);
          else reject(error);
        }
      });

      if (!recognition) {
        reject(new Error('voice_transcription_unavailable'));
        return;
      }

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        recognitionRef.current = null;
        setMicrophoneActive(false);
        reject(new Error('voice_transcription_failed'));
      }
    });
  }, [transcriptionCapability]);

  const stopMicrophone = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    stopMicrophoneCapture(streamRef.current);
    streamRef.current = null;
    setMicrophoneActive(false);
  }, []);

  const stopSpeech = useCallback(() => {
    stopAssistantSpeech();
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
    transcriptionCapability,
    speechCapability,
    speechEnabled,
    setSpeechEnabled,
    startMicrophone,
    startVoiceTurn,
    stopMicrophone,
    stopSpeech,
    speak
  };
}
