export type AtlasDirectSignal = Readonly<{
  type: 'offer' | 'answer';
  sdp: string;
}>;

const MAX_SIGNAL_CHARS = 60_000;
const audioLine = /^m=audio\s/m;
const dtlsFingerprint = /^a=fingerprint:sha-(256|384|512)\s+[A-Fa-f0-9:]+\s*$/m;
const forbiddenMedia = /^m=(video|application|text|message)\s/m;

function validatedSignal(input: unknown): AtlasDirectSignal {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('invalid_direct_call_signal');
  }
  const candidate = input as Record<string, unknown>;
  if (candidate.type !== 'offer' && candidate.type !== 'answer') {
    throw new Error('invalid_direct_call_signal_type');
  }
  const sdp = candidate.sdp;
  if (typeof sdp !== 'string' || sdp.length < 20 || sdp.length > MAX_SIGNAL_CHARS
    || !sdp.startsWith('v=0') || !audioLine.test(sdp)
    || !dtlsFingerprint.test(sdp) || forbiddenMedia.test(sdp)) {
    throw new Error('audio_only_dtls_sdp_required');
  }
  return { type: candidate.type, sdp };
}

export function encodeAtlasDirectSignal(input: AtlasDirectSignal): string {
  return JSON.stringify(validatedSignal(input));
}

export function decodeAtlasDirectSignal(value: string): AtlasDirectSignal {
  if (typeof value !== 'string' || value.length > MAX_SIGNAL_CHARS + 200) {
    throw new Error('direct_call_signal_too_large');
  }
  try {
    return validatedSignal(JSON.parse(value));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('audio_only_')) throw error;
    throw new Error('invalid_direct_call_signal');
  }
}
