import { describe, expect, it } from 'vitest';
import { probeAccessibilityDeviceApis } from '../../apps/web/src/services/accessibilityDeviceCapabilities';

describe('accessibility device capability probes', () => {
  it('detects browser API availability without claiming hardware is connected', () => {
    const result = probeAccessibilityDeviceApis({
      mediaDevices: { getUserMedia: () => Promise.resolve({}) },
      vibrate: () => true,
      hid: {},
      bluetooth: {}
    });

    expect(result).toEqual({
      cameraAndMicrophoneApi: 'api_available_unverified',
      hapticsApi: 'api_available_unverified',
      webHidApi: 'api_available_unverified',
      webBluetoothApi: 'api_available_unverified'
    });
  });

  it('reports unavailable APIs truthfully', () => {
    expect(probeAccessibilityDeviceApis({})).toEqual({
      cameraAndMicrophoneApi: 'unavailable',
      hapticsApi: 'unavailable',
      webHidApi: 'unavailable',
      webBluetoothApi: 'unavailable'
    });
  });
});
