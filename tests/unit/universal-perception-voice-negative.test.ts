import { describe, expect, it } from 'vitest';
import { deriveRecordingState, evaluateRecordingPolicy } from '../../packages/voice/src';

const actor = {
  scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
  permissions: ['voice.personal.record'] as const
};

describe('ATLAS Universal Perception — existing voice fail-closed regression', () => {
  const recording = {
    captureSupported: true,
    enabledByPolicy: true,
    consentSatisfied: true,
    runtimeState: 'recording' as const
  };

  it('never reports recording when policy is disabled', () => {
    expect(deriveRecordingState({ ...recording, enabledByPolicy: false })).toBe('disabled');
  });

  it('never reports recording after consent is no longer satisfied', () => {
    expect(deriveRecordingState({ ...recording, consentSatisfied: false })).toBe('awaiting_consent');
  });

  it('never reports recording if capture is unsupported', () => {
    expect(deriveRecordingState({ ...recording, captureSupported: false })).toBe('unsupported');
  });

  it('does not misreport a paused or stopped runtime as recording', () => {
    expect(deriveRecordingState({ ...recording, runtimeState: 'paused' })).toBe('paused');
    expect(deriveRecordingState({ ...recording, runtimeState: 'stopped' })).toBe('stopped');
  });

  it('denies a different organization even when tenant matches', () => {
    expect(evaluateRecordingPolicy({
      actor,
      resourceScope: { tenantId: 'tenant-1', organizationId: 'org-2' },
      captureSupported: true,
      consentRequired: true,
      consentSatisfied: true,
      runtimeReady: true
    })).toEqual({ allowed: false, reason: 'scope_mismatch' });
  });

  it('denies when runtime is not ready', () => {
    expect(evaluateRecordingPolicy({
      actor,
      resourceScope: actor.scope,
      captureSupported: true,
      consentRequired: true,
      consentSatisfied: true,
      runtimeReady: false
    }).allowed).toBe(false);
  });
});
