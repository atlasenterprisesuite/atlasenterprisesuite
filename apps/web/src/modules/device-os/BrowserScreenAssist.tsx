import { useCallback, useEffect, useRef, useState } from 'react';
import {
  assertMatchingAnswer, createBrowserAssistSignal, parseBrowserAssistSignal
} from './browserAssistSignal';
import { remoteAssistRoom, sha256Sdp } from './remoteAssistRoom';
import type { BrowserAssistSignal } from './browserAssistSignal';
import './BrowserScreenAssist.css';

type Mode = 'presenter' | 'viewer';
type State = 'idle' | 'starting' | 'offer-ready' | 'waiting-approval' | 'answer-ready' | 'connecting' | 'connected' | 'failed';

const MAX_SESSION_MS = 30 * 60 * 1000;
const ICE_TIMEOUT_MS = 18000;

function waitForIce(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timeout);
      pc.removeEventListener('icegatheringstatechange', check);
      pc.removeEventListener('signalingstatechange', check);
    };
    const check = () => {
      if (pc.signalingState === 'closed') {
        cleanup();
        reject(new Error('Connection closed during discovery.'));
      } else if (pc.iceGatheringState === 'complete') {
        cleanup();
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', check);
    pc.addEventListener('signalingstatechange', check);
    timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Network discovery timed out. Try again.'));
    }, ICE_TIMEOUT_MS);
    check();
  });
}

