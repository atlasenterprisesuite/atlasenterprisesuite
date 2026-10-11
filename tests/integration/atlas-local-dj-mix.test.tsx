import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalDJMixPage } from '../../apps/web/src/modules/creator/music/LocalDJMixPage';


vi.mock('../../packages/creator/audio/local_analysis', async importOriginal => {
  const original = await importOriginal<typeof import('../../packages/creator/audio/local_analysis')>();
  return {
    ...original,
    analyzeLocalAudioFile: vi.fn(async () => ({
      method: 'local-signal-estimate-v1',
      durationAnalyzedSeconds: 30,
      energyPercent: 48,
      peakDbfs: -1.2,
      rmsDbfs: -11.5,
      bpm: 120,
      bpmConfidence: 70,
      camelot: '8B',
      keyConfidence: 66,
      onsetCount: 40
    }))
  };
});

afterEach(() => vi.unstubAllGlobals());

describe('ATLAS Local DJ browser-only UI', () => {
  it('populates BPM and key only after user-directed local analysis', async () => {
    const OriginalURL = URL;
    vi.stubGlobal('URL', class extends OriginalURL {
      static createObjectURL() { return 'blob:atlas-local-dj-test'; }
      static revokeObjectURL() {}
    });
    render(<MemoryRouter><LocalDJMixPage /></MemoryRouter>);
    const file = new File(['audio-test'], 'pulse.wav', { type: 'audio/wav' });
    fireEvent.change(screen.getByLabelText('Add audio files'), { target: { files: [file] } });
    expect(screen.getByRole('button', { name: 'Analyze pulse' })).toBeEnabled();
    expect(screen.getByLabelText('BPM for pulse')).toHaveValue(null);
    fireEvent.click(screen.getByRole('button', { name: 'Analyze pulse' }));
    expect(await screen.findByText(/Audio DNA analyzed pulse/)).toBeInTheDocument();
    expect(screen.getByLabelText('BPM for pulse')).toHaveValue(120);
    expect(screen.getByLabelText('Camelot key for pulse')).toHaveValue('8B');
    expect(screen.getByText(/Audio DNA · Energy 48%/)).toBeInTheDocument();
  });

  it('offers a working input and honest capability limits without fabricated songs', () => {
    render(<MemoryRouter><LocalDJMixPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'ATLAS Local DJ' })).toBeInTheDocument();
    expect(screen.getByLabelText('Add audio files')).toHaveAttribute('type', 'file');
    expect(screen.getByRole('button', { name: 'Play mix' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Smart reorder' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Analyze playlist locally' })).toBeDisabled();
    expect(screen.getByText(/no audio export, recording, cloud persistence, license validation, guaranteed beat detection/i)).toBeInTheDocument();
    expect(screen.getByText(/30 MB per file and inspects at most the first 90 seconds/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Music Lab' })).toHaveAttribute('href', '/studio/create?type=music');
  });
});
