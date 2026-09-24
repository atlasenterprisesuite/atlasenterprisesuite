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
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const snapshotRef = useRef(snapshot);
  const submittedTurnIdRef = useRef<string | null>(null);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const Recognition = useMemo(() => window.SpeechRecognition ?? window.webkitSpeechRecognition, []);
  const supported = Boolean(Recognition);

  useEffect(() => {
    let cancelled = false;
    void getAssistantStatus()
      .then((status) => {
        if (cancelled) return;
        if (hasVerifiedAssistantProvider(status)) {
          const verified = status.providers?.filter((provider) => provider.verified).map((provider) => provider.id) || [];
          setIntelligenceState('ready');
          setProviderLabel(verified.length ? verified.join(', ') : status.provider || 'verified provider');
          return;
        }
        setIntelligenceState('unavailable');
        setProviderLabel('provider not verified');
      })
      .catch(() => {
        if (cancelled) return;
        setIntelligenceState('unavailable');
        setProviderLabel('provider unavailable');
      });

    return () => {
      cancelled = true;
    };
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
    if (window.speechSynthesis?.speaking) window.speechSynthesis.cancel();
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

  const promptText = turn?.finalTranscript || turn?.interimTranscript || 'Say what you need. ATLAS will show what it heard before taking action.';
  const responseText = turn?.responseText || (snapshot.state === 'responding'
    ? 'ATLAS is preparing a response…'
    : 'Your response will appear here after a verified turn.');
  const intelligenceLabel = intelligenceState === 'ready'
    ? providerLabel
    : intelligenceState === 'checking'
      ? 'Checking provider'
      : 'Provider unavailable';

  return (
    <section className={`voice-page voice-experience${embedded ? ' voice-page-embedded' : ''}`}>
      <div className="voice-experience-header">
        <div>
          <p className="eyebrow">ATLAS Voice Assistant</p>
          <h2>Talk to ATLAS</h2>
          <p>Tap once, speak naturally, and keep the conversation focused. ATLAS only executes after the transcript and provider checks pass.</p>
        </div>
        <span className="voice-private-pill"><span aria-hidden="true">●</span> Private voice turn</span>
      </div>

      <div className="voice-presence-bar" aria-label="Voice readiness">
        <span className={`voice-state voice-state-${snapshot.state}`}><i aria-hidden="true" />{visibleState}</span>
        <span className={`voice-intelligence-state voice-intelligence-${intelligenceState}`}>AI · {intelligenceLabel}</span>
        <span className={supported ? 'voice-device-state is-ready' : 'voice-device-state'}>{supported ? 'Mic ready' : 'Mic unavailable'}</span>
      </div>

      {!supported && (
        <div className="voice-inline-warning" role="status">
          <strong>Microphone transcription is unavailable in this browser.</strong>
          <span>ATLAS keeps the assistant and turn engine available, but voice input requires browser SpeechRecognition or a configured STT provider.</span>
        </div>
      )}

      <div className="voice-focus-stage">
        <div className="voice-focus-visual">
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

          <div className="voice-live-readout" role="status" aria-live="polite">
            <span className={`avatar-live-dot avatar-live-dot-${snapshot.state}`} aria-hidden="true" />
            <div>
              <strong>ATLAS // {visibleState.toUpperCase()}</strong>
              <small>{snapshot.state === 'listening'
                ? 'I’m listening. Tap the avatar when you are done.'
                : snapshot.state === 'speaking'
                  ? 'ATLAS is speaking. Tap the avatar to interrupt.'
                  : supported
                    ? 'Tap the avatar and speak.'
                    : 'Voice input is not available on this browser.'}</small>
            </div>
          </div>

          <div className={`avatar-waveform avatar-waveform-${snapshot.state}`} aria-hidden="true">
            {Array.from({ length: 18 }, (_, index) => <span key={index} />)}
          </div>
        </div>

        <div className="voice-conversation" aria-label="Current voice turn">
          <article className="voice-turn-card voice-turn-user">
            <div className="voice-turn-label"><span>You</span><small>{turn?.confidence !== undefined ? `${Math.round(turn.confidence * 100)}% confidence` : 'Microphone'}</small></div>
            <p className={turn?.finalTranscript || turn?.interimTranscript ? '' : 'is-placeholder'}>{promptText}</p>
          </article>

          <article className="voice-turn-card voice-turn-atlas">
            <div className="voice-turn-label"><span>ATLAS</span><small>{intelligenceState === 'ready' ? 'Verified intelligence' : 'Waiting for provider'}</small></div>
            <p className={turn?.responseText || snapshot.state === 'responding' ? '' : 'is-placeholder'}>{responseText}</p>
          </article>

          <div className="voice-message voice-message-quiet" role="status" aria-live="polite">{message}</div>
        </div>
      </div>

      <div className="voice-action-dock" aria-label="Voice controls">
        {snapshot.state !== 'listening' && snapshot.state !== 'speaking' ? (
          <button type="button" className="voice-primary" onClick={startListening} disabled={!supported || avatarBusy}>
            <span className="voice-control-icon" aria-hidden="true">●</span>
            Start voice turn
          </button>
        ) : null}
        {snapshot.state === 'listening' ? (
          <button type="button" className="voice-primary is-listening" onClick={stopListening}>
            <span className="voice-control-icon" aria-hidden="true">■</span>
            Finish listening
          </button>
        ) : null}
        {snapshot.state === 'speaking' ? (
          <button type="button" className="voice-primary is-speaking" onClick={interrupt}>
            <span className="voice-control-icon" aria-hidden="true">↺</span>
            Interrupt & listen
          </button>
        ) : null}
        <span className="voice-action-hint">Or tap the ATLAS avatar</span>
      </div>

      <details className="voice-diagnostics">
        <summary>
          <span>Voice diagnostics</span>
          <small>Session {snapshot.sessionId.slice(0, 8)} · Turn {snapshot.sequence}</small>
        </summary>
        <div className="voice-diagnostics-grid">
          <div><span>State</span><strong>{visibleState}</strong></div>
          <div><span>Intelligence</span><strong>{intelligenceLabel}</strong></div>
          <div><span>Source</span><strong>{turn?.source ?? '—'}</strong></div>
          <div><span>Turn ID</span><strong>{turn?.id ?? '—'}</strong></div>
        </div>
        <div className="voice-rules">
          <strong>Loop protections</strong>
          <span>one response per turn</span>
          <span>duplicate transcript suppression</span>
          <span>duplicate response suppression</span>
          <span>ATLAS TTS excluded from input</span>
          <span>barge-in opens a new turn</span>
          <span>low-confidence transcripts blocked</span>
          <span>unverified AI fails closed</span>
        </div>
      </details>
    </section>
  );
}
