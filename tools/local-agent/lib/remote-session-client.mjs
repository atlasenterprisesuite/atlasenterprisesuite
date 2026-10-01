import { webcrypto } from 'node:crypto';
import { connectMtlsWebSocket } from './realtime-client.mjs';

const { subtle } = webcrypto;

function toBase64(value) {
  return Buffer.from(value).toString('base64');
}

function fromBase64(value) {
  return Buffer.from(String(value || ''), 'base64');
}

async function createKeyAgreement() {
  const keyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
  const publicRaw = await subtle.exportKey('raw', keyPair.publicKey);
  return { keyPair, publicKey: toBase64(publicRaw) };
}

async function deriveSharedKey(privateKey, remotePublicKey) {
  const remote = await subtle.importKey(
    'raw',
    fromBase64(remotePublicKey),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  return subtle.deriveKey(
    { name: 'ECDH', public: remote },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptBytes(key, bytes) {
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return { iv: toBase64(iv), data: toBase64(encrypted) };
}

async function decryptBytes(key, envelope) {
  const iv = fromBase64(envelope?.iv);
  const data = fromBase64(envelope?.data);
  if (iv.length !== 12 || !data.length) throw new Error('remote_envelope_invalid');
  const clear = await subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return Buffer.from(clear);
}

export async function startRemoteRelaySession({
  baseUrl,
  sessionId,
  sessionToken,
  certificate,
  privateKey,
  controller,
  expiresAt,
  onEnded = () => {}
}) {
  const url = new URL(baseUrl);
  url.pathname = '/_atlas/remote-bus/agent';
  url.search = '';
  url.searchParams.set('session_id', sessionId);

  const agreement = await createKeyAgreement();
  let sharedKey = null;
  let closed = false;
  let client = null;
  let frameBusy = false;

  async function handleMessage(message) {
    let event;
    try {
      event = JSON.parse(message);
    } catch {
      return;
    }

    if (event?.event === 'remote.key' && event.role === 'viewer' && event.public_key && !sharedKey) {
      try {
        sharedKey = await deriveSharedKey(agreement.keyPair.privateKey, String(event.public_key));
        client?.sendText(JSON.stringify({ event: 'remote.status', state: 'encrypted-channel-ready' }));
      } catch {
        client?.sendText(JSON.stringify({ event: 'remote.status', state: 'key-negotiation-failed' }));
      }
      return;
    }

    if (event?.event === 'remote.control' && sharedKey) {
      try {
        const clear = await decryptBytes(sharedKey, event);
        const control = JSON.parse(clear.toString('utf8'));
        await controller.executeControl(sessionId, control);
      } catch (error) {
        const code = String(error?.message || 'remote_control_failed').slice(0, 120);
        client?.sendText(JSON.stringify({ event: 'remote.status', state: 'control-error', code }));
      }
      return;
    }

    if (event?.event === 'remote.end') {
      closed = true;
      try { client?.close(); } catch {}
    }
  }

  client = await connectMtlsWebSocket({
    url: url.toString(),
    certificate,
    privateKey,
    headers: { 'x-atlas-agent-token': sessionToken },
    onMessage(message) {
      void handleMessage(message);
    },
    onClose() {
      closed = true;
    }
  });

  const keyMessage = JSON.stringify({
    event: 'remote.key',
    role: 'agent',
    public_key: agreement.publicKey
  });
  client.sendText(keyMessage);

  const handshakeTimer = setInterval(() => {
    if (!closed && !sharedKey) {
      try { client?.sendText(keyMessage); } catch {}
    }
  }, 2_000);

  const frameTimer = setInterval(() => {
    if (closed || !sharedKey || frameBusy) return;
    if (Date.now() >= new Date(expiresAt).getTime()) {
      closed = true;
      try { client?.sendText(JSON.stringify({ event: 'remote.status', state: 'expired' })); } catch {}
      try { client?.close(); } catch {}
      return;
    }

    frameBusy = true;
    void (async () => {
      try {
        const frame = await controller.captureFrame(sessionId, { target_width: 800, quality: 34 });
        const jpeg = fromBase64(frame.image_base64);
        const encrypted = await encryptBytes(sharedKey, jpeg);
        client?.sendText(JSON.stringify({
          event: 'remote.frame',
          mime: 'image/jpeg',
          width: frame.frame_width,
          height: frame.frame_height,
          source_width: frame.source_width,
          source_height: frame.source_height,
          ...encrypted
        }));
      } catch (error) {
        const code = String(error?.message || 'remote_frame_failed').slice(0, 120);
        try { client?.sendText(JSON.stringify({ event: 'remote.status', state: 'frame-error', code })); } catch {}
      } finally {
        frameBusy = false;
      }
    })();
  }, 550);

  const expiryTimer = setInterval(() => {
    if (closed || Date.now() < new Date(expiresAt).getTime()) return;
    closed = true;
    try { client?.close(); } catch {}
  }, 1_000);

  return {
    close(reason = 'ended') {
      if (closed) return;
      closed = true;
      clearInterval(handshakeTimer);
      clearInterval(frameTimer);
      clearInterval(expiryTimer);
      controller.endSession(sessionId);
      try { client?.sendText(JSON.stringify({ event: 'remote.status', state: reason })); } catch {}
      try { client?.close(); } catch {}
      onEnded(reason);
    },
    isClosed() {
      return closed;
    }
  };
}
