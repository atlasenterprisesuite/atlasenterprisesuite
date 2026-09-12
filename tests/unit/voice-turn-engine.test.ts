import { describe, expect, it } from 'vitest';
import {
  acceptFinalTranscript,
  attachResponse,
  beginTurn,
  commitTranscript,
  createInitialSnapshot,
  fingerprint,
  interruptSpeaking,
  transition
} from '../../apps/web/src/modules/voice/turnEngine';

describe('ATLAS Voice Turn Engine', () => {
  it('processes a turn only once', () => {
    const started = beginTurn(createInitialSnapshot('session-1'));
    const decision = acceptFinalTranscript(started, 'Hola ATLAS', 0.95);
    expect(decision.accepted).toBe(true);
    if (!decision.accepted) return;

    const committed = commitTranscript(started, decision);
    expect(committed.processedTurnIds).toContain(decision.turn.id);

    const replay = acceptFinalTranscript(committed, 'Hola ATLAS', 0.95);
    expect(replay).toEqual({ accepted: false, reason: 'duplicate_turn' });
  });

  it('suppresses a duplicate transcript on a fresh turn', () => {
    const first = beginTurn(createInitialSnapshot('session-2'));
    const firstDecision = acceptFinalTranscript(first, 'Revisa ATLAS Voice', 0.98);
    expect(firstDecision.accepted).toBe(true);
    if (!firstDecision.accepted) return;

    const committed = commitTranscript(first, firstDecision);
    const second = beginTurn({ ...committed, state: 'completed' });
    expect(acceptFinalTranscript(second, '  revisa   atlas voice ', 0.98)).toEqual({
      accepted: false,
      reason: 'duplicate_transcript'
    });
  });

  it('rejects ATLAS TTS as user input', () => {
    const selfAudio = beginTurn(createInitialSnapshot('session-3'), 'atlas-tts');
    expect(acceptFinalTranscript(selfAudio, 'This is ATLAS speaking', 0.99)).toEqual({
      accepted: false,
      reason: 'self_audio'
    });
  });

  it('blocks low-confidence final transcripts', () => {
    const started = beginTurn(createInitialSnapshot('session-4'));
    expect(acceptFinalTranscript(started, 'unclear command', 0.2)).toEqual({
      accepted: false,
      reason: 'low_confidence'
    });
  });

  it('blocks a repeated response fingerprint', () => {
    const started = beginTurn(createInitialSnapshot('session-5'));
    const decision = acceptFinalTranscript(started, 'primera pregunta', 0.9);
    expect(decision.accepted).toBe(true);
    if (!decision.accepted) return;

    const committed = commitTranscript(started, decision);
    const speaking = attachResponse({ ...committed, state: 'responding' }, 'Respuesta única');
    const nextTurn = beginTurn({ ...speaking, state: 'completed' });

    expect(() => attachResponse({ ...nextTurn, state: 'responding' }, 'Respuesta única')).toThrow(/repeated response/i);
    expect(speaking.lastResponseFingerprint).toBe(fingerprint('Respuesta única'));
  });

  it('opens a fresh user turn when speech is interrupted', () => {
    const started = beginTurn(createInitialSnapshot('session-6'));
    const decision = acceptFinalTranscript(started, 'habla', 0.9);
    expect(decision.accepted).toBe(true);
    if (!decision.accepted) return;

    const committed = commitTranscript(started, decision);
    const speaking = attachResponse({ ...committed, state: 'responding' }, 'Estoy respondiendo');
    const interrupted = interruptSpeaking(speaking);

    expect(interrupted.state).toBe('listening');
    expect(interrupted.sequence).toBe(2);
    expect(interrupted.activeTurn?.id).not.toBe(speaking.activeTurn?.id);
  });

  it('rejects invalid state-machine transitions', () => {
    expect(() => transition(createInitialSnapshot('session-7'), 'speaking')).toThrow(/Invalid ATLAS Voice transition/);
  });
});
