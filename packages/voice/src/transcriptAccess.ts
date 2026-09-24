import {
  authorize,
  createAuditEvent,
  type AuthorizationContext
} from '../../core/src';
import type { VoiceTranscript } from './transcripts';

export function authorizeTranscriptRead(input: {
  actorId: string;
  actor: AuthorizationContext;
  transcript: VoiceTranscript;
  occurredAt: string;
}) {
  const decision = authorize(input.actor, {
    scope: input.transcript.scope,
    permission: 'voice.transcript.read'
  });

  return {
    allowed: decision.ok,
    reason: decision.ok ? null : decision.reason,
    audit: createAuditEvent({
      scope: input.transcript.scope,
      actorId: input.actorId,
      action: 'voice.transcript.read',
      resource: `voice-transcript:${input.transcript.id}`,
      result: decision.ok ? 'success' : 'denied',
      occurredAt: input.occurredAt
    })
  };
}
