import { describe, expect, it } from 'vitest';
import { isValidElement } from 'react';
import { resolveAtlasExtension } from '../../apps/web/src/extensions/resolveAtlasExtension';
import { RequireAtlasIdentity } from '../../apps/web/src/identity/RequireAtlasIdentity';
import { DeviceOSPage } from '../../apps/web/src/modules/device-os/DeviceOSPage';

describe('ATLAS Universal Setup protected route', () => {
  it('wraps Device OS in the existing identity guard', () => {
    const guarded = resolveAtlasExtension('/device-os');
    expect(isValidElement(guarded)).toBe(true);
    if (!isValidElement(guarded)) throw new Error('Device OS route missing');
    expect(guarded.type).toBe(RequireAtlasIdentity);
    const child = (guarded.props as { children: unknown }).children;
    expect(isValidElement(child)).toBe(true);
    if (!isValidElement(child)) throw new Error('Device OS child missing');
    expect(child.type).toBe(DeviceOSPage);
  });
  it('does not expose an unguarded nested device setup route', () => {
    expect(resolveAtlasExtension('/device-os/setup')).toBeNull();
  });
});
