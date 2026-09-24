import type { TenantScope } from '../../core/src';

export type TranscriptCompleteness = 'partial' | 'complete';

export type TranscriptSource =
  | { kind: 'provider'; providerId: string }
  | { kind: 'local_runtime'; runtimeId: string };

export type VoiceTranscript = {
  id: string;
  sessionId: string;
  scope: TenantScope;
  ownerActorId: string;
  source: TranscriptSource;
  completeness: TranscriptCompleteness;
  generatedAt: string;
  recordingId?: string;
  sourceStartedAt?: string;
  sourceEndedAt?: string;
};

export type TranscriptProvenanceValidation =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'invalid_identity'
        | 'invalid_scope'
        | 'invalid_source'
        | 'invalid_time_range';
    };

export function validateTranscriptProvenance(
  transcript: VoiceTranscript
): TranscriptProvenanceValidation {
  if (
    !transcript.id ||
    !transcript.sessionId ||
    !transcript.ownerActorId ||
    !transcript.generatedAt
  ) {
    return { ok: false, reason: 'invalid_identity' };
  }

  if (!transcript.scope.tenantId || !transcript.scope.organizationId) {
    return { ok: false, reason: 'invalid_scope' };
  }

  if (
    transcript.source.kind === 'provider' &&
    !transcript.source.providerId
  ) {
    return { ok: false, reason: 'invalid_source' };
  }

  if (
    transcript.source.kind === 'local_runtime' &&
    !transcript.source.runtimeId
  ) {
    return { ok: false, reason: 'invalid_source' };
  }

  if (Number.isNaN(Date.parse(transcript.generatedAt))) {
    return { ok: false, reason: 'invalid_time_range' };
  }

  if (transcript.sourceStartedAt && transcript.sourceEndedAt) {
    const start = Date.parse(transcript.sourceStartedAt);
    const end = Date.parse(transcript.sourceEndedAt);

    if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
      return { ok: false, reason: 'invalid_time_range' };
    }
  }

  return { ok: true };
}
