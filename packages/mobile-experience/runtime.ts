import type {
  MobileCapabilityState,
  MobileDeviceClass,
  MobileRuntime,
  MobileRuntimeSnapshot,
  MobileRuntimeSource,
  RawMobileRuntimeInput
} from './types';

const CAPABILITY_STATES = new Set<MobileCapabilityState>([
  'supported',
  'unsupported',
  'restricted',
  'unknown',
  'error'
]);

const DEVICE_CLASSES = new Set<MobileDeviceClass>(['phone', 'tablet', 'desktop', 'unknown']);
const RUNTIME_SOURCES = new Set<MobileRuntimeSource>(['browser', 'native_bridge', 'server', 'unknown']);
const RUNTIMES = new Set<MobileRuntime>(['web', 'ios_native', 'ipad_native', 'android_native', 'unknown']);

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeRuntimeSource(value: unknown): MobileRuntimeSource {
  return typeof value === 'string' && RUNTIME_SOURCES.has(value as MobileRuntimeSource)
    ? value as MobileRuntimeSource
    : 'unknown';
}

function normalizeDeviceClass(value: unknown, userAgent: string | null): MobileDeviceClass {
  if (typeof value === 'string' && DEVICE_CLASSES.has(value as MobileDeviceClass)) {
    return value as MobileDeviceClass;
  }

  if (!userAgent) return 'unknown';
  if (/iPhone|Android.+Mobile/i.test(userAgent)) return 'phone';
  if (/iPad|Android/i.test(userAgent)) return 'tablet';
  return 'desktop';
}

function normalizeRuntime(value: unknown, source: MobileRuntimeSource): MobileRuntime {
  if (source === 'browser') return 'web';
  if (source === 'native_bridge') {
    if (value === 'ios_native' || value === 'ipad_native' || value === 'android_native') return value;
    return 'unknown';
  }
  if (source === 'server' && typeof value === 'string' && RUNTIMES.has(value as MobileRuntime)) {
    return value as MobileRuntime;
  }
  return 'unknown';
}

function normalizeCapabilities(value: unknown): Record<string, MobileCapabilityState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, state]) => [
    key,
    typeof state === 'string' && CAPABILITY_STATES.has(state as MobileCapabilityState)
      ? state as MobileCapabilityState
      : 'unknown'
  ]));
}

export function normalizeRuntimeSnapshot(input: RawMobileRuntimeInput): MobileRuntimeSnapshot {
  const runtimeSource = normalizeRuntimeSource(input.runtimeSource);
  const userAgent = text(input.userAgent);

  return {
    runtime: normalizeRuntime(input.runtimeHint, runtimeSource),
    runtimeSource,
    deviceClass: normalizeDeviceClass(input.deviceClass, userAgent),
    osFamily: text(input.osFamily),
    osVersion: text(input.osVersion),
    appVersion: text(input.appVersion),
    buildId: text(input.buildId),
    capabilities: normalizeCapabilities(input.capabilities),
    capturedAt: text(input.capturedAt)
  };
}
