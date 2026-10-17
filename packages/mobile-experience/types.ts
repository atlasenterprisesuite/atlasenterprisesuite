export type MobileRuntime =
  | 'web'
  | 'ios_native'
  | 'ipad_native'
  | 'android_native'
  | 'unknown';

export type MobileRuntimeSource = 'browser' | 'native_bridge' | 'server' | 'unknown';

export type MobileDeviceClass = 'phone' | 'tablet' | 'desktop' | 'unknown';

export type MobileCapabilityState =
  | 'supported'
  | 'unsupported'
  | 'restricted'
  | 'unknown'
  | 'error';

export type MobilePermissionState =
  | 'granted'
  | 'denied'
  | 'restricted'
  | 'not_determined'
  | 'unsupported'
  | 'unknown';

export type MobilePermissionSource = 'browser' | 'ios' | 'ipad' | 'android' | 'atlas_policy';

export type MobileRuntimeSnapshot = {
  runtime: MobileRuntime;
  runtimeSource: MobileRuntimeSource;
  deviceClass: MobileDeviceClass;
  osFamily: string | null;
  osVersion: string | null;
  appVersion: string | null;
  buildId: string | null;
  capabilities: Record<string, MobileCapabilityState>;
  capturedAt: string | null;
};

export type RawMobileRuntimeInput = {
  runtimeHint?: unknown;
  runtimeSource?: unknown;
  userAgent?: unknown;
  deviceClass?: unknown;
  osFamily?: unknown;
  osVersion?: unknown;
  appVersion?: unknown;
  buildId?: unknown;
  capabilities?: unknown;
  capturedAt?: unknown;
};

export type MobilePermissionEvidence = {
  permissionType: string;
  state: MobilePermissionState;
  source: MobilePermissionSource;
  observedAt: string | null;
  scope: string;
  reason: string | null;
  errorCode: string | null;
};

export type RawPermissionEvidence = {
  permissionType?: unknown;
  state?: unknown;
  source?: unknown;
  apiAvailable?: unknown;
  observedAt?: unknown;
  scope?: unknown;
  reason?: unknown;
  errorCode?: unknown;
};
