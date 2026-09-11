import type {
  AccessibilityInputMode,
  AccessibilityOutputMode,
  AccessibilityProfile,
  HapticIntensity
} from '../types/accessibility';
import { atlasAuthorizedJson, getAtlasAccessToken } from '../lib/atlasSession';

const STORAGE_PREFIX = 'atlas_accessibility_profile:v1:';
export const ATLAS_ACCESSIBILITY_PROFILE_EVENT = 'atlas-accessibility-profile-changed';
const INPUT_MODES: AccessibilityInputMode[] = ['asl', 'voice', 'text', 'braille', 'haptic'];
const OUTPUT_MODES: AccessibilityOutputMode[] = ['text', 'asl_avatar', 'voice', 'braille'];
const HAPTIC_LEVELS: HapticIntensity[] = ['off', 'low', 'medium', 'high'];

type AtlasUserPreferencesRow = {
  preferences?: unknown;
};

export type AccessibilitySyncStatus = 'synced' | 'local-only' | 'failed';

export function defaultAccessibilityProfile(userId: string): AccessibilityProfile {
  return {
    userId,
    preferredInput: 'text',
    preferredOutput: 'text',
    captionsEnabled: false,
    brailleMode: false,
    hapticIntensity: 'off',
    screenReaderOptimized: false,
    motionReduced: false,
    highContrast: false,
    textSizeScale: 1
  };
}

function storageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function profileStorageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizedProfile(userId: string, raw: unknown): AccessibilityProfile {
  const defaults = defaultAccessibilityProfile(userId);
  if (!raw || typeof raw !== 'object') return defaults;
  const candidate = raw as Record<string, unknown>;
  const scale = typeof candidate.textSizeScale === 'number' && Number.isFinite(candidate.textSizeScale)
    ? Math.min(2, Math.max(0.75, candidate.textSizeScale))
    : defaults.textSizeScale;

  return {
    userId,
    preferredInput: INPUT_MODES.includes(candidate.preferredInput as AccessibilityInputMode)
      ? candidate.preferredInput as AccessibilityInputMode
      : defaults.preferredInput,
    preferredOutput: OUTPUT_MODES.includes(candidate.preferredOutput as AccessibilityOutputMode)
      ? candidate.preferredOutput as AccessibilityOutputMode
      : defaults.preferredOutput,
    captionsEnabled: booleanValue(candidate.captionsEnabled, defaults.captionsEnabled),
    brailleMode: booleanValue(candidate.brailleMode, defaults.brailleMode),
    hapticIntensity: HAPTIC_LEVELS.includes(candidate.hapticIntensity as HapticIntensity)
      ? candidate.hapticIntensity as HapticIntensity
      : defaults.hapticIntensity,
    screenReaderOptimized: booleanValue(candidate.screenReaderOptimized, defaults.screenReaderOptimized),
    motionReduced: booleanValue(candidate.motionReduced, defaults.motionReduced),
    highContrast: booleanValue(candidate.highContrast, defaults.highContrast),
    textSizeScale: scale
  };
}

export function loadAccessibilityProfile(userId: string): AccessibilityProfile {
  if (!storageAvailable()) return defaultAccessibilityProfile(userId);
  const serialized = window.localStorage.getItem(profileStorageKey(userId));
  if (!serialized) return defaultAccessibilityProfile(userId);

  try {
    return normalizedProfile(userId, JSON.parse(serialized));
  } catch {
    return defaultAccessibilityProfile(userId);
  }
}

export function saveAccessibilityProfile(profile: AccessibilityProfile): AccessibilityProfile {
  const normalized = normalizedProfile(profile.userId, profile);
  if (storageAvailable()) {
    window.localStorage.setItem(profileStorageKey(profile.userId), JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent<AccessibilityProfile>(ATLAS_ACCESSIBILITY_PROFILE_EVENT, { detail: normalized }));
  }
  return normalized;
}

export function mergeAccessibilityPreferences(
  existingPreferences: Record<string, unknown>,
  profile: AccessibilityProfile
): Record<string, unknown> {
  return {
    ...existingPreferences,
    accessibilityCommunication: normalizedProfile(profile.userId, profile)
  };
}

function decodeJwtSubject(token: string): string | null {
  const payload = token.split('.')[1];
  if (!payload || typeof atob !== 'function') return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const parsed = JSON.parse(atob(padded)) as { sub?: unknown };
    return typeof parsed.sub === 'string' && parsed.sub.trim() ? parsed.sub : null;
  } catch {
    return null;
  }
}

export function resolveAccessibilityUserId(): string {
  return decodeJwtSubject(getAtlasAccessToken()) || 'local-user';
}

export async function loadAccessibilityProfileRemote(userId: string): Promise<AccessibilityProfile | null> {
  if (!getAtlasAccessToken() || userId === 'local-user') return null;
  const userFilter = encodeURIComponent(`eq.${userId}`);
  const rows = await atlasAuthorizedJson<AtlasUserPreferencesRow[]>(
    `/rest/v1/atlas_user_preferences?user_id=${userFilter}&select=preferences&limit=1`,
    { method: 'GET' }
  );
  const preferences = objectValue(rows?.[0]?.preferences);
  if (!('accessibilityCommunication' in preferences)) return null;
  return normalizedProfile(userId, preferences.accessibilityCommunication);
}

export async function syncAccessibilityProfileRemote(profile: AccessibilityProfile): Promise<AccessibilitySyncStatus> {
  if (!getAtlasAccessToken() || profile.userId === 'local-user') return 'local-only';

  try {
    const userFilter = encodeURIComponent(`eq.${profile.userId}`);
    const rows = await atlasAuthorizedJson<AtlasUserPreferencesRow[]>(
      `/rest/v1/atlas_user_preferences?user_id=${userFilter}&select=preferences&limit=1`,
      { method: 'GET' }
    );
    const currentPreferences = objectValue(rows?.[0]?.preferences);
    const preferences = mergeAccessibilityPreferences(currentPreferences, profile);

    await atlasAuthorizedJson<Record<string, unknown>>('/rest/v1/atlas_user_preferences?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: profile.userId,
        preferences,
        updated_at: new Date().toISOString()
      })
    });
    return 'synced';
  } catch {
    return 'failed';
  }
}
