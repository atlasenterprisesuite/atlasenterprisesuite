import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as creatorApi from '../../apps/web/src/lib/creatorApi';
import { TeleprompterPage, matchVoiceCursor } from '../../apps/web/src/modules/creator/teleprompter/TeleprompterPage';
import { TELEPROMPTER_SCRIPTS } from '../../apps/web/src/modules/creator/teleprompter/teleprompterScripts';

describe('ATLAS Smart Teleprompter', () => {
  afterEach(() => vi.restoreAllMocks());

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

  it('switches to the independent English script and interface', () => {
    vi.spyOn(creatorApi, 'getCreatorRecordingReadiness').mockImplementation(() => new Promise(() => {}));
    render(<MemoryRouter><TeleprompterPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Guion'), { target: { value: 'en' } });
    expect(screen.getByRole('heading', { name: 'ATLAS Smart Teleprompter' })).toBeInTheDocument();
    expect(screen.getByLabelText('Script')).toHaveValue('en');
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeInTheDocument();
  });
});
