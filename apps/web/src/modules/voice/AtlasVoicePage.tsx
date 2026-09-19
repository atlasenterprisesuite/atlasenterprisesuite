import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAssistantStatus, hasVerifiedAssistantProvider, sendAssistantMessage } from '../../assistant/client';
import {
  acceptFinalTranscript,
  attachResponse,
  beginTurn,
  commitTranscript,
  createInitialSnapshot,
  interruptSpeaking,
  setInterimTranscript,
  transition,
  type TurnEngineSnapshot
} from './turnEngine';
import { resolveVoiceNavigationCommand } from './voiceActions';
import { evaluateVoiceActionProposal, navigationVoiceAction } from './voiceActionBus';
import { createAtlasRealtimeSession, isAtlasRealtimeSupported, type AtlasRealtimeEvent, type AtlasRealtimeSession } from './realtimeClient';
import './voice.css';

type RecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string; confidence?: number } }>;
};

type RecognitionLike = {
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

type RecognitionConstructor = new () => RecognitionLike;
type IntelligenceState = 'checking' | 'ready' | 'unavailable';
type RealtimeState = 'checking' | 'unsupported' | 'disabled' | 'ready' | 'connecting' | 'connected' | 'error';

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  }
}

function stateLabel(state: TurnEngineSnapshot['state']) {
  return {
    idle: 'Ready',
    listening: 'Listening',
    transcribing: 'Transcribing',
    understanding: 'Understanding',
    responding: 'Thinking',
    speaking: 'Speaking',
    completed: 'Completed',
    cancelled: 'Cancelled',
    error: 'Error'
  }[state];
}

function avatarActionLabel(state: TurnEngineSnapshot['state']) {
  if (state === 'listening') return 'Stop listening with ATLAS';
  if (state === 'speaking') return 'Interrupt ATLAS and start listening';
  return 'Start speaking with ATLAS';
}

