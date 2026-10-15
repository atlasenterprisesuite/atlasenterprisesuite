import { describe, expect, it } from 'vitest';
import { authorizeCameraCapability, NO_CAMERA_CAPABILITIES, type CameraDevice } from '../../packages/cameras/capability-gate';

const camera: CameraDevice = {
  id: 'cam-1', tenantId: 'tenant-1', provider: 'kangaroo',
  capabilities: NO_CAMERA_CAPABILITIES,
};
const owner = { tenantId: 'tenant-1', authenticated: true, allowedCameraIds: ['cam-1'] };

describe('camera capability fail-closed gate', () => {
  it('rejects unauthenticated access', () => {
    expect(authorizeCameraCapability({ ...owner, authenticated: false }, camera, 'live_view'))
      .toEqual({ allowed: false, status: 401, code: 'unauthenticated' });
  });
  it('rejects cross-tenant access even when camera id is known', () => {
    expect(authorizeCameraCapability({ ...owner, tenantId: 'tenant-2' }, camera, 'live_view'))
      .toEqual({ allowed: false, status: 403, code: 'camera_access_denied' });
  });
  it('rejects cameras outside owner allowlist', () => {
    expect(authorizeCameraCapability({ ...owner, allowedCameraIds: [] }, camera, 'snapshot'))
      .toEqual({ allowed: false, status: 403, code: 'camera_access_denied' });
  });
  it('does not invent Kangaroo live stream support', () => {
    expect(authorizeCameraCapability(owner, camera, 'live_view'))
      .toEqual({ allowed: false, status: 501, code: 'capability_unavailable' });
  });
  it('permits explicitly verified capabilities for an authorized owner', () => {
    const verified = { ...camera, capabilities: { ...NO_CAMERA_CAPABILITIES, recordings_import: true } };
    expect(authorizeCameraCapability(owner, verified, 'recordings_import')).toEqual({ allowed: true });
  });
});
