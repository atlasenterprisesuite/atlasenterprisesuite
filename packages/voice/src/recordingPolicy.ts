import {
  authorize,
  createAuditEvent,
  type AuthorizationContext,
  type TenantScope
} from '../../core/src';

export type RecordingPolicyInput = {
  actor: AuthorizationContext;
  resourceScope: TenantScope;
  captureSupported: boolean;
  consentRequired: boolean;
  consentSatisfied: boolean;
  runtimeReady: boolean;
};

export type RecordingPolicyDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | 'scope_mismatch'
        | 'permission_denied'
        | 'unsupported'
        | 'consent_required'
        | 'runtime_not_ready';
    };

export function evaluateRecordingPolicy(
  input: RecordingPolicyInput
): RecordingPolicyDecision {
  const authorization = authorize(input.actor, {
    scope: input.resourceScope,
    permission: 'voice.personal.record'
  });

  if (!authorization.ok) {
    return { allowed: false, reason: authorization.reason };
  }

  if (!input.captureSupported) {
    return { allowed: false, reason: 'unsupported' };
  }

  if (input.consentRequired && !input.consentSatisfied) {
    return { allowed: false, reason: 'consent_required' };
  }

  if (!input.runtimeReady) {
    return { allowed: false, reason: 'runtime_not_ready' };
  }

  return { allowed: true };
}

export function authorizeRecordingStart(
  input: RecordingPolicyInput & {
    actorId: string;
    sessionId: string;
    occurredAt: string;
  }
) {
  const decision = evaluateRecordingPolicy(input);

  return {
    ...decision,
    audit: createAuditEvent({
      scope: input.resourceScope,
      actorId: input.actorId,
      action: 'voice.recording.start',
      resource: `voice-session:${input.sessionId}`,
      result: decision.allowed ? 'success' : 'denied',
      occurredAt: input.occurredAt
    })
  };
}
