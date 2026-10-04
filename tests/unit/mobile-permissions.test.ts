import { describe, expect, it } from 'vitest';
import { normalizePermissionEvidence } from '../../packages/mobile-experience/permissions';

describe('mobile permission normalization', () => {
  it('preserves supported normalized states', () => {
    for (const state of ['granted', 'denied', 'restricted', 'not_determined', 'unsupported', 'unknown'] as const) {
      expect(normalizePermissionEvidence({
        permissionType: 'microphone',
        state,
        source: 'browser',
        observedAt: '2026-10-04T12:00:00.000Z',
        scope: 'current_runtime'
      }).state).toBe(state);
    }
  });

  it('maps a missing permission API to unsupported', () => {
    const evidence = normalizePermissionEvidence({
      permissionType: 'camera',
      state: 'granted',
      source: 'browser',
      apiAvailable: false,
      scope: 'current_runtime'
    });

    expect(evidence.state).toBe('unsupported');
  });

  it('maps malformed input to unknown instead of optimistic success', () => {
    const evidence = normalizePermissionEvidence({
      permissionType: 'location',
      state: 'allowed-forever' as never,
      source: 'browser',
      scope: 'current_runtime'
    });

    expect(evidence.state).toBe('unknown');
  });

  it('normalizes invalid source and permission names without leaking arbitrary fields', () => {
    const evidence = normalizePermissionEvidence({
      permissionType: '',
      state: 'denied',
      source: 'mystery' as never,
      scope: ''
    });

    expect(evidence.permissionType).toBe('unknown');
    expect(evidence.source).toBe('browser');
    expect(evidence.scope).toBe('current_runtime');
    expect(Object.prototype.hasOwnProperty.call(evidence, 'token')).toBe(false);
  });
});
