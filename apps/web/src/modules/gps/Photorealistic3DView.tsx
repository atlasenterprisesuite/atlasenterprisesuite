import { useEffect, useRef } from 'react';

const CESIUM_VERSION = '1.105';
const CESIUM_JS = `https://ajax.googleapis.com/ajax/libs/cesiumjs/${CESIUM_VERSION}/Build/Cesium/Cesium.js`;
const CESIUM_CSS = `https://ajax.googleapis.com/ajax/libs/cesiumjs/${CESIUM_VERSION}/Build/Cesium/Widgets/widgets.css`;
const GOOGLE_3D_TILES_ROOT = 'https://tile.googleapis.com/v1/3dtiles/root.json';

type RuntimeState = 'idle' | 'loading' | 'ready' | 'error';

type Photorealistic3DViewProps = {
  enabled: boolean;
  apiKey: string;
  center: { lat: number; lon: number };
  onState?: (state: RuntimeState, message: string) => void;
};

let cesiumLoadPromise: Promise<any> | null = null;

function loadCesium() {
  const existing = (window as any).Cesium;
  if (existing) return Promise.resolve(existing);
  if (cesiumLoadPromise) return cesiumLoadPromise;

  cesiumLoadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${CESIUM_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = CESIUM_CSS;
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${CESIUM_JS}"]`);
    const script = existingScript || document.createElement('script');
    if (!existingScript) {
      script.src = CESIUM_JS;
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }

    const finish = () => {
      const Cesium = (window as any).Cesium;
      if (Cesium) resolve(Cesium);
      else reject(new Error('cesium_runtime_missing'));
    };

    if ((window as any).Cesium) {
      finish();
      return;
    }

    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', () => reject(new Error('cesium_runtime_load_failed')), { once: true });
  }).catch((error) => {
    cesiumLoadPromise = null;
    throw error;
  });

  return cesiumLoadPromise;
}

function tilesetUrl(apiKey: string) {
  const key = apiKey.trim();
  if (!key) throw new Error('google_map_tiles_key_missing');
  return `${GOOGLE_3D_TILES_ROOT}?key=${encodeURIComponent(key)}`;
}

function flyTo(viewer: any, Cesium: any, center: { lat: number; lon: number }) {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(center.lon, center.lat, 650),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-38),
      roll: 0
    },
    duration: 0.8
  });
}

export function Photorealistic3DView({
  enabled,
  apiKey,
  center,
  onState
}: Photorealistic3DViewProps) {
  const node = useRef<HTMLDivElement | null>(null);
  const runtime = useRef<{ viewer: any; Cesium: any } | null>(null);
  const stateCallback = useRef(onState);
  const initialCenter = useRef(center);

  useEffect(() => {
    stateCallback.current = onState;
  }, [onState]);

  useEffect(() => {
    initialCenter.current = center;
  }, [center.lat, center.lon]);

  useEffect(() => {
    if (!enabled) {
      stateCallback.current?.('idle', 'Photorealistic 3D inactive');
      return;
    }

    if (!apiKey.trim()) {
      stateCallback.current?.('error', 'Photorealistic 3D BLOCKED: Google Map Tiles key not configured.');
      return;
    }

    let cancelled = false;
    stateCallback.current?.('loading', 'Loading Google Photorealistic 3D Tiles…');

    loadCesium().then((Cesium) => {
      if (cancelled || !node.current) return;

      Cesium.RequestScheduler.requestsByServer['tile.googleapis.com:443'] = 18;

      const viewer = new Cesium.Viewer(node.current, {
        imageryProvider: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        requestRenderMode: true
      });

      viewer.scene.globe.show = false;

      viewer.scene.primitives.add(new Cesium.Cesium3DTileset({
        url: tilesetUrl(apiKey),
        showCreditsOnScreen: true
      }));

      runtime.current = { viewer, Cesium };
      flyTo(viewer, Cesium, initialCenter.current);
      stateCallback.current?.('ready', 'Google Photorealistic 3D Tiles ready · attribution enabled');
    }).catch(() => {
      if (!cancelled) {
        stateCallback.current?.('error', 'Photorealistic 3D provider did not initialize.');
      }
    });

    return () => {
      cancelled = true;
      const active = runtime.current?.viewer;
      runtime.current = null;
      if (active && !active.isDestroyed?.()) active.destroy();
    };
  }, [enabled, apiKey]);

  useEffect(() => {
    if (!enabled || !runtime.current) return;
    flyTo(runtime.current.viewer, runtime.current.Cesium, center);
  }, [enabled, center.lat, center.lon]);

  if (!enabled) return null;

  return (
    <div className="gps4d-photorealistic-shell" aria-label="ATLAS Photorealistic 3D view">
      <div ref={node} className="gps4d-photorealistic-view" />
      <div className="gps4d-photorealistic-badge">
        Google Photorealistic 3D Tiles · EXTERNAL-GATED
      </div>
    </div>
  );
}
