import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultAccessibilityProfile,
  loadAccessibilityProfile,
  saveAccessibilityProfile,
  syncAccessibilityProfileRemote
} from '../../apps/web/src/services/accessibilityProfile';

describe('Humanitarian ethics — executable accessibility and authorization-boundary regression', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('does not infer religious affiliation or sign-language preference from identity', () => {
    for (const userId of ['christian-user', 'muslim-user', 'atheist-user']) {
      const profile = defaultAccessibilityProfile(userId);
      expect(profile.preferredSignLanguage).toBeNull();
      expect(profile.preferredInput).toBe('text');
      expect(Object.keys(profile)).not.toContain('religion');
    }
  });

  it('does not expose one user accessibility preferences to another local profile', () => {
    saveAccessibilityProfile({ ...defaultAccessibilityProfile('user-a'), brailleMode: true });
    expect(loadAccessibilityProfile('user-b').brailleMode).toBe(false);
  });

  it('does not report successful remote persistence when authorization is denied', async () => {
    window.localStorage.setItem('atlas_access_token', 'test-access-token');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Forbidden' }), {
      status: 403, headers: { 'content-type': 'application/json' }
    }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await syncAccessibilityProfileRemote(defaultAccessibilityProfile('user-a'));
    expect(result).toBe('failed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not perform network persistence without an authenticated session', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await syncAccessibilityProfileRemote(defaultAccessibilityProfile('user-a'))).toBe('local-only');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