export function BrowserScreenAssist() {
  const [mode, setMode] = useState<Mode>('presenter');
  const [state, setState] = useState<State>('idle');
  const [consent, setConsent] = useState(false);
  const [useStun, setUseStun] = useState(false);
  const [outgoing, setOutgoing] = useState('');
  const [incoming, setIncoming] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const peer = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionId = useRef<string | null>(null);
  const generation = useRef(0);
  const statusPoll = useRef<ReturnType<typeof setInterval> | null>(null);
  const offerRef = useRef<BrowserAssistSignal | null>(null);
  const [roomState, setRoomState] = useState('');
  const [verifiedViewerId, setVerifiedViewerId] = useState<string | null>(null);
  const preview = useRef<HTMLVideoElement | null>(null);
  const display = useRef<HTMLVideoElement | null>(null);

  const closeResources = useCallback(() => {
    if (statusPoll.current !== null) clearInterval(statusPoll.current);
    statusPoll.current = null;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    const pc = peer.current;
    peer.current = null;
    if (pc) {
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
    }
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        track.onended = null;
        track.stop();
      });
      localStream.current = null;
    }
    if (preview.current) preview.current.srcObject = null;
    if (display.current) display.current.srcObject = null;
    sessionId.current = null;
    offerRef.current = null;
  }, []);

  const stop = useCallback(() => {
    generation.current += 1; // Invalidate pending permissions and SDP negotiations.
    const activeSession = sessionId.current;
    closeResources();
    if (activeSession) void remoteAssistRoom('stop', activeSession).catch(() => {});
    setRoomState('');
    setVerifiedViewerId(null);
    setState('idle');
    setOutgoing('');
    setIncoming('');
    setCopied(false);
    setConsent(false);
    setError('');
  }, [closeResources]);

  useEffect(() => {
    const exit = () => {
      generation.current += 1;
      const activeSession = sessionId.current;
      closeResources();
      if (activeSession) void remoteAssistRoom('stop', activeSession).catch(() => {});
    };
    window.addEventListener('pagehide', exit);
    return () => {
      window.removeEventListener('pagehide', exit);
      exit();
    };
  }, [closeResources]);

  useEffect(() => {
    const eligible = ['offer-ready', 'waiting-approval', 'answer-ready', 'connecting', 'connected', 'failed'];
    if (!eligible.includes(state) || !sessionId.current) return;
    const id = sessionId.current;
    let querying = false;
    let cancelled = false;
    const check = async () => {
      if (querying || cancelled || sessionId.current !== id) return;
      querying = true;
      try {
        const room = await remoteAssistRoom('status', id);
        if (cancelled || sessionId.current !== id) return;
        setRoomState(room.status);
        if (mode === 'presenter') setVerifiedViewerId(room.viewer_user_id);
      } catch {
        if (!cancelled && sessionId.current === id) {
          stop();
          setError('Remote session authorization could not be verified. Screen sharing was stopped.');
        }
      } finally { querying = false; }
    };
    void check();
    statusPoll.current = setInterval(() => void check(), 4000);
    return () => {
      cancelled = true;
      if (statusPoll.current !== null) clearInterval(statusPoll.current);
      statusPoll.current = null;
    };
  }, [state, mode, stop]);

  const startSessionClock = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      stop();
      setError('30-minute safety limit reached. Start a new approved session.');
    }, MAX_SESSION_MS);
  };

  const createPeer = () => {
    // STUN is optional and only enabled after an explicit user choice. Never
    // install a TURN server or forward screenshots through the ATLAS command bus.
    const pc = new RTCPeerConnection({
      iceServers: useStun ? [{ urls: 'stun:stun.l.google.com:19302' }] : []
    });
    peer.current = pc;
    pc.onconnectionstatechange = () => {
      if (peer.current !== pc) return;
      switch (pc.connectionState) {
        case 'connected': setState('connected'); setError(''); break;
        case 'failed': setState('failed'); setError('Peer connection failed. Stop and retry.'); break;
        case 'disconnected': setState('connecting'); setError('Peer disconnected. Waiting briefly for recovery.'); break;
        case 'closed': setState('idle'); break;
        default: break;
      }
    };
    return pc;
  };

  async function startSharing() {
    if (!consent || state !== 'idle') return;
    setError('');
    setState('starting');
    const attempt = ++generation.current;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getDisplayMedia || typeof RTCPeerConnection === 'undefined') {
        throw new Error('Screen sharing requires a supported browser on HTTPS.');
      }
      // Must be called directly from the deliberate click, so the browser
      // displays its native surface/window selection and permission prompt.
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 12, max: 20 } }, audio: false
      });
      if (attempt !== generation.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      localStream.current = stream;
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('No video screen track was granted.');
      track.onended = () => {
        stop();
        setError('Screen sharing was stopped on this computer.');
      };
      if (preview.current) {
        preview.current.srcObject = stream;
        void preview.current.play().catch(() => {});
      }
      const pc = createPeer();
      pc.addTrack(track, stream);
      const id = crypto.randomUUID();
      sessionId.current = id;
      await pc.setLocalDescription(await pc.createOffer());
      await waitForIce(pc);
      if (attempt !== generation.current) return;
      if (!pc.localDescription?.sdp || peer.current !== pc) throw new Error('Screen offer unavailable.');
      await remoteAssistRoom('create', id, await sha256Sdp(pc.localDescription.sdp));
      if (attempt !== generation.current) {
        void remoteAssistRoom('stop', id).catch(() => {});
        return;
      }
      setRoomState('invited');
      setOutgoing(createBrowserAssistSignal({ type: 'offer', sessionId: id, sdp: pc.localDescription.sdp }));
      setState('offer-ready');
      startSessionClock();
    } catch (e) {
      if (attempt !== generation.current) return;
      generation.current += 1;
      closeResources();
      setState('idle');
      setError(e instanceof Error ? e.message : 'Screen sharing could not start.');
    }
  }

  async function acceptInvitation() {
    if (!consent || state !== 'idle') return;
    setError('');
    setState('starting');
    const attempt = ++generation.current;
    try {
      if (!window.isSecureContext || typeof RTCPeerConnection === 'undefined') {
        throw new Error('Receiving a WebRTC stream requires a supported browser on HTTPS.');
      }
      const invite = parseBrowserAssistSignal(incoming.trim(), 'offer');
      sessionId.current = invite.sessionId;
      await remoteAssistRoom('join', invite.sessionId, await sha256Sdp(invite.sdp));
      if (attempt !== generation.current) {
        void remoteAssistRoom('stop', invite.sessionId).catch(() => {});
        return;
      }
      offerRef.current = invite;
      setRoomState('joined');
      setState('waiting-approval');
      startSessionClock();
    } catch (e) {
      if (attempt !== generation.current) return;
      generation.current += 1;
      const id = sessionId.current;
      closeResources();
      if (id) void remoteAssistRoom('stop', id).catch(() => {});
      setState('idle');
      setError(e instanceof Error ? e.message : 'Invitation could not be accepted.');
    }
  }

  async function approveViewer() {
    const id = sessionId.current;
    if (mode !== 'presenter' || state !== 'offer-ready' || !id || !verifiedViewerId) return;
    try {
      const room = await remoteAssistRoom('status', id);
      if (room.viewer_user_id !== verifiedViewerId || room.status !== 'joined') {
        throw new Error('Viewer identity or invitation changed. Stop and retry.');
      }
      await remoteAssistRoom('approve', id);
      setRoomState('approved');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Viewer approval failed.');
    }
  }

  async function prepareViewerAnswer() {
    if (mode !== 'viewer' || state !== 'waiting-approval' || !offerRef.current || !sessionId.current) return;
    const attempt = ++generation.current;
    const invite = offerRef.current;
    setState('starting');
    try {
      const room = await remoteAssistRoom('status', invite.sessionId);
      if (room.status !== 'approved') throw new Error('Screen owner has not approved the viewer yet.');
      const pc = createPeer();
      pc.ontrack = event => {
        if (peer.current !== pc) return;
        const stream = event.streams[0] || new MediaStream([event.track]);
        if (display.current) {
          display.current.srcObject = stream;
          void display.current.play().catch(() => {});
        }
      };
      await pc.setRemoteDescription({ type: 'offer', sdp: invite.sdp });
      await pc.setLocalDescription(await pc.createAnswer());
      await waitForIce(pc);
      if (attempt !== generation.current) return;
      if (!pc.localDescription?.sdp || peer.current !== pc) throw new Error('Screen answer unavailable.');
      await remoteAssistRoom('answer', invite.sessionId, await sha256Sdp(pc.localDescription.sdp));
      if (attempt !== generation.current) return;
      setOutgoing(createBrowserAssistSignal({
        type: 'answer', sessionId: invite.sessionId, sdp: pc.localDescription.sdp
      }));
      setRoomState('answer_ready');
      setState('answer-ready');
      setIncoming('');
    } catch (e) {
      if (attempt !== generation.current) return;
      stop();
      setError(e instanceof Error ? e.message : 'Viewer authorization failed. Connection closed.');
    }
  }

  async function finishPairing() {
    if (mode !== 'presenter' || state !== 'offer-ready' || !peer.current || !sessionId.current) return;
    setError('');
    try {
      const answer = assertMatchingAnswer(parseBrowserAssistSignal(incoming.trim(), 'answer'), sessionId.current);
      await remoteAssistRoom('activate', sessionId.current, await sha256Sdp(answer.sdp));
      await peer.current.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
      setIncoming('');
      setRoomState('active');
      setState('connecting');
    } catch (e) {
      stop();
      setError(e instanceof Error ? e.message : 'Viewer answer unauthorized or invalid. Session stopped.');
    }
  }

  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(outgoing);
      setCopied(true);
    } catch {
      setError('Clipboard blocked. Select and copy the pairing message manually.');
    }
  }

  const active = state !== 'idle';
  return (
    <section className="atlas-browser-assist" aria-labelledby="atlas-browser-assist-heading">
      <div className="card-heading">
        <div>
          <p className="eyebrow">ATLAS Screen Share · Browser pilot</p>
          <h3 id="atlas-browser-assist-heading">Share or view a screen — view only</h3>
        </div>
        <span className="status-chip neutral">{state === 'connected' ? 'Browser peer connected' : active ? 'Session setup' : 'Not connected'}</span>
      </div>
      <p>This peer-to-peer browser feature is separate from native Remote Desktop. No remote keyboard, mouse, unattended access or file transfer. Screen sharing starts only after the local browser permission prompt.</p>
      <div className="atlas-browser-assist-roles" role="group" aria-label="Screen sharing role">
        <button type="button" aria-pressed={mode === 'presenter'} disabled={active} onClick={() => { setMode('presenter'); setIncoming(''); setOutgoing(''); setError(''); }}>Share my screen</button>
        <button type="button" aria-pressed={mode === 'viewer'} disabled={active} onClick={() => { setMode('viewer'); setIncoming(''); setOutgoing(''); setError(''); }}>View approved screen</button>
      </div>
      <div className="notice">
        Use a trusted private channel to exchange the pairing messages with a person whose identity you have independently verified.
        ATLAS additionally checks both members of the active organization, requires the screen owner's approval and audits room-state changes. 
        Messages may contain network connection metadata; only SDP digests, never screen media or raw pairing data, are retained by ATLAS. Internet connections may fail without a TURN relay.
        The other participant can still capture what they see; hide sensitive windows before sharing.
      </div>
      <label className="atlas-browser-assist-choice">
        <input type="checkbox" checked={useStun} disabled={active} onChange={e => setUseStun(e.target.checked)} />
        <span>Allow optional public STUN discovery for internet connections (shares network metadata with a third-party STUN server).</span>
      </label>
      <label className="atlas-browser-assist-choice">
        <input type="checkbox" checked={consent} disabled={active} onChange={e => setConsent(e.target.checked)} />
        <span>{mode === 'presenter' ? 'I authorize sharing a screen from this computer and will choose the exact screen/window.' : 'I have the screen owner’s permission to view this session.'}</span>
      </label>
      {mode === 'presenter' && state === 'idle' ? <button type="button" disabled={!consent} onClick={() => void startSharing()}>Choose screen and create invitation</button> : null}
      {mode === 'viewer' && state === 'idle' ? <button type="button" disabled={!consent || !incoming.trim()} onClick={() => void acceptInvitation()}>Accept invitation and prepare viewer</button> : null}
      {(mode === 'viewer' && state === 'idle' || mode === 'presenter' && state === 'offer-ready') ? (
        <label className="atlas-browser-assist-code">
          <span>{mode === 'viewer' ? 'Paste screen owner’s offer' : 'Paste viewer’s answer'}</span>
          <textarea rows={4} value={incoming} onChange={e => setIncoming(e.target.value)} maxLength={160000} spellCheck={false} autoComplete="off" placeholder="Paste the pairing message received through your private channel" />
        </label>
      ) : null}
      {outgoing && <div className="atlas-browser-assist-code">
        <label htmlFor="atlas-browser-assist-outgoing">One-time {mode === 'presenter' ? 'invitation offer' : 'viewer answer'} (expires in 10 minutes)</label>
        <textarea id="atlas-browser-assist-outgoing" rows={4} readOnly value={outgoing} onFocus={e => e.target.select()} spellCheck={false} />
        <button type="button" onClick={() => void copyInvitation()}>{copied ? 'Copied — share privately' : 'Copy pairing message'}</button>
      </div>}
      {mode === 'presenter' && state === 'offer-ready' && roomState === 'joined' && verifiedViewerId ? (
        <div className="notice" role="status">
          <p>Viewer authenticated in your organization. Confirm this account ID in ATLAS Team before granting access: <code>{verifiedViewerId}</code></p>
          <button type="button" onClick={() => void approveViewer()}>Approve this viewer for screen access</button>
        </div>
      ) : null}
      {mode === 'viewer' && state === 'waiting-approval' ? (
        <p role="status">Waiting for the screen owner to approve your authenticated account.</p>
      ) : null}
      {mode === 'viewer' && state === 'waiting-approval' && roomState === 'approved' ? (
        <button type="button" onClick={() => void prepareViewerAnswer()}>Prepare encrypted viewer response</button>
      ) : null}
      {mode === 'presenter' && state === 'offer-ready' ? (
        <button type="button" disabled={!incoming.trim() || roomState !== 'answer_ready'}
          onClick={() => void finishPairing()}>Verify viewer answer and connect</button>
      ) : null}
      {active && <p role="status">Status: {state.replaceAll('-', ' ')} · ATLAS authorization: {roomState || 'verifying'} · Sessions end after 30 minutes.</p>}
      {error && <p role="alert" className="work-error">{error}</p>}
      <div className="atlas-browser-assist-video">
        <div>
          <strong>Local share preview</strong>
          <video ref={preview} muted autoPlay playsInline aria-label="Preview of your locally shared screen" />
        </div>
        <div>
          <strong>Authorized remote view</strong>
          <video ref={display} autoPlay playsInline aria-label="Remote screen, video only" />
        </div>
      </div>
      {active && <button type="button" className="atlas-browser-assist-stop" onClick={stop}>Stop sharing and disconnect</button>}
      <small>Screen media remains peer-to-peer encrypted and is not recorded by ATLAS. The authenticated backend stores room state, SDP digests and audit events only. No keyboard or mouse control, file transfer or unattended access is enabled. Live two-device and revocation E2E tests are required before production release.</small>
    </section>
  );
}
