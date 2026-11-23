import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NeuroacousticSoundLab } from '../../apps/web/src/modules/creator/music/NeuroacousticSoundLab';

afterEach(() => vi.unstubAllGlobals());

describe('ATLAS Neuroacoustic Sound Lab experience', () => {
  it('exposes user-selected offline audio types without autoplay or clinical claims', () => {
    const contextConstructor = vi.fn();
    vi.stubGlobal('AudioContext', contextConstructor);
    render(<MemoryRouter><NeuroacousticSoundLab /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Neuroacoustic Sound Lab' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Alpha · 10 Hz/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Stop' })).toBeDisabled();
    expect(contextConstructor).not.toHaveBeenCalled();
    expect(screen.getByText(/not medical treatments or guaranteed changes/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Audio category'), { target: { value: 'nature' } });
    expect(screen.getByRole('button', { name: /Soft rain/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /Alpha · 10 Hz/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ocean-like wash/ }));
    expect(screen.getByRole('button', { name: /Ocean-like wash/ })).toHaveAttribute('aria-pressed', 'true');
    expect(contextConstructor).not.toHaveBeenCalled();
  });

  it('shows honest frequency separation for binaural versus single reference tones', () => {
    render(<MemoryRouter><NeuroacousticSoundLab /></MemoryRouter>);
    expect(screen.getByText(/Left 180 Hz \/ right 190 Hz/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Audio category'), { target: { value: 'reference-tone' } });
    expect(screen.getByText(/Single audible 432 Hz tone/)).toBeInTheDocument();
    expect(screen.getByText(/no DNA-repair or medical effect is implied/i)).toBeInTheDocument();
  });
});
