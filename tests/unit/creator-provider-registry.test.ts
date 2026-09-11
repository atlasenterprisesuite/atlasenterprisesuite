import { describe, expect, it } from 'vitest';
import * as registry from '../../apps/web/src/modules/creator/providerRegistry';

describe('ATLAS Creator provider registry', () => {
  it('exports zero-cost routing helpers', () => {
    expect(typeof (registry as any).eligibleProviders).toBe('function');
    expect(typeof (registry as any).selectAtlasAutoProvider).toBe('function');
  });

  it('excludes paid providers in zero-cost mode and selects a ready local engine', () => {
    const eligibleProviders = (registry as any).eligibleProviders;
    const selectAtlasAutoProvider = (registry as any).selectAtlasAutoProvider;
    expect(typeof eligibleProviders).toBe('function');
    expect(typeof selectAtlasAutoProvider).toBe('function');
    if (typeof eligibleProviders !== 'function' || typeof selectAtlasAutoProvider !== 'function') return;

    const providers = [
      {
        id: 'local-ready', name: 'Local Ready', capabilities: ['image'], capabilityLabel: 'local',
        billingClass: 'zero-cost', execution: 'self-hosted', license: 'Apache-2.0', commercialUse: true, state: 'ready'
      },
      {
        id: 'paid-ready', name: 'Paid Ready', capabilities: ['image'], capabilityLabel: 'paid',
        billingClass: 'metered', execution: 'external', license: 'Provider terms', commercialUse: true, state: 'ready'
      }
    ] as registry.CreatorProvider[];

    expect(eligibleProviders('image', true, providers).map((provider: registry.CreatorProvider) => provider.id)).toEqual(['local-ready']);
    expect(selectAtlasAutoProvider('image', true, providers)?.id).toBe('local-ready');
  });

  it('returns no auto provider when no eligible provider is ready', () => {
    const selectAtlasAutoProvider = (registry as any).selectAtlasAutoProvider;
    expect(typeof selectAtlasAutoProvider).toBe('function');
    if (typeof selectAtlasAutoProvider !== 'function') return;

    const providers = registry.creatorProviders.map(provider => ({ ...provider, state: 'configuration-required' as const }));
    expect(selectAtlasAutoProvider('image', true, providers)).toBeNull();
  });
});
