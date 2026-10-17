import {
  normalizeRuntimeSnapshot,
  type MobileDeviceClass,
  type MobileRuntimeSnapshot
} from '../../../../packages/mobile-experience';

export type WebRuntimeInput = {
  userAgent?: string;
  innerWidth?: number;
  maxTouchPoints?: number;
  language?: string;
  mediaDevicesAvailable?: boolean;
  permissionsApiAvailable?: boolean;
  notificationsApiAvailable?: boolean;
  shareApiAvailable?: boolean;
};

function currentInput(): WebRuntimeInput {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return {};
  return {
    userAgent: navigator.userAgent,
    innerWidth: window.innerWidth,
    maxTouchPoints: navigator.maxTouchPoints,
    language: navigator.language,
    mediaDevicesAvailable: Boolean(navigator.mediaDevices?.getUserMedia),
    permissionsApiAvailable: Boolean(navigator.permissions),
    notificationsApiAvailable: typeof Notification !== 'undefined',
    shareApiAvailable: typeof navigator.share === 'function'
  };
}

function resolveDeviceClass(input: WebRuntimeInput): MobileDeviceClass {
  const ua = input.userAgent || '';
  const width = Number(input.innerWidth || 0);
  const touch = Number(input.maxTouchPoints || 0);

  if (/iPhone|Android.+Mobile/i.test(ua)) return 'phone';
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && touch > 1)) return 'tablet';
  if (width > 0 && width <= 767) return 'phone';
  if (width > 767 && width <= 1180) return 'tablet';
  if (width > 1180) return 'desktop';
  return 'unknown';
}

function resolveOsFamily(input: WebRuntimeInput): string | null {
  const ua = input.userAgent || '';
  const touch = Number(input.maxTouchPoints || 0);
  if (/iPhone/i.test(ua)) return 'ios';
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && touch > 1)) return 'ipados';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macos';
  if (/Linux/i.test(ua)) return 'linux';
  return null;
}

function capability(explicit: boolean | undefined, detected: boolean) {
  return (explicit ?? detected) ? 'supported' as const : 'unsupported' as const;
}

export function captureWebRuntime(input: WebRuntimeInput = currentInput()): MobileRuntimeSnapshot {
  const hasNavigator = typeof navigator !== 'undefined';
  const mediaDevicesDetected = hasNavigator && Boolean(navigator.mediaDevices?.getUserMedia);
  const permissionsDetected = hasNavigator && Boolean(navigator.permissions);
  const notificationsDetected = typeof Notification !== 'undefined';
  const shareDetected = hasNavigator && typeof navigator.share === 'function';

  return normalizeRuntimeSnapshot({
    runtimeSource: 'browser',
    runtimeHint: 'web',
    userAgent: input.userAgent,
    deviceClass: resolveDeviceClass(input),
    osFamily: resolveOsFamily(input),
    capabilities: {
      microphone: capability(input.mediaDevicesAvailable, mediaDevicesDetected),
      permissions: capability(input.permissionsApiAvailable, permissionsDetected),
      notifications: capability(input.notificationsApiAvailable, notificationsDetected),
      share: capability(input.shareApiAvailable, shareDetected)
    },
    capturedAt: new Date().toISOString()
  });
}
