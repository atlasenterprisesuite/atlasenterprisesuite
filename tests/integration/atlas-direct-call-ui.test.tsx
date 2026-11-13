import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AtlasDirectCallPage } from '../../apps/web/src/modules/connect/AtlasDirectCallPage';

const offerSdp = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=fingerprint:sha-256 AA:BB\r\n';
const answerSdp = 'v=0\r\no=- 3 4 IN IP4 127.0.0.1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=fingerprint:sha-256 CC:DD\r\n';

const stop = vi.fn();
const track = { enabled: true, stop };
let getUserMedia = vi.fn();

class MockPeerConnection {
  iceGatheringState = 'complete';
  signalingState = 'stable';
  connectionState = 'new';
  localDescription: { type: string; sdp: string } | null = null;
  ontrack: ((event: unknown) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  addTrack = vi.fn();
  createOffer = vi.fn(async () => ({ type: 'offer', sdp: offerSdp }));
  createAnswer = vi.fn(async () => ({ type: 'answer', sdp: answerSdp }));
  async setLocalDescription(signal: { type: string; sdp: string }) {
    this.localDescription = signal;
    this.signalingState = signal.type === 'offer' ? 'have-local-offer' : 'stable';
  }
  async setRemoteDescription() {}
  addEventListener() {}
  removeEventListener() {}
  close = vi.fn();
}

function mount() {
  getUserMedia = vi.fn(async () => ({
    getTracks: () => [track],
    getAudioTracks: () => [track]
  }));
  vi.stubGlobal('RTCPeerConnection', MockPeerConnection);
  vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true, value: { getUserMedia }
  });
  return render(<MemoryRouter><AtlasDirectCallPage /></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  stop.mockClear();
  track.enabled = true;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
});

describe('ATLAS Direct voice UX', () => {
  it('does not open the microphone without an explicit user gesture', () => {
    mount();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(screen.getByRole('note')).toHaveTextContent('It cannot dial phone numbers or reach 911.');
  });

  it('creates local offer, keeps it private, and releases microphone on hangup', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Create call offer' }));
    await waitFor(() => expect(screen.queryAllByText('Offer ready to send').length).toBeGreaterThan(0));
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText('Outgoing connection details') as HTMLTextAreaElement).value)
      .toContain('m=audio');
    fireEvent.click(screen.getByRole('button', { name: 'End and clear call' }));
    expect(stop).toHaveBeenCalled();
    expect((screen.getByLabelText('Outgoing connection details') as HTMLTextAreaElement).value)
      .toBe('');
  });

  it('rejects invalid remote signaling before requesting microphone access', async () => {
    mount();
    fireEvent.change(screen.getByLabelText('Incoming connection details'), { target: { value: '{"type":"data","sdp":"bad"}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Answer received offer' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});
