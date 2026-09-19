import { resolveAssistantModule } from '../../assistant/routeContext';
import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../lib/atlasSession';

export type AtlasRealtimeState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'closed'
  | 'error';

export type AtlasRealtimeEvent = Record<string, unknown> & {
  type?: string;
  transcript?: string;
  delta?: string;
};

export type AtlasRealtimeSession = {
  peer: RTCPeerConnection;
  channel: RTCDataChannel;
  remoteStream: MediaStream;
  localStream: MediaStream;
  send(event: Record<string, unknown>): void;
  interrupt(): void;
  close(): void;
};

export type CreateAtlasRealtimeSessionInput = {
  pathname: string;
  onState?: (state: AtlasRealtimeState) => void;
  onEvent?: (event: AtlasRealtimeEvent) => void;
  onRemoteStream?: (stream: MediaStream) => void;
};

export function isAtlasRealtimeSupported() {
  return typeof RTCPeerConnection !== 'undefined'
    && typeof navigator !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia);
}

async function readRealtimeError(response: Response) {
  const text = await response.text();
  try {
    const parsed = text ? JSON.parse(text) : {};
    return String(parsed?.error || parsed?.message || `realtime_request_failed_${response.status}`);
  } catch {
    return text || `realtime_request_failed_${response.status}`;
  }
}

export async function createAtlasRealtimeSession(
  input: CreateAtlasRealtimeSessionInput
): Promise<AtlasRealtimeSession> {
  if (!isAtlasRealtimeSupported()) throw new Error('realtime_webrtc_unsupported');

  input.onState?.('connecting');
  const organization = await getActiveAtlasOrganization();
  const peer = new RTCPeerConnection();
  const remoteStream = new MediaStream();
  let localStream: MediaStream | null = null;
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    for (const track of localStream?.getTracks() || []) track.stop();
    for (const sender of peer.getSenders()) sender.track?.stop();
    try {
      peer.close();
    } catch {
      // Browser-specific peer shutdown errors are non-fatal during cleanup.
    }
  };

  try {
    peer.ontrack = (event) => {
      for (const track of event.streams[0]?.getTracks() || [event.track]) {
        if (!remoteStream.getTracks().some((existing) => existing.id === track.id)) {
          remoteStream.addTrack(track);
        }
      }
      input.onRemoteStream?.(remoteStream);
    };

    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    for (const track of localStream.getTracks()) peer.addTrack(track, localStream);

    const channel = peer.createDataChannel('oai-events');
    channel.addEventListener('open', () => input.onState?.('connected'));
    channel.addEventListener('close', () => input.onState?.('closed'));
    channel.addEventListener('error', () => input.onState?.('error'));
    channel.addEventListener('message', (event) => {
      try {
        const parsed = JSON.parse(String(event.data || '{}')) as AtlasRealtimeEvent;
        input.onEvent?.(parsed);
      } catch {
        input.onEvent?.({ type: 'atlas.realtime.invalid_event' });
      }
    });

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    const sdp = peer.localDescription?.sdp;
    if (!sdp) throw new Error('realtime_offer_missing');

    const response = await authorizedAtlasFetch('/functions/v1/atlas-copilot?api=realtime-call', {
      method: 'POST',
      headers: {
        'content-type': 'application/sdp',
        'x-atlas-org-id': organization.id,
        'x-atlas-realtime-module': resolveAssistantModule(input.pathname)
      },
      body: sdp
    });

    if (!response.ok) throw new Error(await readRealtimeError(response));
    const answerSdp = await response.text();
    if (!answerSdp.trim()) throw new Error('realtime_answer_missing');

    await peer.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    const session: AtlasRealtimeSession = {
      peer,
      channel,
      remoteStream,
      localStream,
      send(event) {
        if (channel.readyState !== 'open') throw new Error('realtime_channel_not_open');
        channel.send(JSON.stringify(event));
      },
      interrupt() {
        if (channel.readyState !== 'open') return;
        channel.send(JSON.stringify({ type: 'response.cancel' }));
        channel.send(JSON.stringify({ type: 'output_audio_buffer.clear' }));
      },
      close() {
        if (channel.readyState === 'open') {
          try {
            channel.close();
          } catch {
            // Continue with peer and track cleanup.
          }
        }
        cleanup();
        input.onState?.('closed');
      }
    };

    return session;
  } catch (error) {
    cleanup();
    input.onState?.('error');
    throw error;
  }
}
