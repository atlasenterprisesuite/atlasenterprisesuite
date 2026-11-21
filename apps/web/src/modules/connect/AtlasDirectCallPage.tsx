import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  decodeAtlasDirectSignal,
  encodeAtlasDirectSignal,
  type AtlasDirectSignal
} from '../../lib/directCallSignaling';
import './atlas-direct-call.css';

type CallState =
  | 'idle' | 'microphone' | 'gathering' | 'offer-ready'
  | 'answer-ready' | 'connecting' | 'connected' | 'disconnected' | 'failed';

function stateLabel(state: CallState): string {
  const labels: Record<CallState, string> = {
    idle: 'Ready to start',
    microphone: 'Requesting microphone access',
    gathering: 'Collecting local-network connection details',
    'offer-ready': 'Offer ready to send',
    'answer-ready': 'Answer ready to return',
    connecting: 'Connecting both devices',
    connected: 'Internet voice connected',
    disconnected: 'Connection interrupted',
    failed: 'Unable to connect'
  };
  return labels[state];
}

function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', onChange);
      reject(new Error('ICE gathering timed out. Try the same Wi-Fi network.'));
    }, 20_000);
    function onChange() {
      if (pc.iceGatheringState === 'complete') {
        window.clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', onChange);
        resolve();
      }
    }
    pc.addEventListener('icegatheringstatechange', onChange);
    onChange();
  });
}

