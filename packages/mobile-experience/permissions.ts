import type {
  MobilePermissionEvidence,
  MobilePermissionSource,
  MobilePermissionState,
  RawPermissionEvidence
} from './types';

const PERMISSION_STATES = new Set<MobilePermissionState>([
  'granted',
  'denied',
  'restricted',
  'not_determined',
  'unsupported',
  'unknown'
]);

const PERMISSION_SOURCES = new Set<MobilePermissionSource>([
  'browser',
  'ios',
  'ipad',
  'android',
  'atlas_policy'
]);

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeSource(value: unknown): MobilePermissionSource {
  return typeof value === 'string' && PERMISSION_SOURCES.has(value as MobilePermissionSource)
    ? value as MobilePermissionSource
    : 'browser';
}

export function normalizePermissionEvidence(input: RawPermissionEvidence): MobilePermissionEvidence {
  const rawState = input.apiAvailable === false ? 'unsupported' : input.state;
  const state: MobilePermissionState = typeof rawState === 'string' && PERMISSION_STATES.has(rawState as MobilePermissionState)
    ? rawState as MobilePermissionState
    : 'unknown';

  return {
    permissionType: text(input.permissionType) ?? 'unknown',
    state,
    source: normalizeSource(input.source),
    observedAt: text(input.observedAt),
    scope: text(input.scope) ?? 'current_runtime',
    reason: text(input.reason),
    errorCode: text(input.errorCode)
  };
}
