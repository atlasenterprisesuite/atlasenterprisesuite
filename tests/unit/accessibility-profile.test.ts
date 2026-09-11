import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultAccessibilityProfile,
  loadAccessibilityProfile,
  saveAccessibilityProfile
} from '../../apps/web/src/services/accessibilityProfile';

describe('accessibility profile persistence', () => {
  beforeEach(() => window.localStorage.clear());

  it('creates privacy-preserving functional defaults', () => {
    expect(defaultAccessibilityProfile('user-a')).toEqual({
      userId: 'user-a',
      preferredInput: 'text',
      preferredOutput: 'text',
      captionsEnabled: false,
      brailleMode: false,
      hapticIntensity: 'off',
      screenReaderOptimized: false,
      motionReduced: false,
      highContrast: false,
      textSizeScale: 1
    });
  });

  it('round-trips a profile for the same user', () => {
    const profile = {
      ...defaultAccessibilityProfile('user-a'),
      preferredInput: 'asl' as const,
      preferredOutput: 'asl_avatar' as const,
      captionsEnabled: true,
      highContrast: true
    };

    saveAccessibilityProfile(profile);
    expect(loadAccessibilityProfile('user-a')).toEqual(profile);
  });

  it('isolates local profile keys by user', () => {
    saveAccessibilityProfile({ ...defaultAccessibilityProfile('user-a'), captionsEnabled: true });
    expect(loadAccessibilityProfile('user-b')).toEqual(defaultAccessibilityProfile('user-b'));
  });

  it('falls back safely when stored JSON is corrupt', () => {
    window.localStorage.setItem('atlas_accessibility_profile:v1:user-a', '{broken');
    expect(loadAccessibilityProfile('user-a')).toEqual(defaultAccessibilityProfile('user-a'));
  });
});
