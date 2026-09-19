export type AccessibilityDeviceApiState = 'api_available_unverified' | 'unavailable';

export type AccessibilityDeviceApiProbe = {
  cameraAndMicrophoneApi: AccessibilityDeviceApiState;
  hapticsApi: AccessibilityDeviceApiState;
  webHidApi: AccessibilityDeviceApiState;
  webBluetoothApi: AccessibilityDeviceApiState;
};

type NavigatorCapabilitySurface = {
  mediaDevices?: { getUserMedia?: unknown };
  vibrate?: unknown;
  hid?: unknown;
  bluetooth?: unknown;
};

function apiState(value: boolean): AccessibilityDeviceApiState {
  return value ? 'api_available_unverified' : 'unavailable';
}

/**
 * Reports browser API surface only. It does not request permissions, enumerate
 * devices, start capture, pair hardware, or claim that any physical device is
 * connected or validated.
 */
export function probeAccessibilityDeviceApis(
  navigatorLike: NavigatorCapabilitySurface = typeof navigator !== 'undefined' ? navigator as NavigatorCapabilitySurface : {}
): AccessibilityDeviceApiProbe {
  return {
    cameraAndMicrophoneApi: apiState(typeof navigatorLike.mediaDevices?.getUserMedia === 'function'),
    hapticsApi: apiState(typeof navigatorLike.vibrate === 'function'),
    webHidApi: apiState('hid' in navigatorLike && navigatorLike.hid != null),
    webBluetoothApi: apiState('bluetooth' in navigatorLike && navigatorLike.bluetooth != null)
  };
}
