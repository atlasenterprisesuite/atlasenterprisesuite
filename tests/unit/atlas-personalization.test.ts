import { describe, expect, it } from 'vitest';
import { ATLAS_MODULES } from '../../apps/web/src/modules/registry';
import {
  defaultAtlasPersonalizationProfile,
  mergeAtlasPersonalizationPreferences,
  normalizeAtlasPersonalizationProfile,
  recommendAtlasModules
} from '../../apps/web/src/services/atlasPersonalization';

describe('ATLAS personalization profile', () => {
  it('defaults to progressive discovery without pretending onboarding is complete', () => {
    expect(defaultAtlasPersonalizationProfile('user-1')).toMatchObject({
      userId: 'user-1',
      completed: false,
      progressiveDiscovery: true,
      objectives: [],
      automationMode: 'confirm'
    });
  });

  it('normalizes invalid values and only keeps canonical module ids', () => {
    const profile = normalizeAtlasPersonalizationProfile('user-1', {
      completed: true,
      objectives: ['business-growth', 'not-real'],
      workMode: 'invalid',
      automationMode: 'safe-auto',
      startMode: 'recommended',
      progressiveDiscovery: false,
      pinnedModuleIds: ['finance', 'not-real', 'finance']
    });

    expect(profile.objectives).toEqual(['business-growth']);
    expect(profile.workMode).toBe('solo');
    expect(profile.pinnedModuleIds).toEqual(['finance']);
  });

  it('recommends canonical modules from goals and never invents module ids', () => {
    const recommendations = recommendAtlasModules({
      ...defaultAtlasPersonalizationProfile('user-1'),
      completed: true,
      objectives: ['business-growth', 'money-finance']
    }, ATLAS_MODULES);

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]).toBe('finance');
    for (const id of recommendations) {
      expect(ATLAS_MODULES.some((module) => module.id === id)).toBe(true);
    }
  });

  it('preserves unrelated account preferences when syncing personalization', () => {
    const profile = {
      ...defaultAtlasPersonalizationProfile('user-1'),
      completed: true,
      objectives: ['technology-automation'] as const
    };

    expect(mergeAtlasPersonalizationPreferences({ accessibilityCommunication: { highContrast: true } }, profile))
      .toMatchObject({
        accessibilityCommunication: { highContrast: true },
        atlasPersonalization: {
          completed: true,
          objectives: ['technology-automation']
        }
      });
  });
});
