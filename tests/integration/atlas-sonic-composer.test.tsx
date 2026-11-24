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
});
