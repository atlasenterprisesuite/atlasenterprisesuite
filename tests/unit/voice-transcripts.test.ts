import { describe, expect, it } from 'vitest';
import {
  authorizeTranscriptRead,
  validateTranscriptProvenance,
  type VoiceTranscript
} from '../../packages/voice/src';

const transcript: VoiceTranscript = {
  id: 'transcript-1',
  sessionId: 'session-1',
  scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
  ownerActorId: 'owner-1',
  source: { kind: 'provider', providerId: 'provider-1' },
  completeness: 'complete',
  generatedAt: '2026-09-06T21:40:00.000Z',
  recordingId: 'recording-1',
  sourceStartedAt: '2026-09-06T21:39:00.000Z',
  sourceEndedAt: '2026-09-06T21:40:00.000Z'
};

describe('ATLAS Voice transcript governance', () => {
  it('accepts complete scoped provenance', () => {
    expect(validateTranscriptProvenance(transcript)).toEqual({ ok: true });
  });

  it('rejects a provider source without provider identity', () => {
    expect(
      validateTranscriptProvenance({
        ...transcript,
        source: { kind: 'provider', providerId: '' }
      })
    ).toEqual({ ok: false, reason: 'invalid_source' });
  });

  it('rejects inverted source timestamps', () => {
    expect(
      validateTranscriptProvenance({
        ...transcript,
        sourceStartedAt: '2026-09-06T21:41:00.000Z',
        sourceEndedAt: '2026-09-06T21:40:00.000Z'
      })
    ).toEqual({ ok: false, reason: 'invalid_time_range' });
  });

  it('requires transcript-read permission in the same tenant scope', () => {
    const result = authorizeTranscriptRead({
      actorId: 'reviewer-1',
      actor: {
        scope: transcript.scope,
        permissions: ['voice.transcript.read']
      },
      transcript,
      occurredAt: '2026-09-06T21:41:00.000Z'
    });

    expect(result.allowed).toBe(true);
    expect(result.audit.action).toBe('voice.transcript.read');
    expect(result.audit.resource).toBe('voice-transcript:transcript-1');
  });

  it('denies transcript access across organization scope and audits denial', () => {
    const result = authorizeTranscriptRead({
      actorId: 'reviewer-1',
      actor: {
        scope: { tenantId: 'tenant-1', organizationId: 'org-2' },
        permissions: ['voice.transcript.read']
      },
      transcript,
      occurredAt: '2026-09-06T21:41:00.000Z'
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('scope_mismatch');
    expect(result.audit.result).toBe('denied');
    expect(JSON.stringify(result.audit)).not.toContain('transcript content');
  });
});
