export type VoiceState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'understanding'
  | 'responding'
  | 'speaking'
  | 'completed'
  | 'cancelled'
  | 'error';

export type TranscriptSource = 'microphone' | 'atlas-tts';

export interface VoiceTurn {
  id: string;
  sessionId: string;
  sequence: number;
  startedAt: number;
  state: VoiceState;
  source: TranscriptSource;
  interimTranscript: string;
  finalTranscript: string;
  confidence?: number;
  responseText?: string;
  responseFingerprint?: string;
}

export interface TurnEngineSnapshot {
  sessionId: string;
  sequence: number;
  state: VoiceState;
  activeTurn?: VoiceTurn;
  lastProcessedTranscriptFingerprint?: string;
  lastResponseFingerprint?: string;
  processedTurnIds: string[];
}

export type TranscriptDecision =
  | { accepted: true; turn: VoiceTurn; fingerprint: string }
  | { accepted: false; reason: 'empty' | 'self_audio' | 'duplicate_turn' | 'duplicate_transcript' | 'low_confidence' };

const allowedTransitions: Record<VoiceState, VoiceState[]> = {
  idle: ['listening'],
  listening: ['transcribing', 'cancelled', 'error'],
  transcribing: ['understanding', 'listening', 'cancelled', 'error'],
  understanding: ['responding', 'cancelled', 'error'],
  responding: ['speaking', 'completed', 'cancelled', 'error'],
  speaking: ['completed', 'listening', 'cancelled', 'error'],
  completed: ['listening'],
  cancelled: ['listening', 'idle'],
  error: ['listening', 'idle']
};

export function normalizeTranscript(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

export function fingerprint(value: string): string {
  const normalized = normalizeTranscript(value);
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createInitialSnapshot(sessionId = crypto.randomUUID()): TurnEngineSnapshot {
  return { sessionId, sequence: 0, state: 'idle', processedTurnIds: [] };
}

export function transition(snapshot: TurnEngineSnapshot, next: VoiceState): TurnEngineSnapshot {
  if (!allowedTransitions[snapshot.state].includes(next)) {
    throw new Error(`Invalid ATLAS Voice transition: ${snapshot.state} -> ${next}`);
  }
  return {
    ...snapshot,
    state: next,
    activeTurn: snapshot.activeTurn ? { ...snapshot.activeTurn, state: next } : snapshot.activeTurn
  };
}

export function beginTurn(snapshot: TurnEngineSnapshot, source: TranscriptSource = 'microphone'): TurnEngineSnapshot {
  const sequence = snapshot.sequence + 1;
  const activeTurn: VoiceTurn = {
    id: crypto.randomUUID(),
    sessionId: snapshot.sessionId,
    sequence,
    startedAt: Date.now(),
    state: 'listening',
    source,
    interimTranscript: '',
    finalTranscript: ''
  };
  return { ...snapshot, sequence, state: 'listening', activeTurn };
}

export function setInterimTranscript(snapshot: TurnEngineSnapshot, transcript: string): TurnEngineSnapshot {
  if (!snapshot.activeTurn) return snapshot;
  return {
    ...snapshot,
    activeTurn: { ...snapshot.activeTurn, interimTranscript: transcript }
  };
}

export function acceptFinalTranscript(
  snapshot: TurnEngineSnapshot,
  transcript: string,
  confidence?: number,
  minimumConfidence = 0.55
): TranscriptDecision {
  const turn = snapshot.activeTurn;
  if (!turn) return { accepted: false, reason: 'empty' };
  if (turn.source === 'atlas-tts') return { accepted: false, reason: 'self_audio' };
  if (snapshot.processedTurnIds.includes(turn.id)) return { accepted: false, reason: 'duplicate_turn' };

  const normalized = normalizeTranscript(transcript);
  if (!normalized) return { accepted: false, reason: 'empty' };
  if (confidence !== undefined && confidence < minimumConfidence) {
    return { accepted: false, reason: 'low_confidence' };
  }

  const transcriptFingerprint = fingerprint(normalized);
  if (snapshot.lastProcessedTranscriptFingerprint === transcriptFingerprint) {
    return { accepted: false, reason: 'duplicate_transcript' };
  }

  return {
    accepted: true,
    fingerprint: transcriptFingerprint,
    turn: { ...turn, finalTranscript: transcript.trim(), confidence, state: 'understanding' }
  };
}

export function commitTranscript(
  snapshot: TurnEngineSnapshot,
  decision: Extract<TranscriptDecision, { accepted: true }>
): TurnEngineSnapshot {
  return {
    ...snapshot,
    state: 'understanding',
    activeTurn: decision.turn,
    lastProcessedTranscriptFingerprint: decision.fingerprint,
    processedTurnIds: [...snapshot.processedTurnIds, decision.turn.id].slice(-100)
  };
}

export function attachResponse(snapshot: TurnEngineSnapshot, responseText: string): TurnEngineSnapshot {
  if (!snapshot.activeTurn) throw new Error('Cannot attach a response without an active voice turn.');
  const responseFingerprint = fingerprint(responseText);
  if (snapshot.lastResponseFingerprint === responseFingerprint) {
    throw new Error('ATLAS Voice blocked a repeated response to prevent a response loop.');
  }
  return {
    ...snapshot,
    state: 'speaking',
    activeTurn: { ...snapshot.activeTurn, state: 'speaking', responseText, responseFingerprint },
    lastResponseFingerprint: responseFingerprint
  };
}

export function interruptSpeaking(snapshot: TurnEngineSnapshot): TurnEngineSnapshot {
  if (snapshot.state !== 'speaking') return snapshot;
  return beginTurn({ ...snapshot, state: 'completed', activeTurn: snapshot.activeTurn && { ...snapshot.activeTurn, state: 'completed' } });
}
