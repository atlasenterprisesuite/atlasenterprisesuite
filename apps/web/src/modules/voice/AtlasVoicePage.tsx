import { useEffect, useMemo, useRef, useState } from 'react';
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
    responding: 'Awaiting brain',
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
  const [snapshot, setSnapshot] = useState(() => createInitialSnapshot());
  const [message, setMessage] = useState('Press Start and speak. ATLAS will show exactly what it heard before a response is allowed.');
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const snapshotRef = useRef(snapshot);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const Recognition = useMemo(() => window.SpeechRecognition ?? window.webkitSpeechRecognition, []);
  const supported = Boolean(Recognition);

  useEffect(() => {
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'es-US';

    recognition.onstart = () => setMessage('Microphone open. Speak naturally.');
    recognition.onerror = (event) => {
      setMessage(`Speech recognition error: ${event.error}`);
      setSnapshot((current) => ({ ...current, state: 'error' }));
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
        setMessage('Transcript accepted. It is now safe to send this turn to the ChatGPT brain.');
      }
      if (interim) setSnapshot((current) => setInterimTranscript(current, interim));
    };

    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, [Recognition]);

  function startListening() {
    if (!recognitionRef.current) return;
    if (window.speechSynthesis?.speaking) window.speechSynthesis.cancel();
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

  function testResponse() {
    const current = snapshotRef.current;
    if (!current.activeTurn?.finalTranscript) {
      setMessage('No accepted transcript exists for this turn.');
      return;
    }

    const response = `I understood: ${current.activeTurn.finalTranscript}`;
    try {
      const next = attachResponse({ ...current, state: 'responding' }, response);
      snapshotRef.current = next;
      setSnapshot(next);
      setMessage('Loop guard passed. Playing one controlled test response.');

      recognitionRef.current?.abort();
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(response);
      utterance.lang = navigator.language || 'es-US';
      utterance.onend = () => {
        setSnapshot((state) => ({ ...state, state: 'completed', activeTurn: state.activeTurn ? { ...state.activeTurn, state: 'completed' } : undefined }));
        setMessage('Response completed. ATLAS is not listening to its own voice. Start the next turn when ready.');
      };
      speechRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Response guard blocked the output.');
    }
  }

  function interrupt() {
    window.speechSynthesis.cancel();
    recognitionRef.current?.abort();
    const current = snapshotRef.current;
    const next = current.state === 'speaking' ? interruptSpeaking(current) : beginTurn(current);
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
          <h1>Voice Turn Engine</h1>
          <p>Speech is converted into a visible, guarded transcript before any AI response can execute.</p>
        </header>
      )}

      <div className="voice-status-row">
        <span className={`voice-state voice-state-${snapshot.state}`}>{visibleState}</span>
        <span>Session {snapshot.sessionId.slice(0, 8)}</span>
        <span>Turn {snapshot.sequence}</span>
      </div>

      {!supported && (
        <div className="notice strong">This browser does not expose SpeechRecognition. The turn engine is available, but microphone transcription needs a configured STT provider or a supported browser.</div>
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
            <div className="voice-transcript final">{turn?.finalTranscript || 'No final transcript yet.'}</div>
            {turn?.interimTranscript && !turn.finalTranscript && <div className="voice-transcript interim">{turn.interimTranscript}</div>}
            <dl>
              <div><dt>Turn ID</dt><dd>{turn?.id ?? '-'}</dd></div>
              <div><dt>Confidence</dt><dd>{turn?.confidence !== undefined ? `${Math.round(turn.confidence * 100)}%` : '-'}</dd></div>
              <div><dt>Source</dt><dd>{turn?.source ?? '-'}</dd></div>
            </dl>
          </article>

          <article className="voice-panel response-panel">
            <p className="eyebrow">ATLAS response</p>
            <div className="voice-transcript final">{turn?.responseText || 'No response generated.'}</div>
            <p className="voice-help">The current test response proves turn isolation and TTS gating. A live ChatGPT provider is intentionally not faked.</p>
          </article>
        </div>
      </div>

      <div className="voice-controls">
        <button type="button" className="voice-primary" onClick={startListening} disabled={!supported || snapshot.state === 'listening' || avatarBusy}>Start speaking</button>
        <button type="button" onClick={stopListening} disabled={!supported || snapshot.state !== 'listening'}>Stop</button>
        <button type="button" onClick={testResponse} disabled={!turn?.finalTranscript}>Run guarded response</button>
        <button type="button" onClick={interrupt} disabled={!supported || snapshot.state !== 'speaking'}>Interrupt ATLAS</button>
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
      </div>
    </section>
  );
}