export function AtlasDirectCallPage() {
  const connectionRef = useRef<RTCPeerConnection | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callerRef = useRef(false);
  const busyRef = useRef(false);
  const [state, setState] = useState<CallState>('idle');
  const [incomingSignal, setIncomingSignal] = useState('');
  const [outgoingSignal, setOutgoingSignal] = useState('');
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<'caller' | 'receiver' | null>(null);

  function stopAll() {
    const pc = connectionRef.current;
    connectionRef.current = null;
    if (pc) {
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
    }
    microphoneRef.current?.getTracks().forEach((track) => track.stop());
    microphoneRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    callerRef.current = false;
    busyRef.current = false;
  }

  useEffect(() => () => {
    const pc = connectionRef.current;
    connectionRef.current = null;
    if (pc) pc.close();
    microphoneRef.current?.getTracks().forEach((track) => track.stop());
    microphoneRef.current = null;
  }, []);

  function hangup() {
    stopAll();
    setBusy(false);
    setRole(null);
    setMuted(false);
    setOutgoingSignal('');
    setIncomingSignal('');
    setError('');
    setState('idle');
  }

  async function prepareAudio() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      throw new Error('ATLAS Direct requires HTTPS and a browser with WebRTC microphone support.');
    }
    setState('microphone');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false
    });
    microphoneRef.current = stream;
    // No paid STUN/TURN service, no ATLAS backend, no phone network. LAN connectivity only.
    const pc = new RTCPeerConnection({ iceServers: [] });
    connectionRef.current = pc;
    stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));
    pc.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0] || new MediaStream([event.track]);
        remoteAudioRef.current.play().catch(() => undefined);
      }
    };
    pc.onconnectionstatechange = () => {
      if (connectionRef.current !== pc) return;
      switch (pc.connectionState) {
        case 'connected': setState('connected'); break;
        case 'connecting': setState('connecting'); break;
        case 'disconnected': setState('disconnected'); break;
        case 'failed':
        case 'closed': setState('failed'); break;
      }
    };
    return pc;
  }

  async function runSafely(work: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (cause) {
      stopAll();
      setRole(null);
      setState('failed');
      setOutgoingSignal('');
      setError(cause instanceof Error ? cause.message : 'WebRTC connection unavailable');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function createOffer() {
    if (connectionRef.current) return;
    runSafely(async () => {
      callerRef.current = true;
      setRole('caller');
      const pc = await prepareAudio();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      setState('gathering');
      await waitForIceGathering(pc);
      if (connectionRef.current !== pc) return;
      const sdp = pc.localDescription?.sdp;
      if (!sdp) throw new Error('No local audio offer was produced.');
      setOutgoingSignal(encodeAtlasDirectSignal({ type: 'offer', sdp }));
      setState('offer-ready');
    }).catch(() => undefined);
  }

  function acceptOffer() {
    if (connectionRef.current) return;
    runSafely(async () => {
      const signal = decodeAtlasDirectSignal(incomingSignal.trim());
      if (signal.type !== 'offer') throw new Error('Paste the caller\'s offer first.');
      callerRef.current = false;
      setRole('receiver');
      const pc = await prepareAudio();
      await pc.setRemoteDescription(signal);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      setState('gathering');
      await waitForIceGathering(pc);
      if (connectionRef.current !== pc) return;
      const sdp = pc.localDescription?.sdp;
      if (!sdp) throw new Error('No local audio answer was produced.');
      setOutgoingSignal(encodeAtlasDirectSignal({ type: 'answer', sdp }));
      setState('answer-ready');
    }).catch(() => undefined);
  }

  function acceptAnswer() {
    if (!connectionRef.current || !callerRef.current || !outgoingSignal) return;
    runSafely(async () => {
      const signal: AtlasDirectSignal = decodeAtlasDirectSignal(incomingSignal.trim());
      if (signal.type !== 'answer') throw new Error('Paste the receiver\'s answer first.');
      const pc = connectionRef.current;
      if (!pc) throw new Error('The outgoing call was ended.');
      if (pc.signalingState !== 'have-local-offer') throw new Error('This offer is no longer pending.');
      await pc.setRemoteDescription(signal);
      setState(pc.connectionState === 'connected' ? 'connected' : 'connecting');
      setIncomingSignal('');
    }).catch(() => undefined);
  }

  function toggleMute() {
    const tracks = microphoneRef.current?.getAudioTracks() || [];
    const next = !muted;
    tracks.forEach((track) => { track.enabled = !next; });
    setMuted(next);
  }

  async function copySignal() {
    if (!outgoingSignal) return;
    try {
      await navigator.clipboard.writeText(outgoingSignal);
    } catch {
      setError('Clipboard access unavailable. Select and copy the text manually.');
    }
  }

  async function playRemoteAudio() {
    try {
      await remoteAudioRef.current?.play();
    } catch {
      setError('Browser blocked playback. Check the audio output device.');
    }
  }

  const callActive = Boolean(connectionRef.current);
  return (
    <section className="page-stack atlas-direct" aria-labelledby="atlas-direct-title">
      <header className="page-header">
        <p className="eyebrow">ATLAS Wireless · Direct Communications</p>
        <h1 id="atlas-direct-title">ATLAS Direct Voice</h1>
        <p>Real browser-to-browser voice over an existing local Wi-Fi network. No carrier, paid SIM, phone number, server account or new Edge Function required.</p>
      </header>

      <div className="notice" role="note">
        This is <strong>internet-only voice</strong>, not cellular or PSTN service. It cannot dial phone numbers or reach 911. Use an existing telephone service for emergencies. Same-network connectivity is not guaranteed by every router or VPN.
      </div>

      <div className="stat-grid" aria-label="ATLAS Direct status">
        <article><strong>WebRTC</strong><span>encrypted media transport</span></article>
        <article><strong>Wi-Fi / LAN</strong><span>peer-to-peer connection target</span></article>
        <article><strong>{role || 'Not started'}</strong><span>device role</span></article>
        <article><strong>{stateLabel(state)}</strong><span>current state</span></article>
      </div>

      <div className="atlas-direct-grid">
        <article className="feature-card">
          <h2>1 · Start or answer</h2>
          <p>On one device, create an offer. On the other, paste it below and create the answer. Both devices must allow microphone access.</p>
          <div className="atlas-direct-actions">
            <button type="button" onClick={createOffer} disabled={busy || callActive}>Create call offer</button>
            <button type="button" onClick={acceptOffer} disabled={busy || callActive || !incomingSignal.trim()}>Answer received offer</button>
          </div>

          <label htmlFor="atlas-direct-incoming">Incoming connection details</label>
          <textarea id="atlas-direct-incoming" value={incomingSignal} onChange={(event) => setIncomingSignal(event.target.value)} disabled={busy} rows={5} maxLength={60200} spellCheck={false} placeholder="Paste the other device's WebRTC offer or answer here" />
          <div className="atlas-direct-actions">
            <button type="button" onClick={acceptAnswer} disabled={busy || !callActive || !callerRef.current || !outgoingSignal || !incomingSignal.trim()}>Connect with received answer</button>
          </div>
        </article>

        <article className="feature-card">
          <h2>2 · Send connection details</h2>
          <p>Copy the connection text to your other device using a trusted private channel, such as an authorized local transfer. Connection details can expose network information; do not publish them publicly.</p>
          <label htmlFor="atlas-direct-outgoing">Outgoing connection details</label>
          <textarea id="atlas-direct-outgoing" value={outgoingSignal} readOnly rows={7} spellCheck={false} placeholder="Your WebRTC offer or answer appears here" />
          <div className="atlas-direct-actions">
            <button type="button" onClick={() => { copySignal().catch(() => undefined); }} disabled={!outgoingSignal}>Copy details</button>
            <button type="button" onClick={playRemoteAudio} disabled={!callActive}>Enable speaker</button>
          </div>
          <audio ref={remoteAudioRef} controls autoPlay playsInline aria-label="Remote ATLAS Direct audio" />
        </article>
      </div>

      <article className="feature-card">
        <h2>3 · Call controls</h2>
        <div className="atlas-direct-actions">
          <button type="button" onClick={toggleMute} disabled={!callActive}>{muted ? 'Unmute microphone' : 'Mute microphone'}</button>
          <button className="atlas-direct-hangup" type="button" onClick={hangup} disabled={!callActive && state === 'idle'}>End and clear call</button>
        </div>
        <p role="status" aria-live="polite">{stateLabel(state)}</p>
        {error && <p className="atlas-direct-error" role="alert">{error}</p>}
        <p>Microphone tracks stop when you end the call or leave this page. Signaling stays only in the browser while this screen is open; ATLAS does not upload it to its servers.</p>
      </article>
      <div className="row-actions">
        <Link className="text-link" to="/connect/wireless">ATLAS Wireless</Link>
        <Link className="text-link" to="/connect/calling">Verified provider calling</Link>
        <Link className="text-link" to="/connect">ATLAS Connect</Link>
      </div>
    </section>
  );
}
