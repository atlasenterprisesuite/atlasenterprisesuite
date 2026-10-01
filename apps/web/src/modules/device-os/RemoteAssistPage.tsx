import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createScreenShareSession,
  createScreenShareViewerTicket,
  endScreenShareSession,
  enqueueLocalDeviceCommand,
  getScreenShareSessionStatus,
  listLocalDevices,
  type AtlasLocalDevice,
  type AtlasScreenShareSession
} from './localControlApi';

function toBase64(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw);
}

function fromBase64(value: string) {
  const raw = atob(value);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function viewerKeyAgreement() {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
  const publicKey = await crypto.subtle.exportKey('raw', pair.publicKey);
  return { pair, publicKey: toBase64(publicKey) };
}

async function deriveFrameKey(privateKey: CryptoKey, remotePublicKey: string) {
  const remote = await crypto.subtle.importKey(
    'raw',
    fromBase64(remotePublicKey),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: remote },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

async function decryptFrame(key: CryptoKey, iv: string, data: string) {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    key,
    fromBase64(data)
  );
}

function messageForStatus(status: AtlasScreenShareSession['status']) {
  if (status === 'pending') return 'Waiting for the person at the Windows PC to approve the visible consent prompt.';
  if (status === 'active') return 'The local user approved this attended screen-share session.';
  if (status === 'denied') return 'The local user denied this session.';
  if (status === 'expired') return 'This session expired.';
  return 'This screen-share session ended.';
}

export function RemoteAssistPage() {
  const [devices, setDevices] = useState<AtlasLocalDevice[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [session, setSession] = useState<AtlasScreenShareSession | null>(null);
  const [status, setStatus] = useState('Loading attended screen-share devices…');
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const frameKeyRef = useRef<CryptoKey | null>(null);
  const frameUrlRef = useRef<string | null>(null);
  const agreementRef = useRef<Awaited<ReturnType<typeof viewerKeyAgreement>> | null>(null);

  const eligible = useMemo(
    () => devices.filter((device) =>
      device.adapter === 'remote-desktop-windows' &&
      device.capabilities.includes('remote.session') &&
      device.capabilities.includes('remote.desktop.stream')
    ),
    [devices]
  );
  const selected = eligible.find((device) => device.id === selectedId) || eligible[0] || null;

  useEffect(() => {
    let cancelled = false;
    void listLocalDevices()
      .then((items) => {
        if (cancelled) return;
        setDevices(items);
        const remote = items.filter((item) => item.adapter === 'remote-desktop-windows');
        if (remote[0]) setSelectedId(remote[0].id);
        setStatus(
          remote.length
            ? `${remote.length} attended Windows screen-share device(s) available.`
            : 'No attended Windows screen-share agent is registered yet.'
        );
      })
      .catch((error) => {
        if (!cancelled) setStatus(error instanceof Error ? error.message : 'Unable to load screen-share devices.');
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!session || session.status !== 'pending') return;
    const timer = window.setInterval(() => {
      void getScreenShareSessionStatus(session.id)
        .then(({ session: current }) => {
          setSession(current);
          setStatus(messageForStatus(current.status));
        })
        .catch((error) => setStatus(error instanceof Error ? error.message : 'Session status check failed.'));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [session?.id, session?.status]);

  useEffect(() => {
    if (!session || session.status !== 'active' || socketRef.current) return;
    let cancelled = false;

    void (async () => {
      try {
        const ticket = await createScreenShareViewerTicket(session.id);
        if (cancelled) return;

        const agreement = await viewerKeyAgreement();
        agreementRef.current = agreement;
        const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const target = new URL(`${scheme}//${window.location.host}/_atlas/remote-bus/viewer`);
        target.searchParams.set('session_id', session.id);
        target.searchParams.set('ticket', ticket.viewer_ticket);
        const socket = new WebSocket(target);
        socketRef.current = socket;

        socket.addEventListener('open', () => {
          setStatus('Secure relay connected. Waiting for encrypted frames from the approved PC.');
        });

        socket.addEventListener('message', (message) => {
          void (async () => {
            try {
              const event = JSON.parse(String(message.data || ''));
              if (event?.event === 'remote.key' && event.role === 'agent' && event.public_key) {
                frameKeyRef.current = await deriveFrameKey(
                  agreement.pair.privateKey,
                  String(event.public_key)
                );
                socket.send(JSON.stringify({
                  event: 'remote.key',
                  role: 'viewer',
                  public_key: agreement.publicKey
                }));
                setStatus('End-to-end encrypted screen channel ready.');
                return;
              }
              if (
                event?.event === 'remote.frame' &&
                frameKeyRef.current &&
                event.mime === 'image/jpeg' &&
                event.iv &&
                event.data
              ) {
                const decrypted = await decryptFrame(
                  frameKeyRef.current,
                  String(event.iv),
                  String(event.data)
                );
                const nextUrl = URL.createObjectURL(new Blob([decrypted], { type: 'image/jpeg' }));
                setFrameUrl((previous) => {
                  if (previous) URL.revokeObjectURL(previous);
                  frameUrlRef.current = nextUrl;
                  return nextUrl;
                });
                return;
              }
              if (event?.event === 'remote.status' && event.state) {
                setStatus(`Remote device: ${String(event.state)}`);
              }
            } catch {
              setStatus('An encrypted screen frame could not be decoded.');
            }
          })();
        });

        socket.addEventListener('close', () => {
          socketRef.current = null;
          frameKeyRef.current = null;
          setStatus((current) =>
            current.includes('ended') ? current : 'Secure relay disconnected.'
          );
        });
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Unable to open secure screen relay.');
      }
    })();

    return () => { cancelled = true; };
  }, [session?.id, session?.status]);

  useEffect(() => () => {
    try { socketRef.current?.close(); } catch {}
    if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current);
  }, []);

  async function begin() {
    if (!selected || busy) return;
    setBusy(true);
    setFrameUrl(null);
    let createdSessionId = '';
    try {
      const created = await createScreenShareSession(selected.id);
      createdSessionId = created.session.id;
      setSession(created.session);
      const queued = await enqueueLocalDeviceCommand({
        deviceId: selected.id,
        agentId: selected.agent_id,
        capability: 'remote.session',
        action: 'session.request',
        actionPayload: { session_id: created.session.id, mode: 'view' },
        riskLevel: 'medium'
      });
      setStatus(
        queued.realtime.delivered > 0
          ? 'Request delivered. Approve the visible prompt on the Windows PC.'
          : 'Request queued. The visible Windows agent will pick it up through its polling fallback.'
      );
    } catch (error) {
      if (createdSessionId) {
        await endScreenShareSession(createdSessionId).catch(() => undefined);
        setSession(null);
      }
      setStatus(error instanceof Error ? error.message : 'Unable to start attended screen sharing.');
    } finally {
      setBusy(false);
    }
  }

  async function end() {
    const current = session;
    if (!current) return;
    setBusy(true);
    try {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ event: 'remote.end' }));
      }
      await endScreenShareSession(current.id).catch(() => undefined);
      try { socketRef.current?.close(); } catch {}
      socketRef.current = null;
      frameKeyRef.current = null;
      setSession({ ...current, status: 'ended', ended_at: new Date().toISOString() });
      setStatus('Attended screen sharing ended.');
      setFrameUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        frameUrlRef.current = null;
        return null;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Device OS · Remote Assist</p>
        <h1>Attended Windows Screen Share</h1>
        <p>
          View an authorized ATLAS Windows device through a short-lived encrypted relay.
          The person at the PC must approve every session locally before any screen frame leaves the device.
        </p>
      </header>

      <div className="notice strong">
        View-only by design. ATLAS Remote Assist does not inject mouse or keyboard input, does not run hidden,
        and does not provide unattended access. Screen frames are relayed ephemerally and are not stored by the relay.
      </div>

      <article className="feature-card wide">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Registered devices</p>
            <h2>Start an attended session</h2>
          </div>
          <span className="status-chip neutral">E2E encrypted</span>
        </div>

        <label className="field">
          <span>Windows device</span>
          <select
            value={selected?.id || ''}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={busy || Boolean(session && ['pending','active'].includes(session.status))}
          >
            {!eligible.length ? <option value="">No screen-share device registered</option> : null}
            {eligible.map((device) => (
              <option key={device.id} value={device.id}>
                {device.label} · {device.health_status}
              </option>
            ))}
          </select>
        </label>

        <div className="filter-row">
          <button
            type="button"
            disabled={!selected || busy || Boolean(session && ['pending','active'].includes(session.status))}
            onClick={() => void begin()}
          >
            Request screen share
          </button>
          <button
            type="button"
            disabled={busy || !session || !['pending','active'].includes(session.status)}
            onClick={() => void end()}
          >
            End session
          </button>
        </div>

        <div className="notice" role="status">{status}</div>
      </article>

      <article className="feature-card wide">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Live encrypted display</p>
            <h2>{selected?.label || 'Windows device'}</h2>
          </div>
          <span className={session?.status === 'active' ? 'status-chip' : 'status-chip neutral'}>
            {session?.status || 'idle'}
          </span>
        </div>
        <div
          style={{
            minHeight: '360px',
            borderRadius: '18px',
            overflow: 'hidden',
            background: '#05070d',
            display: 'grid',
            placeItems: 'center'
          }}
          aria-label="Attended remote screen viewer"
        >
          {frameUrl ? (
            <img
              src={frameUrl}
              alt="Live view of the approved Windows screen"
              style={{ display: 'block', width: '100%', height: 'auto', objectFit: 'contain' }}
            />
          ) : (
            <p style={{ padding: '2rem', textAlign: 'center' }}>
              No screen frame is displayed until the local Windows user approves the session.
            </p>
          )}
        </div>
      </article>

      <article className="feature-card wide">
        <p className="eyebrow">Windows setup boundary</p>
        <h2>Local user action is required once per device enrollment</h2>
        <ol>
          <li>Create a one-time Local Agent enrollment in Device OS.</li>
          <li>
            On the Windows PC, run <code>tools/local-agent/start-windows-remote.ps1</code> from the ATLAS repository.
            The launcher remains visible, requests the enrollment code securely, and prints the public CSR path.
          </li>
          <li>
            Base64-encode only <code>agent.csr</code>, then run the existing
            <strong> ATLAS Local Agent mTLS </strong> GitHub workflow with action <code>issue</code>,
            the ATLAS organization ID, agent ID, and CSR. The private key stays on the PC.
          </li>
          <li>
            Save the issued <code>atlas-local-agent.crt</code> artifact as
            <code> %LOCALAPPDATA%\ATLAS\RemoteAgent\config\agent.crt </code>, then restart the visible launcher.
          </li>
          <li>Every viewing session still requires a fresh on-screen Yes/No approval on the Windows PC.</li>
        </ol>
        <p>
          Closing the launcher or pressing Ctrl+C stops Remote Assist. No background autostart or unattended mode is installed.
        </p>
      </article>
    </section>
  );
}
