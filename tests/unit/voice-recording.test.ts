import { describe, expect, it } from 'vitest';
import {
  authorizeRecordingStart,
  deriveRecordingState,
  evaluateRecordingPolicy
} from '../../packages/voice/src';

const actor = {
  scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
  permissions: ['voice.personal.record'] as const
};

describe('ATLAS Voice recording governance', () => {
  it('never reports recording without runtime confirmation', () => {
    expect(
      deriveRecordingState({
        captureSupported: true,
        enabledByPolicy: true,
        consentSatisfied: true,
        runtimeState: 'idle'
      })
    ).toBe('stopped');
  });

  it('reports recording only from confirmed runtime state', () => {
    expect(
      deriveRecordingState({
        captureSupported: true,
        enabledByPolicy: true,
        consentSatisfied: true,
        runtimeState: 'recording'
      })
    ).toBe('recording');
  });

  it('prioritizes unsupported capability', () => {
    expect(
      deriveRecordingState({
        captureSupported: false,
        enabledByPolicy: true,
        consentSatisfied: true,
        runtimeState: 'recording'
      })
    ).toBe('unsupported');
  });

  it('denies recording across tenant scope', () => {
    expect(
      evaluateRecordingPolicy({
        actor,
        resourceScope: { tenantId: 'tenant-2', organizationId: 'org-1' },
        captureSupported: true,
        consentRequired: true,
        consentSatisfied: true,
        runtimeReady: true
      })
    ).toEqual({ allowed: false, reason: 'scope_mismatch' });
  });

  it('requires consent when policy says consent is required', () => {
    expect(
      evaluateRecordingPolicy({
        actor,
        resourceScope: actor.scope,
        captureSupported: true,
        consentRequired: true,
        consentSatisfied: false,
        runtimeReady: true
      })
    ).toEqual({ allowed: false, reason: 'consent_required' });
  });

  it('allows recording only when every policy gate passes', () => {
    expect(
      evaluateRecordingPolicy({
        actor,
        resourceScope: actor.scope,
        captureSupported: true,
        consentRequired: true,
        consentSatisfied: true,
        runtimeReady: true
      })
    ).toEqual({ allowed: true });
  });

  it('emits metadata-only audit evidence for a recording start decision', () => {
    const result = authorizeRecordingStart({
      actorId: 'user-1',
      actor,
      resourceScope: actor.scope,
      sessionId: 'session-1',
      captureSupported: true,
      consentRequired: true,
      consentSatisfied: true,
      runtimeReady: true,
      occurredAt: '2026-09-06T21:35:00.000Z'
    });

    expect(result.allowed).toBe(true);
    expect(result.audit.action).toBe('voice.recording.start');
    expect(result.audit.resource).toBe('voice-session:session-1');
    expect(JSON.stringify(result.audit)).not.toContain('audio');
  });
});
