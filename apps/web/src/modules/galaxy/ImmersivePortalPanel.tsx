import { useEffect, useRef, useState } from 'react';
import type { PortalDestination } from './portalModel';
import { detectNativeSpatialBridge, requestNativeSpatialPortal, type NativeSpatialBridgeKind } from './nativeSpatialBridge';
import {
  detectSpatialPortalSupport,
  startSpatialPortalSession,
  type SpatialPortalSession,
  type SpatialPortalSupport
} from './webxrPortalRuntime';

const INITIAL_SUPPORT: SpatialPortalSupport = {
  capability: 'checking',
  secureContext: true,
  immersiveAr: false,
  immersiveVr: false,
  reason: 'Checking spatial capabilities.'
};

export function ImmersivePortalPanel({
  destination,
  onTraverse
}: {
  destination: PortalDestination | null;
  onTraverse: (destination: PortalDestination) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<SpatialPortalSession | null>(null);
  const [support, setSupport] = useState<SpatialPortalSupport>(INITIAL_SUPPORT);
  const [nativeBridge, setNativeBridge] = useState<NativeSpatialBridgeKind>(null);
  const [sessionState, setSessionState] = useState<'idle' | 'starting' | 'running' | 'error'>('idle');
  const [sessionDetail, setSessionDetail] = useState('');

  useEffect(() => {
    setNativeBridge(detectNativeSpatialBridge());
    let cancelled = false;
    detectSpatialPortalSupport()
      .then((result) => {
        if (!cancelled) setSupport(result);
      })
      .catch(() => {
        if (!cancelled) {
          setSupport({
            capability: 'browser-3d',
            secureContext: window.isSecureContext,
            immersiveAr: false,
            immersiveVr: false,
            reason: 'Spatial capability detection failed closed to Browser 3D.'
          });
        }
      });

    return () => {
      cancelled = true;
      void sessionRef.current?.end();
      sessionRef.current = null;
    };
  }, []);

  const startSession = async () => {
    if (!destination?.navigable || !canvasRef.current) return;

    const mode = support.immersiveAr
      ? 'immersive-ar'
      : support.immersiveVr
        ? 'immersive-vr'
        : null;

    if (!mode) return;

    setSessionState('starting');
    setSessionDetail('');

    try {
      const session = await startSpatialPortalSession({
        canvas: canvasRef.current,
        mode,
        domOverlayRoot: rootRef.current,
        onTraverse: () => onTraverse(destination),
        onEnded: () => {
          sessionRef.current = null;
          setSessionState('idle');
        }
      });
      sessionRef.current = session;
      setSessionState('running');
      setSessionDetail(
        `${session.referenceSpace} · ${session.enabledFeatures.length ? session.enabledFeatures.join(', ') : 'base WebXR features'}`
      );
    } catch (error) {
      sessionRef.current = null;
      setSessionState('error');
      setSessionDetail(error instanceof Error ? error.message : 'immersive_session_failed');
    }
  };

  const openNativePortal = () => {
    if (!destination?.navigable) return;
    const kind = requestNativeSpatialPortal(destination);
    if (kind) {
      setNativeBridge(kind);
      setSessionDetail(`Native spatial handoff requested through ${kind}.`);
    }
  };

  const stopSession = async () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    await session?.end();
    setSessionState('idle');
  };

  const immersiveLabel = support.immersiveAr
    ? 'Enter immersive AR portal'
    : support.immersiveVr
      ? 'Enter immersive spatial preview'
      : 'Immersive mode unavailable';

  return (
    <section className="immersive-portal-panel" ref={rootRef} aria-labelledby="immersive-portal-title">
      <canvas ref={canvasRef} className="immersive-portal-canvas" aria-hidden="true" />
      <div>
        <p className="portal-eyebrow">Spatial runtime</p>
        <h2 id="immersive-portal-title">Immersive portal</h2>
        <p>
          {support.reason}
        </p>
        {support.capability === 'webxr-vr' ? (
          <p className="immersive-portal-note">
            Passthrough AR is not exposed by this browser. The immersive preview does not claim camera passthrough.
          </p>
        ) : null}
        {support.capability === 'browser-3d' ? (
          <p className="immersive-portal-note">
            Browser 3D remains active. A native spatial adapter is required on platforms that do not expose WebXR immersive AR.
          </p>
        ) : null}
      </div>

      <div className="immersive-portal-destination">
        <span>Destination</span>
        <strong>{destination?.label ?? 'Select a portal'}</strong>
        <small>{destination?.statusLabel ?? 'No destination selected'}</small>
      </div>

      <div className="immersive-portal-actions">
        {nativeBridge ? (
          <button
            type="button"
            className="portal-native"
            disabled={!destination?.navigable}
            onClick={openNativePortal}
          >
            Open native spatial portal
          </button>
        ) : null}
        <button
          type="button"
          className="portal-enter"
          disabled={
            !destination?.navigable
            || support.capability === 'checking'
            || support.capability === 'browser-3d'
            || sessionState === 'starting'
            || sessionState === 'running'
          }
          onClick={() => void startSession()}
        >
          {sessionState === 'starting' ? 'Starting spatial session…' : immersiveLabel}
        </button>
        {sessionState === 'running' ? (
          <button type="button" className="portal-stop" onClick={() => void stopSession()}>
            Exit immersive mode
          </button>
        ) : null}
      </div>

      <div className="immersive-portal-status" role="status">
        <strong>
          {sessionState === 'running'
            ? 'Spatial tracking active'
            : sessionState === 'error'
              ? 'Spatial session unavailable'
              : support.capability === 'checking'
                ? 'Checking device'
                : 'Ready'}
        </strong>
        <span>
          {sessionState === 'running'
            ? 'Walk through the rendered portal plane to open the selected ATLAS destination.'
            : sessionDetail || (nativeBridge ? `native bridge: ${nativeBridge}` : support.capability.replaceAll('-', ' '))}
        </span>
      </div>
    </section>
  );
}
