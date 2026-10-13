import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createBrowserAssistSignal,
  parseBrowserAssistSignal,
  assertMatchingAnswer,
  BROWSER_ASSIST_PAIRING_MS,
} from '../../apps/web/src/modules/device-os/browserAssistSignal';

const offerSdp=[
  'v=0','o=- 345 2 IN IP4 127.0.0.1','s=-','t=0 0',
  'm=video 9 UDP/TLS/RTP/SAVPF 96',
  'a=mid:0',
  'a=ice-ufrag:abc123',
  'a=ice-pwd:abcdefabcdefabcdefabcdef',
  'a=fingerprint:sha-256 11:22:33:44',
  'a=setup:actpass',
].join('\r\n')+'\r\n';
const sessionId='11111111-1111-4111-8111-111111111111';
const now=Date.parse('2026-10-12T14:00:00Z');

describe('ATLAS opt-in browser screen assistance',()=>{
  it('roundtrips a short-lived video-only WebRTC offer with an explicit identity',()=>{
    const code=createBrowserAssistSignal({type:'offer',sessionId,sdp:offerSdp},now);
    const parsed=parseBrowserAssistSignal(code,'offer',now+5000);
    expect(parsed).toEqual({type:'offer',sessionId,sdp:offerSdp,expiresAt:now+BROWSER_ASSIST_PAIRING_MS});
    expect(code).not.toContain('http:');
    expect(code).not.toContain('token');
  });
  it('rejects expired, wrong type, malformed, oversized, and data-only pairing messages',()=>{
    const code=createBrowserAssistSignal({type:'offer',sessionId,sdp:offerSdp},now);
    expect(()=>parseBrowserAssistSignal(code,'answer',now+1000)).toThrow('signal_type_mismatch');
    expect(()=>parseBrowserAssistSignal(code,'offer',now+BROWSER_ASSIST_PAIRING_MS+1)).toThrow('signal_expired');
    expect(()=>parseBrowserAssistSignal('invalid code','offer',now)).toThrow();
    expect(()=>parseBrowserAssistSignal('x'.repeat(250000),'offer',now)).toThrow();
    expect(()=>createBrowserAssistSignal({type:'offer',sessionId,sdp:'v=0\r\nm=application 9 DTLS/SCTP 5000'},now)).toThrow('video_transport_required');
    expect(()=>createBrowserAssistSignal({type:'offer',sessionId:'invalid',sdp:offerSdp},now)).toThrow('invalid_signal_session');
  });
  it('rejects a response for a different sharing session',()=>{
    const answer=createBrowserAssistSignal({type:'answer',sessionId,sdp:offerSdp},now);
    const parsed=parseBrowserAssistSignal(answer,'answer',now+1000);
    expect(()=>assertMatchingAnswer(parsed,'22222222-2222-4222-8222-222222222222')).toThrow('session_mismatch');
    expect(assertMatchingAnswer(parsed,sessionId)).toBe(parsed);
  });
  it('only adds browser screen tracks, never input injection or unattended control',()=>{
    const p=readFileSync('apps/web/src/modules/device-os/BrowserScreenAssist.tsx','utf8');
    expect(p).toContain('navigator.mediaDevices.getDisplayMedia');
    expect(p).toContain('audio: false');
    expect(p).toContain('getTracks().forEach');
    expect(p).toContain('Stop sharing and disconnect');
    expect(p).toContain('Use a trusted private channel to exchange');
    expect(p).not.toMatch(/\.createDataChannel\(|remote\.desktop\.control|sendInput|simulateKey|keylog|clipboard\.readText/);
    expect(p).toContain('generation.current += 1; // Invalidate pending permissions');
    expect(p).toContain('if (attempt !== generation.current)');
    expect(p).toContain('stream.getTracks().forEach(track => track.stop())');
  });
  it('integrates with existing Remote Assist and leaves the native signed-agent gate unchanged',()=>{
    const panel=readFileSync('apps/web/src/modules/device-os/RemoteAssistPanel.tsx','utf8');
    const native=readFileSync('docs/architecture/ATLAS_REMOTE_ASSIST.md','utf8');
    expect(panel).toContain('<BrowserScreenAssist />');
    expect(panel).toContain("agent.mtls_status === 'active'");
    expect(panel).toContain('Native adapter required');
    expect(native).toContain('remote.desktop.control');
    expect(native).toContain('No data channel, input injection');
    expect(native).toContain('not a Zero Trust enterprise Remote Desktop session');
    const workOS=readFileSync('apps/web/src/work/WorkOSPage.tsx','utf8');
    const deviceOS=readFileSync('apps/web/src/modules/device-os/DeviceOSPage.tsx','utf8');
    expect(workOS).toContain("name: 'Screen Share Pilot'");
    expect(workOS).toContain("to: '/device-os#remote-assist-title'");
    expect(workOS).toContain('no remote control or unattended access');
    expect(deviceOS).toContain('Open Remote Assist screen sharing pilot');
  });
});
