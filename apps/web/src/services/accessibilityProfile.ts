import type {
  AccessibilityInputMode,
  AccessibilityOutputMode,
  AccessibilityProfile,
  HapticIntensity
} from '../types/accessibility';
import { getAtlasAccessToken } from '../lib/atlasSession';

const STORAGE_PREFIX = 'atlas_accessibility_profile:v1:';
export const ATLAS_ACCESSIBILITY_PROFILE_EVENT = 'atlas-accessibility-profile-changed';
const INPUT_MODES: AccessibilityInputMode[] = ['asl', 'voice', 'text', 'braille', 'haptic'];
const OUTPUT_MODES: AccessibilityOutputMode[] = ['text', 'asl_avatar', 'voice', 'braille'];
const HAPTIC_LEVELS: HapticIntensity[] = ['off', 'low', 'medium', 'high'];

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
