import type { NavigationLocationSample } from './navigationEngine';

export type NavigationLocationSourceKind = 'browser-geolocation' | 'apple-native-bridge';

export type NavigationLocationSource = {
  kind: NavigationLocationSourceKind;
  start(
    onSample: (sample: NavigationLocationSample) => void,
    onError: (error: string) => void
  ): () => void;
};

type NativeBridgePayload = {
  event?: string;
  latitude?: number;
  longitude?: number;
  horizontal_accuracy_m?: number | null;
  course_deg?: number | null;
  speed_mps?: number | null;
  timestamp_ms?: number;
  error?: string;
};

type AtlasNativeWindow = Window & {
  __atlasNavigationReceive?: (payload: NativeBridgePayload) => void;
  webkit?: {
    messageHandlers?: {
      atlasNavigation?: {
        postMessage(message: unknown): void;
      };
    };
  };
};

function finiteOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nativeBridgeSource(nativeWindow: AtlasNativeWindow): NavigationLocationSource | null {
  const handler = nativeWindow.webkit?.messageHandlers?.atlasNavigation;
  if (!handler) return null;

  return {
    kind: 'apple-native-bridge',
    start(onSample, onError) {
      nativeWindow.__atlasNavigationReceive = (payload) => {
        if (payload?.event === 'error') {
          onError(String(payload.error || 'native_location_error'));
          return;
        }
        if (payload?.event !== 'location') return;
        const lat = Number(payload.latitude);
        const lon = Number(payload.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        onSample({
          lat,
          lon,
          accuracy_m: finiteOrNull(payload.horizontal_accuracy_m),
          heading_deg: finiteOrNull(payload.course_deg),
          speed_mps: finiteOrNull(payload.speed_mps),
          timestamp: Number.isFinite(Number(payload.timestamp_ms))
            ? Number(payload.timestamp_ms)
            : Date.now()
        });
      };
      handler.postMessage({
        operation: 'start',
        desired_accuracy: 'best_for_navigation',
        activity_type: 'automotive_navigation'
      });
      return () => {
        try { handler.postMessage({ operation: 'stop' }); } catch {}
        delete nativeWindow.__atlasNavigationReceive;
      };
    }
  };
}

function browserSource(): NavigationLocationSource {
  return {
    kind: 'browser-geolocation',
    start(onSample, onError) {
      if (!navigator.geolocation) {
        onError('geolocation_unavailable');
        return () => {};
      }

      const id = navigator.geolocation.watchPosition((position) => {
        onSample({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy_m: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          heading_deg: typeof position.coords.heading === 'number' && Number.isFinite(position.coords.heading)
            ? position.coords.heading
            : null,
          speed_mps: typeof position.coords.speed === 'number' && Number.isFinite(position.coords.speed)
            ? position.coords.speed
            : null,
          timestamp: position.timestamp || Date.now()
        });
      }, (error) => {
        onError(error.code === 1 ? 'geolocation_permission_denied' : 'geolocation_unavailable');
      }, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10_000
      });

      return () => navigator.geolocation.clearWatch(id);
    }
  };
}

export function createNavigationLocationSource(): NavigationLocationSource {
  if (typeof window !== 'undefined') {
    const native = nativeBridgeSource(window as AtlasNativeWindow);
    if (native) return native;
  }
  return browserSource();
}
