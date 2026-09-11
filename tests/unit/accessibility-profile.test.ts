import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultAccessibilityProfile,
  loadAccessibilityProfile,
  mergeAccessibilityPreferences,
  saveAccessibilityProfile,
  syncAccessibilityProfileRemote
} from '../../apps/web/src/services/accessibilityProfile';

describe('accessibility profile persistence', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

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

  it('merges accessibility settings without deleting unrelated account preferences', () => {
    const profile = { ...defaultAccessibilityProfile('user-a'), captionsEnabled: true };
    expect(mergeAccessibilityPreferences({ locale: 'en-US', theme: 'dark' }, profile)).toEqual({
      locale: 'en-US',
      theme: 'dark',
      accessibilityCommunication: profile
    });
  });

  it('upserts through the existing RLS preference row without dropping its organization or unrelated preferences', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const defaultOrgId = '22222222-2222-4222-8222-222222222222';
    const profile = { ...defaultAccessibilityProfile(userId), captionsEnabled: true };
    window.localStorage.setItem('atlas_access_token', 'test-access-token');

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        default_org_id: defaultOrgId,
        preferences: { locale: 'en-US', theme: 'dark' }
      }]), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response('', { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(syncAccessibilityProfileRemote(profile)).resolves.toBe('synced');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [postUrl, postInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(postUrl).toContain('/rest/v1/atlas_user_preferences?on_conflict=user_id');
    expect(postInit.method).toBe('POST');
    expect(JSON.parse(String(postInit.body))).toEqual({
      user_id: userId,
      default_org_id: defaultOrgId,
      preferences: {
        locale: 'en-US',
        theme: 'dark',
        accessibilityCommunication: profile
      }
    });
  });
});
