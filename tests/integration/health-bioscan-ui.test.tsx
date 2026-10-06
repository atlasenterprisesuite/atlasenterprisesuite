import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BioScanPage } from '../../apps/web/src/modules/health/bioscan/BioScanPage';
import { BodyTwinPage } from '../../apps/web/src/modules/health/bioscan/BodyTwinPage';
import * as repository from '../../apps/web/src/modules/health/bioscan/bioscanRepository';

vi.mock('../../apps/web/src/modules/health/bioscan/bioscanRepository', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/modules/health/bioscan/bioscanRepository')>(
    '../../apps/web/src/modules/health/bioscan/bioscanRepository'
  );
  return {
    ...actual,
    loadBioScanCapabilities: vi.fn(),
    ensureBioScanConsent: vi.fn(),
    removeBioScanConsent: vi.fn(),
    beginBioScanSession: vi.fn(),
    advanceBioScanSession: vi.fn(),
    saveBioScanSnapshot: vi.fn(),
    loadBioScanWorkspace: vi.fn()
  };
});

const capabilities = {
  ok: true as const,
  api_version: 1 as const,
  domain: 'bioscan' as const,
  role: 'owner',
  permissions: { read: true, capture: true, manage: true, audit: true },
  capture_modes: { camera: true, camera_depth: false, lidar: false },
  raw_frame_persistence: false as const,
  truth_rule: 'NO DATA -> NO CLAIM'
};

function setMediaDevices(value: MediaDevices | undefined) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value
  });
}

function renderBioScan() {
  return render(<MemoryRouter><BioScanPage /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(repository.loadBioScanCapabilities).mockResolvedValue(capabilities);
  vi.mocked(repository.ensureBioScanConsent).mockResolvedValue({
    id: '11111111-1111-4111-8111-111111111111',
    subject_user_id: '22222222-2222-4222-8222-222222222222',
    scope: 'body_scan',
    status: 'granted',
    granted_at: '2026-10-05T10:00:00.000Z',
    expires_at: null,
    policy_version: 'bioscan-consent-v1'
  });
});

describe('ATLAS BioScan camera-only experience', () => {
  it('starts fail-closed at the explicit consent gate and does not invent measurements', async () => {
    renderBioScan();
    await screen.findByText('Consent required');
    expect(screen.getByRole('button', { name: 'Grant body-scan consent' })).toBeEnabled();
    expect(screen.getAllByText('Not measured').length).toBeGreaterThan(0);
    expect(screen.queryByText(/100%/)).not.toBeInTheDocument();
  });

  it('opens a local user-facing camera only after consent and labels degraded camera-only mode', async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    setMediaDevices({ getUserMedia } as unknown as MediaDevices);

    renderBioScan();
    await screen.findByText('Consent required');
    fireEvent.click(screen.getByRole('button', { name: 'Grant body-scan consent' }));
    await screen.findByText('Consent granted');
    fireEvent.click(screen.getByRole('button', { name: 'Enable camera' }));

    await screen.findByText('Camera ready');
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'user' }, audio: false });
    expect(screen.getByText('Camera-only mode')).toBeInTheDocument();
    expect(screen.getByText(/Depth and LiDAR are not represented as connected/i)).toBeInTheDocument();
    expect(screen.getAllByText('Not measured').length).toBeGreaterThan(0);
  });

  it('shows camera permission failure without a fabricated completed scan', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    setMediaDevices({ getUserMedia } as unknown as MediaDevices);

    renderBioScan();
    await screen.findByText('Consent required');
    fireEvent.click(screen.getByRole('button', { name: 'Grant body-scan consent' }));
    await screen.findByText('Consent granted');
    fireEvent.click(screen.getByRole('button', { name: 'Enable camera' }));

    await screen.findByText('Camera access denied');
    expect(screen.queryByText(/COMPLETE 100%/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('Not measured').length).toBeGreaterThan(0);
  });

  it('shows an explicit unavailable state when mediaDevices is absent', async () => {
    setMediaDevices(undefined);
    renderBioScan();
    await screen.findByText('Consent required');
    fireEvent.click(screen.getByRole('button', { name: 'Grant body-scan consent' }));
    await screen.findByText('Consent granted');
    fireEvent.click(screen.getByRole('button', { name: 'Enable camera' }));
    await screen.findByText('Camera unavailable');
    expect(screen.queryByText(/100%/)).not.toBeInTheDocument();
  });

  it('stops all local camera tracks on cancel/unmount', async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }, { stop }] } as unknown as MediaStream;
    setMediaDevices({ getUserMedia: vi.fn().mockResolvedValue(stream) } as unknown as MediaDevices);

    const view = renderBioScan();
    await screen.findByText('Consent required');
    fireEvent.click(screen.getByRole('button', { name: 'Grant body-scan consent' }));
    await screen.findByText('Consent granted');
    fireEvent.click(screen.getByRole('button', { name: 'Enable camera' }));
    await screen.findByText('Camera ready');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel camera' }));
    expect(stop).toHaveBeenCalledTimes(2);

    await act(async () => view.unmount());
    expect(stop).toHaveBeenCalledTimes(2);
  });
});

describe('ATLAS Human Digital Twin history', () => {
  it('renders a truthful empty state with no synthetic avatar or metrics', async () => {
    vi.mocked(repository.loadBioScanWorkspace).mockResolvedValue({ capabilities, snapshots: [], loadedAt: '2026-10-05T10:00:00.000Z' });
    render(<MemoryRouter><BodyTwinPage /></MemoryRouter>);
    await screen.findByText('No saved body snapshots');
    expect(screen.queryByText(/synthetic avatar/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/body fat/i)).not.toBeInTheDocument();
  });

  it('renders immutable history and preserves provenance/source metadata', async () => {
    vi.mocked(repository.loadBioScanWorkspace).mockResolvedValue({
      capabilities,
      loadedAt: '2026-10-05T10:00:00.000Z',
      snapshots: [
        {
          id: 'snap-1', sessionId: 'session-1', capturedAt: '2026-10-04T12:00:00.000Z', captureMode: 'camera',
          geometryVersion: 'camera-metadata-v1', coordinateSystem: 'screen-normalized', meshRef: null,
          sourceSummary: { capture_mode: 'camera', raw_frame_persisted: false }, confidenceSummary: {}
        },
        {
          id: 'snap-2', sessionId: 'session-2', capturedAt: '2026-10-05T12:00:00.000Z', captureMode: 'camera',
          geometryVersion: 'camera-metadata-v1', coordinateSystem: 'screen-normalized', meshRef: null,
          sourceSummary: { capture_mode: 'camera', raw_frame_persisted: false }, confidenceSummary: { coverage: 'not_measured' }
        }
      ]
    });
    render(<MemoryRouter><BodyTwinPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Human Digital Twin' });
    expect(screen.getAllByRole('button', { name: /snapshot/i })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /snapshot 1/i }));
    await waitFor(() => expect(screen.getByText(/raw_frame_persisted/i)).toBeInTheDocument());
    expect(screen.getByText(/camera-metadata-v1/i)).toBeInTheDocument();
    expect(screen.getByText(/screen-normalized/i)).toBeInTheDocument();
  });

  it('fails closed when the authorized history backend is unavailable', async () => {
    vi.mocked(repository.loadBioScanWorkspace).mockRejectedValue(new Error('bioscan_http_503:backend_unavailable'));
    render(<MemoryRouter><BodyTwinPage /></MemoryRouter>);
    await screen.findByText('Body Twin unavailable');
    expect(screen.getByText(/No snapshot or body metric is inferred/i)).toBeInTheDocument();
  });
});
