/**
 * Camera provider capability gate. No vendor access is implied by registering an adapter.
 * A verified provider adapter must explicitly enable each capability.
 */
export const CAMERA_CAPABILITIES = [
  'live_view', 'recordings_import', 'events', 'motion_alerts',
  'ptz', 'snapshot', 'arm_disarm',
] as const;

export type CameraCapability = (typeof CAMERA_CAPABILITIES)[number];
export type CameraCapabilityMap = Readonly<Record<CameraCapability, boolean>>;
export type CameraProvider = 'kangaroo' | 'generic';

export const NO_CAMERA_CAPABILITIES: CameraCapabilityMap = Object.freeze({
  live_view: false,
  recordings_import: false,
  events: false,
  motion_alerts: false,
  ptz: false,
  snapshot: false,
  arm_disarm: false,
});

export type CameraDevice = Readonly<{
  id: string;
  tenantId: string;
  provider: CameraProvider;
  capabilities: CameraCapabilityMap;
}>;

export type CameraAccessContext = Readonly<{
  tenantId: string;
  authenticated: boolean;
  allowedCameraIds: readonly string[];
}>;

export type CameraDecision =
  | { allowed: true }
  | { allowed: false; status: 401 | 403 | 501; code: string };

export function authorizeCameraCapability(
  context: CameraAccessContext,
  device: CameraDevice,
  capability: unknown,
): CameraDecision {
  if (!context || !device || context.authenticated !== true) return { allowed: false, status: 401, code: 'unauthenticated' };
  if (!context.tenantId || !device.tenantId || !device.id || context.tenantId !== device.tenantId ||
      !Array.isArray(context.allowedCameraIds) || !context.allowedCameraIds.includes(device.id)) {
    return { allowed: false, status: 403, code: 'camera_access_denied' };
  }
  if (typeof capability !== 'string' ||
      !CAMERA_CAPABILITIES.some((item) => item === capability) ||
      !device.capabilities || device.capabilities[capability as CameraCapability] !== true) {
    return { allowed: false, status: 501, code: 'capability_unavailable' };
  }
  return { allowed: true };
}
