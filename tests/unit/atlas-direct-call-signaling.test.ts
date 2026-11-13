import { describe, expect, it } from 'vitest';
import { decodeAtlasDirectSignal, encodeAtlasDirectSignal } from '../../apps/web/src/lib/directCallSignaling';

const offerSdp = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=fingerprint:sha-256 AA:BB\r\n';
const answerSdp = 'v=0\r\no=- 3 4 IN IP4 127.0.0.1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=fingerprint:sha-256 CC:DD\r\n';

describe('ATLAS Direct WebRTC manual signaling', () => {
  it('roundtrips a verified audio-only offer', () => {
    expect(decodeAtlasDirectSignal(encodeAtlasDirectSignal({ type: 'offer', sdp: offerSdp })))
      .toEqual({ type: 'offer', sdp: offerSdp });
  });

  it('roundtrips a verified audio-only answer', () => {
    expect(decodeAtlasDirectSignal(encodeAtlasDirectSignal({ type: 'answer', sdp: answerSdp })))
      .toEqual({ type: 'answer', sdp: answerSdp });
  });

  it('rejects invalid data and arbitrary signal kinds', () => {
    for (const payload of ['not json', 'null', '{}', '{"type":"candidate","sdp":"v=0"}', '{"type":"offer","sdp":5}']) {
      expect(() => decodeAtlasDirectSignal(payload)).toThrow();
    }
  });

  it('rejects SDP without audio or DTLS fingerprint', () => {
    expect(() => encodeAtlasDirectSignal({ type: 'offer', sdp: 'v=0\r\nm=audio 9 RTP/AVP 0\r\n' })).toThrow();
    expect(() => decodeAtlasDirectSignal(JSON.stringify({ type: 'offer', sdp: 'v=0\r\na=fingerprint:sha-256 AA:BB\r\n' }))).toThrow();
  });

  it('rejects video/data-channel negotiation and excessive input', () => {
    expect(() => encodeAtlasDirectSignal({ type: 'offer', sdp: offerSdp + 'm=video 9 RTP/SAVPF 100\r\n' })).toThrow();
    expect(() => encodeAtlasDirectSignal({ type: 'offer', sdp: offerSdp + 'm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n' })).toThrow();
    expect(() => decodeAtlasDirectSignal('x'.repeat(70_000))).toThrow();
  });
});
