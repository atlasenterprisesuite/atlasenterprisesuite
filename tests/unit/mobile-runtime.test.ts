import { describe, expect, it } from 'vitest';
import { normalizeRuntimeSnapshot } from '../../packages/mobile-experience/runtime';

describe('mobile runtime normalization', () => {
  it('classifies browser runtime as web without promoting Apple user agents to native', () => {
    const snapshot = normalizeRuntimeSnapshot({
      runtimeSource: 'browser',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      deviceClass: 'phone',
      capturedAt: '2026-10-04T12:00:00.000Z'
    });

    expect(snapshot.runtime).toBe('web');
    expect(snapshot.runtimeSource).toBe('browser');
    expect(snapshot.deviceClass).toBe('phone');
    expect(snapshot.capturedAt).toBe('2026-10-04T12:00:00.000Z');
  });

  it('accepts ios and ipad native states only with native bridge evidence', () => {
    expect(normalizeRuntimeSnapshot({
      runtimeSource: 'native_bridge',
      runtimeHint: 'ios_native',
      deviceClass: 'phone'
    }).runtime).toBe('ios_native');

    expect(normalizeRuntimeSnapshot({
      runtimeSource: 'native_bridge',
      runtimeHint: 'ipad_native',
      deviceClass: 'tablet'
    }).runtime).toBe('ipad_native');

    expect(normalizeRuntimeSnapshot({
      runtimeSource: 'browser',
      runtimeHint: 'ios_native',
      deviceClass: 'phone'
    }).runtime).toBe('web');
  });

  it('falls back to unknown for malformed or absent runtime evidence', () => {
    const malformed = normalizeRuntimeSnapshot({
      runtimeSource: 'unknown',
      runtimeHint: 'magic_native' as never,
      deviceClass: 'spaceship' as never
    });

    expect(malformed.runtime).toBe('unknown');
    expect(malformed.deviceClass).toBe('unknown');
    expect(malformed.runtimeSource).toBe('unknown');
  });

  it('normalizes capability values fail closed', () => {
    const snapshot = normalizeRuntimeSnapshot({
      runtimeSource: 'browser',
      capabilities: {
        microphone: 'supported',
        camera: 'definitely-ready' as never
      }
    });

    expect(snapshot.capabilities.microphone).toBe('supported');
    expect(snapshot.capabilities.camera).toBe('unknown');
  });
});
