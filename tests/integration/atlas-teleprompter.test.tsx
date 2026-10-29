import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as creatorApi from '../../apps/web/src/lib/creatorApi';
import { TeleprompterPage, matchVoiceCursor } from '../../apps/web/src/modules/creator/teleprompter/TeleprompterPage';
import { TELEPROMPTER_SCRIPTS } from '../../apps/web/src/modules/creator/teleprompter/teleprompterScripts';

describe('ATLAS Smart Teleprompter', () => {
  const mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (mediaDevicesDescriptor) Object.defineProperty(navigator, 'mediaDevices', mediaDevicesDescriptor);
    else Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  function mockCamera(promise: Promise<MediaStream>) {
    const getUserMedia = vi.fn(() => promise);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia }
    });
    return getUserMedia;
  }

  it('keeps Spanish and English as separate script presets', () => {
    expect(TELEPROMPTER_SCRIPTS.es).toContain('Una plataforma. Cada solución. Control total.');
    expect(TELEPROMPTER_SCRIPTS.es).not.toContain('One Platform. Every Solution. Total Control.');
    expect(TELEPROMPTER_SCRIPTS.en).toContain('One Platform. Every Solution. Total Control.');
    expect(TELEPROMPTER_SCRIPTS.en).not.toContain('Una plataforma. Cada solución. Control total.');
  });

  it('advances from recognized speech without requiring a fixed timer', () => {
    const scriptWords = ['atlas', 'nacio', 'aqui', 'en', 'orlando', 'florida'];
    expect(matchVoiceCursor(scriptWords, 'ATLAS nació aquí en Orlando', 0)).toBe(4);
  });

  it('uses distinct bilingual script and camera panels with a recording status bar', () => {
    vi.spyOn(creatorApi, 'getCreatorRecordingReadiness').mockImplementation(() => new Promise(() => {}));
    const { container } = render(<MemoryRouter><TeleprompterPage /></MemoryRouter>);
    const stage = container.querySelector('.teleprompter-stage');
    expect(stage).not.toBeNull();
    expect(stage?.firstElementChild).toHaveClass('teleprompter-script-panel');
    expect(stage?.lastElementChild).toHaveClass('teleprompter-camera-panel');
    expect(screen.getByText('ATLAS · STUDIO 777')).toBeInTheDocument();
    expect(screen.getByText('Lectura sincronizada')).toBeInTheDocument();
    expect(screen.getByText('Grabación local · 00:00')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Guion'), { target: { value: 'en' } });
    expect(screen.getByText('Synchronized reading')).toBeInTheDocument();
    expect(screen.getByText('Local recording · 00:00')).toBeInTheDocument();
  });

  it('shows recording controls and verified private-storage readiness', async () => {
    vi.spyOn(creatorApi, 'getCreatorRecordingReadiness').mockResolvedValue({
      ok: true,
      service: 'atlas-creator-recordings',
      organization_id: 'org-1',
      connected: true,
      reason: null,
      upload_allowed: true,
      bucket: 'atlas-creator-recordings',
      checked_at: '2026-09-18T18:00:00Z'
    });
    render(<MemoryRouter><TeleprompterPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'ATLAS Teleprompter Inteligente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comenzar grabación' })).toBeInTheDocument();
    expect(await screen.findByText('Almacenamiento privado conectado')).toBeInTheDocument();
  });

  it('requires explicit opt-in before any automatic ATLAS cloud upload in Spanish', async () => {
    vi.spyOn(creatorApi, 'getCreatorRecordingReadiness').mockResolvedValue({
      ok: true, service: 'atlas-creator-recordings', organization_id: 'org-1',
      connected: true, reason: null, upload_allowed: true,
      bucket: 'atlas-creator-recordings', checked_at: '2026-10-28T00:00:00Z'
    });
    const upload = vi.spyOn(creatorApi, 'uploadCreatorRecording').mockRejectedValue(new Error('upload_not_expected'));
    render(<MemoryRouter><TeleprompterPage /></MemoryRouter>);
    const option = screen.getByLabelText('Guardar automáticamente en ATLAS') as HTMLInputElement;
    expect(await screen.findByText('Almacenamiento privado conectado')).toBeInTheDocument();
    expect(option).toBeEnabled();
    expect(option).not.toBeChecked();
    expect(upload).not.toHaveBeenCalled();
    fireEvent.click(option);
    expect(option).toBeChecked();
  });

  it('keeps cloud uploads opt-in after switching to the English script', async () => {
    vi.spyOn(creatorApi, 'getCreatorRecordingReadiness').mockResolvedValue({
      ok: true, service: 'atlas-creator-recordings', organization_id: 'org-1',
      connected: true, reason: null, upload_allowed: true,
      bucket: 'atlas-creator-recordings', checked_at: '2026-10-28T00:00:00Z'
    });
    render(<MemoryRouter><TeleprompterPage /></MemoryRouter>);
    expect(await screen.findByText('Almacenamiento privado conectado')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Guion'), { target: { value: 'en' } });
    expect(screen.getByLabelText('Automatically save to ATLAS')).not.toBeChecked();
  });

  it('fails closed against duplicate recording starts while camera permission is pending', () => {
    vi.spyOn(creatorApi, 'getCreatorRecordingReadiness').mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal('MediaRecorder', vi.fn());
    const getUserMedia = mockCamera(new Promise<MediaStream>(() => {}));
    render(<MemoryRouter><TeleprompterPage /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Comenzar grabación' }));
    expect(screen.getByRole('button', { name: 'Detener y guardar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Comenzar grabación' })).not.toBeInTheDocument();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('cancels a countdown without leaving an active recording request', async () => {
    vi.spyOn(creatorApi, 'getCreatorRecordingReadiness').mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal('MediaRecorder', vi.fn());
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const stop = vi.fn();
    mockCamera(Promise.resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream));
    render(<MemoryRouter><TeleprompterPage /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Comenzar grabación' }));
    expect(await screen.findByRole('button', { name: 'Detener y guardar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apagar cámara' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Detener y guardar' }));
    expect(screen.getByRole('button', { name: 'Comenzar grabación' })).toBeInTheDocument();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('does not label a bucket writable when upload permission is denied', async () => {
    vi.spyOn(creatorApi, 'getCreatorRecordingReadiness').mockResolvedValue({
      ok: true, service: 'atlas-creator-recordings', organization_id: 'org-1',
      connected: true, reason: null, upload_allowed: false,
      bucket: 'atlas-creator-recordings', checked_at: '2026-10-28T00:00:00Z'
    });
    render(<MemoryRouter><TeleprompterPage /></MemoryRouter>);
    expect(await screen.findByText('Almacenamiento privado no disponible')).toBeInTheDocument();
    expect(screen.getByLabelText('Guardar automáticamente en ATLAS')).toBeDisabled();
  });

  it('shares one pending camera request between camera preview and recording', () => {
    vi.spyOn(creatorApi, 'getCreatorRecordingReadiness').mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal('MediaRecorder', vi.fn());
    const getUserMedia = mockCamera(new Promise<MediaStream>(() => {}));
    render(<MemoryRouter><TeleprompterPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Activar cámara' }));
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar grabación' }));
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('cancels recording while camera permission is still pending and releases late tracks', async () => {
    vi.spyOn(creatorApi, 'getCreatorRecordingReadiness').mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal('MediaRecorder', vi.fn());
    let resolveMedia!: (stream: MediaStream) => void;
    mockCamera(new Promise<MediaStream>(resolve => { resolveMedia = resolve; }));
    const stop = vi.fn();
    render(<MemoryRouter><TeleprompterPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar grabación' }));
    fireEvent.click(screen.getByRole('button', { name: 'Detener y guardar' }));
    resolveMedia({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    expect(await screen.findByRole('button', { name: 'Comenzar grabación' })).toBeInTheDocument();
    await vi.waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
  });

  it('recovers a previously saved organization recording after reloading the page', async () => {
    vi.spyOn(creatorApi, 'getCreatorRecordingReadiness').mockResolvedValue({
      ok: true, service: 'atlas-creator-recordings', organization_id: 'org-a',
      connected: true, reason: null, upload_allowed: true, bucket: 'atlas-creator-recordings',
      checked_at: '2026-10-28T00:00:00Z'
    });
    const list = vi.spyOn(creatorApi, 'listCreatorRecordings').mockResolvedValue([{
      id: 'recording-a', organization_id: 'org-a', created_by: 'user-a', language: 'es',
      mime_type: 'video/mp4', file_size_bytes: 2048, duration_seconds: 12,
      created_at: '2026-10-28T00:00:00Z'
    }]);
    vi.spyOn(creatorApi, 'getCreatorRecordingDownload').mockResolvedValue({
      ok: true, recording: {} as creatorApi.CreatorRecording,
      signed_url: 'https://example.test/signed', expires_in: 120
    });
    render(<MemoryRouter><TeleprompterPage /></MemoryRouter>);
    expect(await screen.findByText('Mis grabaciones en ATLAS')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir grabación recording-a' }));
    expect(await screen.findByRole('link', { name: 'Abrir copia privada' })).toHaveAttribute('href', 'https://example.test/signed');
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('switches to the independent English script and interface', () => {
    vi.spyOn(creatorApi, 'getCreatorRecordingReadiness').mockImplementation(() => new Promise(() => {}));
    render(<MemoryRouter><TeleprompterPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Guion'), { target: { value: 'en' } });
    expect(screen.getByRole('heading', { name: 'ATLAS Smart Teleprompter' })).toBeInTheDocument();
    expect(screen.getByLabelText('Script')).toHaveValue('en');
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeInTheDocument();
  });
});
