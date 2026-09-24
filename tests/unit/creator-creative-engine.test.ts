import { describe, expect, it } from 'vitest';
import {
  adaptNativeReadiness,
  adaptProviderToCreativeEngine,
  rankCreativeEngines
} from '../../packages/creator/creative_engine';

describe('ATLAS Creative Engine domain', () => {
  it('maps an unconfigured external video provider without inventing readiness', () => {
    const engine = adaptProviderToCreativeEngine({
      providerId: 'seedance',
      displayName: 'Seedance',
      connectionState: 'unconfigured',
      capability: null,
      estimatedCost: null,
      lastVerifiedAt: null
    });
    expect(engine.engineId).toBe('provider:seedance');
    expect(engine.executionClass).toBe('byo-provider');
    expect(engine.connectionState).toBe('unconfigured');
    expect(engine.mediaKinds).toEqual(['video']);
    expect(engine.ready).toBe(false);
  });

  it('maps verified ATLAS native readiness as zero-cost self-hosted video', () => {
    const engine = adaptNativeReadiness({
      ok: true,
      renderer: 'atlas-native',
      billing_class: 'zero-cost',
      execution: 'self-hosted',
      native: { state: 'ready', capabilities: ['motion-composition-v1'] }
    });
    expect(engine.engineId).toBe('atlas-native');
    expect(engine.executionClass).toBe('self-hosted');
    expect(engine.connectionState).toBe('ready');
    expect(engine.ready).toBe(true);
    expect(engine.mediaKinds).toContain('video');
  });

  it('orders lower-cost execution classes ahead of paid providers', () => {
    const ranked = rankCreativeEngines([
      { engineId: 'paid:x', displayName: 'Paid X', executionClass: 'paid-provider', connectionState: 'ready', ready: true, mediaKinds: ['image'], capabilityNotes: [], lastVerifiedAt: '2026-09-15T12:00:00Z' },
      { engineId: 'prompt-export', displayName: 'Prompt Export', executionClass: 'prompt-export-only', connectionState: 'ready', ready: true, mediaKinds: ['image'], capabilityNotes: [], lastVerifiedAt: '2026-09-15T12:00:00Z' },
      { engineId: 'browser:image', displayName: 'Browser Image', executionClass: 'browser-local', connectionState: 'ready', ready: true, mediaKinds: ['image'], capabilityNotes: [], lastVerifiedAt: '2026-09-15T12:00:00Z' }
    ], 'image');
    expect(ranked.map(value => value.engineId)).toEqual(['browser:image', 'prompt-export', 'paid:x']);
  });
});
