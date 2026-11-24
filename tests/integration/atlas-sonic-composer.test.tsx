import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SonicComposer } from '../../apps/web/src/modules/creator/music/SonicComposer';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('SONIC local composer', () => {
  it('generates only on request, offers a WAV and revokes stale resources', () => {
    const create = vi.fn(() => 'blob:atlas-sonic-test');
    const revoke = vi.fn();
    const OriginalURL = URL;
    vi.stubGlobal('URL', class extends OriginalURL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    });
    render(<SonicComposer />);
    expect(create).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('SONIC instrumental preview')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Generate instrumental' }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('SONIC instrumental preview')).not.toHaveAttribute('autoplay');
    expect(screen.getByRole('link', { name: 'Download instrumental WAV' })).toHaveAttribute('download', 'atlas-sonic-instrumental.wav');
    fireEvent.change(screen.getByLabelText('Tempo (BPM)'), { target: { value: '90' } });
    expect(screen.queryByRole('link', { name: 'Download instrumental WAV' })).not.toBeInTheDocument();
    expect(revoke).toHaveBeenCalledWith('blob:atlas-sonic-test');
  });

  it('edits a note and invalidates both exports until explicitly regenerated', () => {
    let serial = 0;
    const create = vi.fn(() => 'blob:sonic-' + (++serial));
    const revoke = vi.fn();
    const OriginalURL = URL;
    vi.stubGlobal('URL', class extends OriginalURL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    });
    render(<SonicComposer />);
    expect(screen.queryByRole('button', { name: 'Prepare MIDI' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Generate instrumental' }));
    fireEvent.click(screen.getByRole('button', { name: 'Prepare MIDI' }));
    expect(screen.getByRole('link', { name: 'Download instrumental MIDI' })).toHaveAttribute('download','atlas-sonic-instrumental.mid');
    fireEvent.click(screen.getByText(/Edit 44 notes/));
    fireEvent.change(screen.getByLabelText('Pitch for note 1'), { target: { value: '61' } });
    expect(screen.queryByRole('link', { name: 'Download instrumental MIDI' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Download instrumental WAV' })).not.toBeInTheDocument();
    expect(revoke).toHaveBeenCalledWith('blob:sonic-1');
    expect(revoke).toHaveBeenCalledWith('blob:sonic-2');
    fireEvent.click(screen.getByRole('button', { name: 'Render edited WAV' }));
    expect(screen.getByRole('link', { name: 'Download instrumental WAV' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Prepare MIDI' }));
    expect(screen.getByRole('link', { name: 'Download instrumental MIDI' })).toBeInTheDocument();
  });
});
