/**
 * One-time copy/paste signaling for a browser-to-browser, video-only WebRTC session.
 *
 * This is NOT a native desktop-control adapter, and it is NOT organization-authenticated
 * signaling. Operators must confirm the other participant through a trusted channel.
 * The SDP may expose ICE/network metadata; never place it in a public ticket or log.
 */
export const BROWSER_ASSIST_PAIRING_MS = 10 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SIGNAL_LENGTH = 160000;
const MAX_SDP_LENGTH = 75000;

type SignalType = 'offer' | 'answer';
export type BrowserAssistSignal = {
  type: SignalType;
  sessionId: string;
  sdp: string;
  expiresAt: number;
};

function validSdp(sdp: string): boolean {
  return typeof sdp === 'string'
    && sdp.length > 20
    && sdp.length <= MAX_SDP_LENGTH
    && sdp.startsWith('v=0')
    && /(?:^|\r?\n)m=video /m.test(sdp)
    && /(?:^|\r?\n)a=fingerprint:sha-256 /im.test(sdp)
    && !/(?:^|\r?\n)m=(?:application|audio) /im.test(sdp);
}

function encode(value: BrowserAssistSignal): string {
  const raw = JSON.stringify({ v: 1, ...value });
  if (raw.length > MAX_SIGNAL_LENGTH) throw new Error('signal_too_large');
  const bytes = new TextEncoder().encode(raw);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createBrowserAssistSignal(
  { type, sessionId, sdp }: Pick<BrowserAssistSignal, 'type' | 'sessionId' | 'sdp'>,
  now = Date.now(),
): string {
  if (type !== 'offer' && type !== 'answer') throw new Error('invalid_signal_type');
  if (!UUID.test(sessionId)) throw new Error('invalid_signal_session');
  if (!validSdp(sdp)) throw new Error('video_transport_required');
  if (!Number.isFinite(now) || now <= 0) throw new Error('invalid_signal_time');
  return encode({ type, sessionId: sessionId.toLowerCase(), sdp, expiresAt: now + BROWSER_ASSIST_PAIRING_MS });
}

export function parseBrowserAssistSignal(
  code: string, expected: SignalType, now = Date.now(),
): BrowserAssistSignal {
  if (!code || code.length > MAX_SIGNAL_LENGTH || !/^[A-Za-z0-9_-]+$/.test(code)) {
    throw new Error('invalid_signal_format');
  }
  let raw: unknown;
  try {
    const base64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('invalid_signal_format');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid_signal_format');
  const data = raw as Record<string, unknown>;
  if (data.v !== 1 || (data.type !== 'offer' && data.type !== 'answer') ||
      typeof data.sessionId !== 'string' || !UUID.test(data.sessionId) ||
      typeof data.sdp !== 'string' || !validSdp(data.sdp)) {
    throw new Error('invalid_signal_payload');
  }
  if (data.type !== expected) throw new Error('signal_type_mismatch');
  if (typeof data.expiresAt !== 'number' || !Number.isFinite(data.expiresAt) ||
      data.expiresAt <= now || data.expiresAt > now + BROWSER_ASSIST_PAIRING_MS) {
    throw new Error('signal_expired');
  }
  return { type: data.type, sessionId: data.sessionId.toLowerCase(), sdp: data.sdp, expiresAt: data.expiresAt };
}

export function assertMatchingAnswer(answer: BrowserAssistSignal, sessionId: string): BrowserAssistSignal {
  if (answer.type !== 'answer' || answer.sessionId !== sessionId.toLowerCase()) {
    throw new Error('session_mismatch');
  }
  return answer;
}
