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

  it('fails closed against duplicate recording starts while camera permission is pending', () => {
    vi.spyOn(creatorApi, 'getCreatorRecordingReadiness').mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal('MediaRecorder', vi.fn());
    const getUserMedia = mockCamera(new Promise<MediaStream>(() => {}));
    render(<MemoryRouter><TeleprompterPage /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Comenzar grabación' }));
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar grabación' }));

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

  it('switches to the independent English script and interface', () => {
    vi.spyOn(creatorApi, 'getCreatorRecordingReadiness').mockImplementation(() => new Promise(() => {}));
    render(<MemoryRouter><TeleprompterPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Guion'), { target: { value: 'en' } });
    expect(screen.getByRole('heading', { name: 'ATLAS Smart Teleprompter' })).toBeInTheDocument();
    expect(screen.getByLabelText('Script')).toHaveValue('en');
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeInTheDocument();
  });
});