export function AtlasVoicePage({ embedded = false }: { embedded?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState(() => createInitialSnapshot());
  const [message, setMessage] = useState('Press Start and speak. ATLAS will show exactly what it heard before any action or AI response executes.');
  const [intelligenceState, setIntelligenceState] = useState<IntelligenceState>('checking');
  const [providerLabel, setProviderLabel] = useState('checking');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [realtimeState, setRealtimeState] = useState<RealtimeState>('checking');
  const [realtimeModel, setRealtimeModel] = useState<string | null>(null);
  const [realtimeInput, setRealtimeInput] = useState('');
  const [realtimeOutput, setRealtimeOutput] = useState('');
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const realtimeRef = useRef<AtlasRealtimeSession | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const snapshotRef = useRef(snapshot);
  const submittedTurnIdRef = useRef<string | null>(null);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const Recognition = useMemo(() => window.SpeechRecognition ?? window.webkitSpeechRecognition, []);
  const supported = Boolean(Recognition);
  const realtimeSupported = useMemo(() => isAtlasRealtimeSupported(), []);

  useEffect(() => {
    let cancelled = false;
    void getAssistantStatus()
      .then((status) => {
        if (cancelled) return;

        if (hasVerifiedAssistantProvider(status)) {
          const verified = status.providers?.filter((provider) => provider.verified).map((provider) => provider.id) || [];
          setIntelligenceState('ready');
          setProviderLabel(verified.length ? verified.join(', ') : status.provider || 'verified provider');
        } else {
          setIntelligenceState('unavailable');
          setProviderLabel('provider not verified');
        }

        setRealtimeModel(status.realtime?.model || null);
        if (!realtimeSupported) {
          setRealtimeState('unsupported');
        } else {
          setRealtimeState(status.realtime?.enabled ? 'ready' : 'disabled');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setIntelligenceState('unavailable');
        setProviderLabel('provider unavailable');
        setRealtimeState(realtimeSupported ? 'disabled' : 'unsupported');
      });

    return () => {
      cancelled = true;
    };
  }, [realtimeSupported]);

  useEffect(() => () => {
    realtimeRef.current?.close();
    realtimeRef.current = null;
  }, []);

  const completeSpeaking = useCallback((completionMessage: string, onComplete?: () => void) => {
    const next = {
      ...snapshotRef.current,
      state: 'completed' as const,
      activeTurn: snapshotRef.current.activeTurn
        ? { ...snapshotRef.current.activeTurn, state: 'completed' as const }
        : undefined
    };
    snapshotRef.current = next;
    setSnapshot(next);
    setMessage(completionMessage);
    onComplete?.();
  }, []);

  const speakControlled = useCallback((text: string, onComplete?: () => void) => {
    recognitionRef.current?.abort();
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      completeSpeaking('Response completed as text. Speech output is unavailable in this browser.', onComplete);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = navigator.language || 'es-US';
    utterance.onend = () => completeSpeaking('Response completed. ATLAS is ready for the next turn.', onComplete);
    utterance.onerror = () => completeSpeaking('Response is available as text, but speech playback failed.', onComplete);
    window.speechSynthesis.speak(utterance);
  }, [completeSpeaking]);

  const processTurn = useCallback(async (turnId: string, transcript: string) => {
    const current = snapshotRef.current;
    if (current.activeTurn?.id !== turnId || current.state !== 'understanding') return;
    if (submittedTurnIdRef.current === turnId) return;

    const navigationAction = resolveVoiceNavigationCommand(transcript);
    if (navigationAction) {
      const policy = evaluateVoiceActionProposal(navigationVoiceAction(navigationAction));
      if (policy.outcome !== 'allow') {
        setMessage(`Voice action blocked by policy: ${policy.reason.replaceAll('_', ' ')}.`);
        return;
      }
      submittedTurnIdRef.current = turnId;
      const responding = transition(current, 'responding');
      const withResponse = attachResponse(responding, navigationAction.confirmation);
      snapshotRef.current = withResponse;
      setSnapshot(withResponse);
      setMessage(`Safe local action verified. Opening ${navigationAction.label}.`);
      speakControlled(navigationAction.confirmation, () => navigate(navigationAction.route));
      return;
    }

    if (intelligenceState === 'checking') {
      setMessage('ATLAS is verifying an Intelligence provider before sending this voice turn.');
      return;
    }

    if (intelligenceState !== 'ready') {
      const failed = {
        ...current,
        state: 'error' as const,
        activeTurn: current.activeTurn ? { ...current.activeTurn, state: 'error' as const } : undefined
      };
      snapshotRef.current = failed;
      setSnapshot(failed);
      setMessage('No verified ATLAS Intelligence provider is available. The transcript was not sent.');
      return;
    }

    submittedTurnIdRef.current = turnId;
    const responding = transition(current, 'responding');
    snapshotRef.current = responding;
    setSnapshot(responding);
    setMessage('Transcript accepted. ATLAS Intelligence is processing the turn.');

    try {
      const response = await sendAssistantMessage({
        message: transcript,
        pathname: location.pathname,
        conversationId,
        modality: 'voice'
      });

      if (snapshotRef.current.activeTurn?.id !== turnId) return;
      if (response.conversation_id) setConversationId(response.conversation_id);

      const withResponse = attachResponse(snapshotRef.current, response.text);
      snapshotRef.current = withResponse;
      setSnapshot(withResponse);
      setMessage(`Response received from ${response.provider || providerLabel}. Speaking now.`);
      speakControlled(response.text);
    } catch (cause) {
      if (snapshotRef.current.activeTurn?.id !== turnId) return;
      const failed = {
        ...snapshotRef.current,
        state: 'error' as const,
        activeTurn: snapshotRef.current.activeTurn
          ? { ...snapshotRef.current.activeTurn, state: 'error' as const }
          : undefined
      };
      snapshotRef.current = failed;
      setSnapshot(failed);
      setMessage(cause instanceof Error ? `ATLAS Intelligence error: ${cause.message}` : 'ATLAS Intelligence could not complete this voice turn.');
    }
  }, [conversationId, intelligenceState, location.pathname, navigate, providerLabel, speakControlled]);

  const handleRealtimeEvent = useCallback((event: AtlasRealtimeEvent) => {
    if (event.type === 'conversation.item.input_audio_transcription.completed') {
      const transcript = typeof event.transcript === 'string' ? event.transcript.trim() : '';
      if (!transcript) return;
      setRealtimeInput(transcript);

      const navigationAction = resolveVoiceNavigationCommand(transcript);
      if (!navigationAction) return;
      const policy = evaluateVoiceActionProposal(navigationVoiceAction(navigationAction));
      if (policy.outcome !== 'allow') {
        realtimeRef.current?.interrupt();
        setMessage(`Realtime action blocked by policy: ${policy.reason.replaceAll('_', ' ')}.`);
        return;
      }

      realtimeRef.current?.interrupt();
      setMessage(`Realtime safe action verified. Opening ${navigationAction.label}.`);
      navigate(navigationAction.route);
      return;
    }

    if (event.type === 'response.output_audio_transcript.delta' && typeof event.delta === 'string') {
      setRealtimeOutput((current) => current + event.delta);
      return;
    }

    if (event.type === 'response.output_audio_transcript.done' && typeof event.transcript === 'string') {
      setRealtimeOutput(event.transcript);
      return;
    }

    if (event.type === 'error') {
      setRealtimeState('error');
      setMessage('Realtime provider reported an error. Guarded turn mode remains available.');
    }
  }, [navigate]);

  const startRealtime = useCallback(async () => {
    if (!realtimeSupported || realtimeState !== 'ready') return;
    recognitionRef.current?.abort();
    window.speechSynthesis?.cancel();
    setRealtimeInput('');
    setRealtimeOutput('');
    setRealtimeState('connecting');
    setMessage('Establishing authenticated ATLAS Realtime WebRTC session…');

    try {
      const session = await createAtlasRealtimeSession({
        pathname: location.pathname,
        onState: (state) => {
          if (state === 'connected') {
            setRealtimeState('connected');
            setMessage('ATLAS Realtime connected. Speak naturally; interruption is available at any time.');
          } else if (state === 'connecting') {
            setRealtimeState('connecting');
          } else if (state === 'error') {
            setRealtimeState('error');
          } else if (state === 'closed') {
            setRealtimeState('ready');
          }
        },
        onEvent: handleRealtimeEvent,
        onRemoteStream: (stream) => {
          if (!remoteAudioRef.current) return;
          remoteAudioRef.current.srcObject = stream;
          void remoteAudioRef.current.play().catch(() => undefined);
        }
      });
      realtimeRef.current = session;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = session.remoteStream;
        void remoteAudioRef.current.play().catch(() => undefined);
      }
    } catch (cause) {
      realtimeRef.current = null;
      setRealtimeState('error');
      setMessage(cause instanceof Error
        ? `Realtime unavailable: ${cause.message}. Guarded turn mode remains available.`
        : 'Realtime unavailable. Guarded turn mode remains available.');
    }
  }, [handleRealtimeEvent, location.pathname, realtimeState, realtimeSupported]);

  const stopRealtime = useCallback(() => {
    realtimeRef.current?.close();
    realtimeRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    setRealtimeState(realtimeSupported ? 'ready' : 'unsupported');
    setMessage('Realtime session closed. Guarded turn mode remains available.');
  }, [realtimeSupported]);

  const interruptRealtime = useCallback(() => {
    realtimeRef.current?.interrupt();
    setMessage('ATLAS Realtime response interrupted. You can continue speaking.');
  }, []);

  useEffect(() => {
    const turn = snapshot.activeTurn;
    if (snapshot.state !== 'understanding' || !turn?.finalTranscript) return;
    void processTurn(turn.id, turn.finalTranscript);
  }, [processTurn, snapshot.activeTurn, snapshot.state]);

  useEffect(() => {
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'es-US';

    recognition.onstart = () => setMessage('Microphone open. Speak naturally.');
    recognition.onerror = (event) => {
      setMessage(`Speech recognition error: ${event.error}`);
      const failed = {
        ...snapshotRef.current,
        state: 'error' as const,
        activeTurn: snapshotRef.current.activeTurn
          ? { ...snapshotRef.current.activeTurn, state: 'error' as const }
          : undefined
      };
      snapshotRef.current = failed;
      setSnapshot(failed);
    };
    recognition.onend = () => {
      if (snapshotRef.current.state === 'listening') {
        setMessage('Listening stopped before a final transcript. Start another turn.');
      }
    };
    recognition.onresult = (event) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? '';
        if (!result.isFinal) {
          interim += transcript;
          continue;
        }

        const current = snapshotRef.current;
        const decision = acceptFinalTranscript(current, transcript, result[0]?.confidence);
        if (!decision.accepted) {
          setMessage(`Turn blocked: ${decision.reason.replaceAll('_', ' ')}.`);
          return;
        }

        const committed = commitTranscript(current, decision);
        snapshotRef.current = committed;
        setSnapshot(committed);
        setMessage('Transcript accepted. ATLAS is deciding whether this is a safe local action or an Intelligence request.');
      }
      if (interim) {
        const next = setInterimTranscript(snapshotRef.current, interim);
        snapshotRef.current = next;
        setSnapshot(next);
      }
    };

    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, [Recognition]);

  function startListening() {
    if (!recognitionRef.current) return;
    if (realtimeRef.current) stopRealtime();
    if (window.speechSynthesis?.speaking) window.speechSynthesis.cancel();
    setRealtimeInput('');
    setRealtimeOutput('');
    submittedTurnIdRef.current = null;
    const next = snapshotRef.current.state === 'speaking'
      ? interruptSpeaking(snapshotRef.current)
      : beginTurn(snapshotRef.current);
    snapshotRef.current = next;
    setSnapshot(next);
    setMessage('Opening microphone...');
    recognitionRef.current.start();
  }

  function stopListening() {
    const current = snapshotRef.current;
    if (current.state === 'listening') {
      const next = transition(current, 'cancelled');
      snapshotRef.current = next;
      setSnapshot(next);
    }
    recognitionRef.current?.stop();
    setMessage('Microphone closed. Start a new turn whenever you are ready.');
  }

  function interrupt() {
    window.speechSynthesis?.cancel();
    recognitionRef.current?.abort();
    const current = snapshotRef.current;
    const next = current.state === 'speaking' ? interruptSpeaking(current) : beginTurn(current);
    submittedTurnIdRef.current = null;
    snapshotRef.current = next;
    setSnapshot(next);
    setMessage('ATLAS speech interrupted. New user turn opened.');
    recognitionRef.current?.start();
  }

  function activateAvatar() {
    if (!supported) return;
    if (snapshot.state === 'listening') {
      stopListening();
      return;
    }
    if (snapshot.state === 'speaking') {
      interrupt();
      return;
    }
    startListening();
  }

  const turn = snapshot.activeTurn;
  const avatarBusy = snapshot.state === 'transcribing' || snapshot.state === 'understanding' || snapshot.state === 'responding';
  const visibleState = stateLabel(snapshot.state);

  return (
    <section className={`voice-page page-stack${embedded ? ' voice-page-embedded' : ''}`}>
      {!embedded && (
        <header className="page-header">
          <p className="eyebrow">ATLAS Voice</p>
          <h1>Voice Assistant</h1>
          <p>Guarded speech turns can execute safe local navigation or use the verified ATLAS Intelligence backend for conversational responses.</p>
        </header>
      )}

      <div className="voice-status-row">
        <span className={`voice-state voice-state-${snapshot.state}`}>{visibleState}</span>
        <span>Intelligence: {intelligenceState === 'ready' ? providerLabel : intelligenceState}</span>
        <span>Realtime: {realtimeState}{realtimeModel ? ` · ${realtimeModel}` : ''}</span>
        <span>Session {snapshot.sessionId.slice(0, 8)}</span>
        <span>Turn {snapshot.sequence}</span>
      </div>

      {!supported && (
        <div className="notice strong">{realtimeSupported
          ? 'This browser does not expose SpeechRecognition, but authenticated WebRTC Realtime can still provide native audio conversation when enabled by ATLAS policy.'
          : 'This browser does not expose SpeechRecognition or the required WebRTC microphone APIs. Text Assistant remains available.'}</div>
      )}

      <div className="voice-stage-grid">
        <article className="atlas-avatar-console" aria-label="ATLAS AI avatar console">
          <button
            type="button"
            className={`atlas-avatar atlas-avatar-${snapshot.state}`}
            data-state={snapshot.state}
            aria-label={avatarActionLabel(snapshot.state)}
            onClick={activateAvatar}
            disabled={!supported || avatarBusy}
          >
            <span className="avatar-orbit avatar-orbit-one" aria-hidden="true" />
            <span className="avatar-orbit avatar-orbit-two" aria-hidden="true" />
            <span className="avatar-glow" aria-hidden="true" />
            <img src="/atlas-avatar-particle.svg" alt="" draggable={false} />
            <span className="avatar-scanline" aria-hidden="true" />
            <span className="avatar-state-ring" aria-hidden="true" />
          </button>

          <div className="avatar-readout" role="status" aria-live="polite">
            <span className={`avatar-live-dot avatar-live-dot-${snapshot.state}`} aria-hidden="true" />
            <strong>ATLAS // {visibleState.toUpperCase()}</strong>
            <small>{supported ? 'Tap the avatar to control the microphone.' : 'Voice recognition unavailable in this browser.'}</small>
          </div>

          <div className={`avatar-waveform avatar-waveform-${snapshot.state}`} aria-hidden="true">
            {Array.from({ length: 14 }, (_, index) => <span key={index} />)}
          </div>
        </article>

        <div className="voice-console">
          <article className="voice-panel transcript-panel">
            <p className="eyebrow">What ATLAS heard</p>
            <div className="voice-transcript final">{realtimeInput || turn?.finalTranscript || 'No final transcript yet.'}</div>
            {!realtimeInput && turn?.interimTranscript && !turn.finalTranscript && <div className="voice-transcript interim">{turn.interimTranscript}</div>}
            <dl>
              <div><dt>Turn ID</dt><dd>{turn?.id ?? '-'}</dd></div>
              <div><dt>Confidence</dt><dd>{turn?.confidence !== undefined ? `${Math.round(turn.confidence * 100)}%` : '-'}</dd></div>
              <div><dt>Source</dt><dd>{turn?.source ?? '-'}</dd></div>
            </dl>
          </article>

          <article className="voice-panel response-panel">
            <p className="eyebrow">ATLAS response</p>
            <div className="voice-transcript final">{realtimeOutput || turn?.responseText || 'No response generated.'}</div>
            <p className="voice-help">Commands such as “ATLAS abre nómina” and “Hey ATLAS open Health” resolve locally to approved routes. Other turns use the authenticated ATLAS Intelligence provider only when verification passes.</p>
          </article>
        </div>
      </div>

      <audio ref={remoteAudioRef} autoPlay aria-hidden="true" />

      <div className="voice-controls">
        <button type="button" className="voice-primary" onClick={startRealtime} disabled={!realtimeSupported || realtimeState !== 'ready'}>Start realtime</button>
        <button type="button" onClick={stopRealtime} disabled={!['connecting', 'connected', 'error'].includes(realtimeState)}>End realtime</button>
        <button type="button" onClick={interruptRealtime} disabled={realtimeState !== 'connected'}>Interrupt realtime</button>
        <button type="button" onClick={startListening} disabled={!supported || snapshot.state === 'listening' || avatarBusy}>Start guarded turn</button>
        <button type="button" onClick={stopListening} disabled={!supported || snapshot.state !== 'listening'}>Stop guarded turn</button>
        <button type="button" onClick={interrupt} disabled={!supported || snapshot.state !== 'speaking'}>Interrupt guarded response</button>
      </div>

      <div className="voice-message" role="status" aria-live="polite">{message}</div>

      <div className="voice-rules">
        <strong>Loop protections active</strong>
        <span>one response per turn ID</span>
        <span>duplicate transcript suppression</span>
        <span>duplicate response suppression</span>
        <span>ATLAS TTS excluded from user input</span>
        <span>barge-in opens a fresh turn</span>
        <span>low-confidence final transcripts are blocked</span>
        <span>unverified AI providers fail closed</span>
        <span>Realtime API key remains server-side</span>
        <span>paid Realtime calls require explicit server authorization</span>
        <span>sensitive actions route to ATLAS policy and Approval Center</span>
      </div>
    </section>
  );
}
