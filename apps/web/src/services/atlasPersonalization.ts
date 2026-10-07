import type { AtlasModuleDefinition } from '../modules/registry';
import { atlasAuthorizedJson, getAtlasAccessToken } from '../lib/atlasSession';

export const ATLAS_PERSONALIZATION_EVENT = 'atlas-personalization-changed';
const STORAGE_PREFIX = 'atlas_personalization_profile:v1:';

export const ATLAS_PERSONALIZATION_OBJECTIVES = [
  'business-growth',
  'money-finance',
  'people-workforce',
  'create-publish',
  'mobility-world',
  'health-care',
  'technology-automation',
  'knowledge-learning'
] as const;

export type AtlasPersonalizationObjective = (typeof ATLAS_PERSONALIZATION_OBJECTIVES)[number];
export type AtlasPersonalizationWorkMode = 'solo' | 'team' | 'clients' | 'public';
export type AtlasPersonalizationAutomationMode = 'suggest' | 'confirm' | 'safe-auto';
export type AtlasPersonalizationStartMode = 'recommended' | 'home' | 'suite';

export type AtlasPersonalizationProfile = {
  userId: string;
  completed: boolean;
  objectives: readonly AtlasPersonalizationObjective[];
  workMode: AtlasPersonalizationWorkMode;
  automationMode: AtlasPersonalizationAutomationMode;
  startMode: AtlasPersonalizationStartMode;
  progressiveDiscovery: boolean;
  pinnedModuleIds: readonly string[];
  updatedAt: string | null;
};

type AtlasUserPreferencesRow = {
  default_org_id?: string | null;
  preferences?: unknown;
};

export type AtlasPersonalizationSyncStatus = 'synced' | 'local-only' | 'failed';

const WORK_MODES: readonly AtlasPersonalizationWorkMode[] = ['solo', 'team', 'clients', 'public'];
const AUTOMATION_MODES: readonly AtlasPersonalizationAutomationMode[] = ['suggest', 'confirm', 'safe-auto'];
const START_MODES: readonly AtlasPersonalizationStartMode[] = ['recommended', 'home', 'suite'];

const OBJECTIVE_MODULES: Readonly<Record<AtlasPersonalizationObjective, readonly string[]>> = {
  'business-growth': ['business', 'finance', 'crm', 'commerce', 'advisory', 'inventory'],
  'money-finance': ['finance', 'pay', 'tax', 'payroll', 'inventory', 'business'],
  'people-workforce': ['people', 'payroll', 'learning', 'care', 'business'],
  'create-publish': ['studio', 'voice', 'events', 'assistant', 'business'],
  'mobility-world': ['ride', 'gps', 'city', 'aviation', 'device-os'],
  'health-care': ['health', 'care', 'insurance', 'learning', 'knowledge'],
  'technology-automation': ['cloud', 'work', 'assistant', 'device-os', 'connect', 'galaxy'],
  'knowledge-learning': ['knowledge', 'learning', 'assistant', 'bible-os']
};

function storageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
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

export function resolvePersonalizationUserId() {
  return decodeJwtSubject(getAtlasAccessToken()) || 'local-user';
}

export function defaultAtlasPersonalizationProfile(userId: string): AtlasPersonalizationProfile {
  return {
    userId,
    completed: false,
    objectives: [],
    workMode: 'solo',
    automationMode: 'confirm',
    startMode: 'recommended',
    progressiveDiscovery: true,
    pinnedModuleIds: [],
    updatedAt: null
  };
}

export function normalizeAtlasPersonalizationProfile(
  userId: string,
  raw: unknown,
  modules: readonly AtlasModuleDefinition[] = []
): AtlasPersonalizationProfile {
  const defaults = defaultAtlasPersonalizationProfile(userId);
  const candidate = objectValue(raw);
  const canonicalIds = modules.length
    ? new Set(modules.map((module) => module.id))
    : null;

  const objectives = Array.isArray(candidate.objectives)
    ? [...new Set(candidate.objectives
        .filter((value): value is AtlasPersonalizationObjective =>
          typeof value === 'string' && ATLAS_PERSONALIZATION_OBJECTIVES.includes(value as AtlasPersonalizationObjective)
        ))]
    : [];

  const pinnedModuleIds = Array.isArray(candidate.pinnedModuleIds)
    ? [...new Set(candidate.pinnedModuleIds
        .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
        .filter((value) => !canonicalIds || canonicalIds.has(value)))]
    : [];

  return {
    userId,
    completed: candidate.completed === true,
    objectives,
    workMode: WORK_MODES.includes(candidate.workMode as AtlasPersonalizationWorkMode)
      ? candidate.workMode as AtlasPersonalizationWorkMode
      : defaults.workMode,
    automationMode: AUTOMATION_MODES.includes(candidate.automationMode as AtlasPersonalizationAutomationMode)
      ? candidate.automationMode as AtlasPersonalizationAutomationMode
      : defaults.automationMode,
    startMode: START_MODES.includes(candidate.startMode as AtlasPersonalizationStartMode)
      ? candidate.startMode as AtlasPersonalizationStartMode
      : defaults.startMode,
    progressiveDiscovery: typeof candidate.progressiveDiscovery === 'boolean'
      ? candidate.progressiveDiscovery
      : defaults.progressiveDiscovery,
    pinnedModuleIds,
    updatedAt: typeof candidate.updatedAt === 'string' && candidate.updatedAt.trim()
      ? candidate.updatedAt
      : null
  };
}

