import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Photorealistic3DView } from '../../apps/web/src/modules/gps/Photorealistic3DView';

afterEach(() => { cleanup(); delete (window as any).Cesium; });
function provider() {
  let resolve!: () => void; let reject!: (e: Error) => void;
  const readyPromise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  const destroy = vi.fn();
  const viewer = { scene: { globe: {}, primitives: { add: vi.fn() } }, camera: { flyTo: vi.fn() }, destroy, isDestroyed: () => false };
  (window as any).Cesium = {
    RequestScheduler: { requestsByServer: {} }, Viewer: function () { return viewer; },
    Cesium3DTileset: function () { return { readyPromise }; },
    Cartesian3: { fromDegrees: vi.fn() }, Math: { toRadians: vi.fn() }
  };
  return { resolve, reject, destroy };
}
describe('photorealistic provider evidence', () => {
  it('does not report ready before the tileset resolves', async () => {
    const mock = provider(); const onState = vi.fn();
    render(<Photorealistic3DView enabled apiKey="test-only" center={{ lat: 28, lon: -81 }} onState={onState} />);
    await act(async () => {});
    expect(onState.mock.calls.some(([state]) => state === 'ready')).toBe(false);
    await act(async () => mock.resolve());
    await waitFor(() => expect(onState.mock.calls.some(([state]) => state === 'ready')).toBe(true));
  });
  it('reports failure and destroys the viewer when provider authorization fails', async () => {
    const mock = provider(); const onState = vi.fn();
    render(<Photorealistic3DView enabled apiKey="test-only" center={{ lat: 28, lon: -81 }} onState={onState} />);
    await act(async () => mock.reject(new Error('403')));
    await waitFor(() => expect(onState.mock.calls.some(([state]) => state === 'error')).toBe(true));
    expect(mock.destroy).toHaveBeenCalledTimes(1);
  });
  it('does not publish a late success after unmount', async () => {
    const mock = provider(); const onState = vi.fn();
    const view = render(<Photorealistic3DView enabled apiKey="test-only" center={{ lat: 28, lon: -81 }} onState={onState} />);
    await act(async () => {}); view.unmount();
    await act(async () => mock.resolve());
    expect(onState.mock.calls.some(([state]) => state === 'ready')).toBe(false);
    expect(mock.destroy).toHaveBeenCalledTimes(1);
  });
});
