import { describe, expect, it, vi } from 'vitest';
import { detectNativeSpatialBridge } from '../../apps/web/src/modules/galaxy/nativeSpatialBridge';

describe('ATLAS native spatial bridge detection', () => {
  it('detects the visionOS WebKit message handler only when it is actually injected', () => {
    const postMessage = vi.fn();
    expect(detectNativeSpatialBridge({
      webkit: {
        messageHandlers: {
          atlasSpatialPortals: { postMessage }
        }
      }
    } as any)).toBe('visionos-webkit');
  });

  it('detects a generic native spatial bridge when supplied by a host app', () => {
    expect(detectNativeSpatialBridge({
      AtlasSpatialBridge: {
        openPortal: vi.fn()
      }
    } as any)).toBe('generic-native');
  });

  it('does not claim a native bridge in a normal browser', () => {
    expect(detectNativeSpatialBridge({} as any)).toBeNull();
  });
});