export function loadAtlasPersonalizationProfile(
  userId: string,
  modules: readonly AtlasModuleDefinition[] = []
): AtlasPersonalizationProfile {
  if (!storageAvailable()) return defaultAtlasPersonalizationProfile(userId);
  const serialized = window.localStorage.getItem(storageKey(userId));
  if (!serialized) return defaultAtlasPersonalizationProfile(userId);
  try {
    return normalizeAtlasPersonalizationProfile(userId, JSON.parse(serialized), modules);
  } catch {
    return defaultAtlasPersonalizationProfile(userId);
  }
}

export function saveAtlasPersonalizationProfile(
  profile: AtlasPersonalizationProfile,
  modules: readonly AtlasModuleDefinition[] = []
): AtlasPersonalizationProfile {
  const normalized = normalizeAtlasPersonalizationProfile(
    profile.userId,
    { ...profile, updatedAt: new Date().toISOString() },
    modules
  );

  if (storageAvailable()) {
    window.localStorage.setItem(storageKey(profile.userId), JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent<AtlasPersonalizationProfile>(ATLAS_PERSONALIZATION_EVENT, {
      detail: normalized
    }));
  }
  return normalized;
}

export function mergeAtlasPersonalizationPreferences(
  existingPreferences: Record<string, unknown>,
  profile: AtlasPersonalizationProfile
) {
  return {
    ...existingPreferences,
    atlasPersonalization: profile
  };
}

export function recommendAtlasModules(
  profile: AtlasPersonalizationProfile,
  modules: readonly AtlasModuleDefinition[],
  limit = 10
): string[] {
  const canonical = new Map(modules.map((module) => [module.id, module] as const));
  const scores = new Map<string, number>();

  function add(moduleId: string, score: number) {
    if (!canonical.has(moduleId)) return;
    scores.set(moduleId, (scores.get(moduleId) ?? 0) + score);
  }

  profile.pinnedModuleIds.forEach((moduleId, index) => add(moduleId, 1000 - index));
  profile.objectives.forEach((objective) => {
    OBJECTIVE_MODULES[objective].forEach((moduleId, index) => add(moduleId, 100 - index * 4));
  });

  if (profile.workMode === 'team') {
    ['work', 'people', 'connect', 'knowledge'].forEach((id, index) => add(id, 40 - index));
  } else if (profile.workMode === 'clients') {
    ['crm', 'advisory', 'business', 'finance'].forEach((id, index) => add(id, 40 - index));
  } else if (profile.workMode === 'public') {
    ['business', 'commerce', 'studio', 'connect'].forEach((id, index) => add(id, 40 - index));
  } else {
    ['assistant', 'work', 'knowledge'].forEach((id, index) => add(id, 30 - index));
  }

  return [...scores.entries()]
    .sort((left, right) => right[1] - left[1]
      || (canonical.get(left[0])?.title ?? left[0]).localeCompare(canonical.get(right[0])?.title ?? right[0]))
    .slice(0, Math.max(1, limit))
    .map(([moduleId]) => moduleId);
}

export async function loadAtlasPersonalizationProfileRemote(
  userId: string,
  modules: readonly AtlasModuleDefinition[]
): Promise<AtlasPersonalizationProfile | null> {
  if (!getAtlasAccessToken() || userId === 'local-user') return null;
  const userFilter = encodeURIComponent(`eq.${userId}`);
  const rows = await atlasAuthorizedJson<AtlasUserPreferencesRow[]>(
    `/rest/v1/atlas_user_preferences?user_id=${userFilter}&select=preferences&limit=1`,
    { method: 'GET' }
  );
  const preferences = objectValue(rows?.[0]?.preferences);
  if (!('atlasPersonalization' in preferences)) return null;
  return normalizeAtlasPersonalizationProfile(userId, preferences.atlasPersonalization, modules);
}

export async function syncAtlasPersonalizationProfileRemote(
  profile: AtlasPersonalizationProfile,
  modules: readonly AtlasModuleDefinition[]
): Promise<AtlasPersonalizationSyncStatus> {
  if (!getAtlasAccessToken() || profile.userId === 'local-user') return 'local-only';

  try {
    const userFilter = encodeURIComponent(`eq.${profile.userId}`);
    const rows = await atlasAuthorizedJson<AtlasUserPreferencesRow[]>(
      `/rest/v1/atlas_user_preferences?user_id=${userFilter}&select=preferences,default_org_id&limit=1`,
      { method: 'GET' }
    );
    const currentRow = rows?.[0];
    const currentPreferences = objectValue(currentRow?.preferences);
    const normalized = normalizeAtlasPersonalizationProfile(profile.userId, profile, modules);
    const preferences = mergeAtlasPersonalizationPreferences(currentPreferences, normalized);

    await atlasAuthorizedJson('/rest/v1/atlas_user_preferences?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: profile.userId,
        default_org_id: currentRow?.default_org_id ?? null,
        preferences,
        updated_at: new Date().toISOString()
      })
    });

    return 'synced';
  } catch {
    return 'failed';
  }
}
