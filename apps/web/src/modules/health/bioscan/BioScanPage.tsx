import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  advanceBioScanSession,
  beginBioScanSession,
  ensureBioScanConsent,
  loadBioScanCapabilities,
  saveBioScanSnapshot
} from './bioscanRepository';
import type { BioScanConsentRecord } from './bioscanApi';
import type { BioScanSession } from './bioscanContracts';
import { useCameraCapture } from './useCameraCapture';
import './bioscan.css';

type LoadState = 'loading' | 'ready' | 'error';
type ConsentState = 'required' | 'granting' | 'granted' | 'error';
type ScanState = 'idle' | 'preparing' | 'capturing' | 'processing' | 'complete' | 'cancelled' | 'error';

function idempotency(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${random}`;
}

function CameraStatus({ state }: { state: ReturnType<typeof useCameraCapture>['state'] }) {
  if (state === 'requesting') return <strong>Requesting camera permission</strong>;
  if (state === 'ready') return <strong>Camera ready</strong>;
  if (state === 'denied') return <strong>Camera access denied</strong>;
  if (state === 'unavailable') return <strong>Camera unavailable</strong>;
  if (state === 'error') return <strong>Camera error</strong>;
  return <strong>Camera not enabled</strong>;
}

const EMPTY_METRICS = [
  ['Height', 'Not measured'],
  ['Body composition', 'Not measured'],
  ['Heart rate', 'Not measured'],
  ['Temperature', 'Not measured']
] as const;

export function BioScanPage() {
  const camera = useCameraCapture();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [capabilities, setCapabilities] = useState<Awaited<ReturnType<typeof loadBioScanCapabilities>> | null>(null);
  const [consentState, setConsentState] = useState<ConsentState>('required');
  const [consent, setConsent] = useState<BioScanConsentRecord | null>(null);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [session, setSession] = useState<BioScanSession | null>(null);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    void loadBioScanCapabilities()
      .then((next) => {
        if (cancelled) return;
        setCapabilities(next);
        setLoadState('ready');
      })
      .catch((cause) => {
        if (cancelled) return;
        setMessage(cause instanceof Error ? cause.message : 'bioscan_capabilities_failed');
        setLoadState('error');
      });
    return () => { cancelled = true; };
  }, []);

  const cameraOnly = Boolean(
    capabilities?.capture_modes.camera
    && !capabilities.capture_modes.camera_depth
    && !capabilities.capture_modes.lidar
  );

  const canEnableCamera = loadState === 'ready'
    && capabilities?.permissions.capture
    && consentState === 'granted'
    && camera.state !== 'requesting';

  const canStartScan = camera.state === 'ready' && consentState === 'granted' && scanState === 'idle';
  const canFinishScan = scanState === 'capturing' && Boolean(session);

  const stateLabel = useMemo(() => {
    if (loadState === 'loading') return 'Checking BioScan capabilities';
    if (loadState === 'error') return 'BioScan backend unavailable';
    if (consentState === 'required') return 'Consent required';
    if (consentState === 'granting') return 'Saving consent';
    if (consentState === 'error') return 'Consent could not be saved';
    if (scanState === 'preparing') return 'Preparing scan session';
    if (scanState === 'capturing') return 'Capture session active';
    if (scanState === 'processing') return 'Persisting verified session metadata';
    if (scanState === 'complete') return 'BioScan session complete';
    if (scanState === 'cancelled') return 'Capture cancelled';
    if (scanState === 'error') return 'BioScan session failed';
    return 'Consent granted';
  }, [consentState, loadState, scanState]);

  async function grantConsent() {
    setConsentState('granting');
    setMessage('');
    try {
      const next = await ensureBioScanConsent({ policy_version: 'bioscan-consent-v1' });
      setConsent(next);
      setConsentState('granted');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'bioscan_consent_failed');
      setConsentState('error');
    }
  }

  async function beginCapture() {
    if (!consent || camera.state !== 'ready') return;
    setScanState('preparing');
    setMessage('');
    try {
      const created = await beginBioScanSession({
        api_version: 1,
        capture_mode: 'camera',
        consent_record_id: consent.id,
        idempotency_key: idempotency('bioscan-session')
      });
      const active = await advanceBioScanSession({
        api_version: 1,
        session_id: created.session.id,
        status: 'capturing'
      });
      setSession(active.session);
      setScanState('capturing');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'bioscan_session_start_failed');
      setScanState('error');
    }
  }

  async function finishCapture() {
    if (!session) return;
    setScanState('processing');
    setMessage('');
    try {
      await advanceBioScanSession({ api_version: 1, session_id: session.id, status: 'processing' });
      const completed = await advanceBioScanSession({ api_version: 1, session_id: session.id, status: 'complete' });
      const snapshot = await saveBioScanSnapshot({
        api_version: 1,
        session_id: session.id,
        idempotency_key: idempotency('bioscan-snapshot'),
        geometry_version: 'camera-metadata-v1',
        coordinate_system: 'screen-normalized',
        confidence_summary: {},
        source_summary: {
          capture_mode: 'camera',
          raw_frame_persisted: false,
          measurements_created: false
        }
      });
      setSession(completed.session);
      setSnapshotId(snapshot.snapshot.id);
      camera.stopCamera();
      setScanState('complete');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'bioscan_session_complete_failed');
      setScanState('error');
    }
  }

  async function cancelCapture() {
    const current = session;
    if (current && !['complete', 'partial', 'failed', 'cancelled'].includes(current.status)) {
      try {
        await advanceBioScanSession({ api_version: 1, session_id: current.id, status: 'cancelled' });
      } catch {
        // Camera shutdown still happens locally; server failure remains visible below.
      }
    }
    camera.stopCamera();
    setScanState(current ? 'cancelled' : 'idle');
  }

  return (
    <section className="bioscan-page">
      <header className="bioscan-hero">
        <div>
          <p className="eyebrow">ATLAS Health · BioScan</p>
          <h1>BioScan</h1>
          <p>Local camera capture with explicit consent, provenance boundaries and immutable Human Digital Twin history.</p>
        </div>
        <Link to="/health/body-twin">Open Body Twin</Link>
      </header>

      <div className="bioscan-truth" role="note">
        <strong>NO DATA → NO CLAIM</strong>
        <span>No vital sign, body composition value or diagnosis is inferred from ordinary camera imagery.</span>
      </div>

      <section className="bioscan-state" aria-live="polite">
        <div>
          <span>Current state</span>
          <strong>{stateLabel}</strong>
          {message ? <small>{message}</small> : null}
        </div>
        <div>
          <span>Camera</span>
          <CameraStatus state={camera.state} />
          {camera.error ? <small>{camera.error}</small> : null}
        </div>
      </section>

      {cameraOnly ? (
        <div className="bioscan-mode-notice">
          <strong>Camera-only mode</strong>
          <span>Depth and LiDAR are not represented as connected. Camera geometry remains estimate-only.</span>
        </div>
      ) : null}

      <section className="bioscan-layout">
        <div className="bioscan-stage">
          <div className="bioscan-viewfinder">
            <video ref={camera.videoRef} autoPlay muted playsInline aria-label="Local BioScan camera preview" />
            <div className="bioscan-silhouette" aria-hidden="true"><span /><i /></div>
            <div className="bioscan-grid" aria-hidden="true" />
          </div>
          <div className="bioscan-actions">
            {consentState !== 'granted' ? (
              <button type="button" onClick={grantConsent} disabled={consentState === 'granting' || loadState !== 'ready'}>
                Grant body-scan consent
              </button>
            ) : null}
            {consentState === 'granted' && camera.state !== 'ready' ? (
              <button type="button" onClick={() => void camera.requestCamera()} disabled={!canEnableCamera}>
                Enable camera
              </button>
            ) : null}
            {camera.state === 'ready' ? (
              <button type="button" className="secondary" onClick={() => void cancelCapture()}>Cancel camera</button>
            ) : null}
            {canStartScan ? <button type="button" onClick={() => void beginCapture()}>Start BioScan session</button> : null}
            {canFinishScan ? <button type="button" onClick={() => void finishCapture()}>Complete session metadata</button> : null}
          </div>
        </div>

        <aside className="bioscan-panel">
          <div className="bioscan-panel-heading">
            <p className="eyebrow">Evidence panel</p>
            <h2>Recorded measurements</h2>
          </div>
          <div className="bioscan-metrics">
            {EMPTY_METRICS.map(([label, value]) => (
              <article key={label}><span>{label}</span><strong>{value}</strong><small>No verified source attached</small></article>
            ))}
          </div>
          <div className="bioscan-provenance">
            <strong>Capture policy</strong>
            <span>Raw camera frames: not persisted</span>
            <span>Depth/LiDAR: unavailable unless a verified adapter exists</span>
            <span>Clinical interpretation: not performed</span>
          </div>
          {scanState === 'complete' && snapshotId ? (
            <div className="bioscan-complete">
              <strong>Immutable snapshot saved</strong>
              <span>{snapshotId}</span>
              <Link to="/health/body-twin">Review Body Twin history</Link>
            </div>
          ) : null}
        </aside>
      </section>
    </section>
  );
}
