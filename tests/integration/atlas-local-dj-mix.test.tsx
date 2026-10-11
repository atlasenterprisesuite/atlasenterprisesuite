import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LocalDJMixPage } from '../../apps/web/src/modules/creator/music/LocalDJMixPage';

describe('ATLAS Local DJ browser-only UI', () => {
  it('offers a working input and honest capability limits without fabricated songs', () => {
    render(<MemoryRouter><LocalDJMixPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'ATLAS Local DJ' })).toBeInTheDocument();
    expect(screen.getByLabelText('Add audio files')).toHaveAttribute('type', 'file');
    expect(screen.getByRole('button', { name: 'Play mix' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Smart reorder' })).toBeDisabled();
    expect(screen.getByText(/automatic beat detection, beat synchronization or mastering is claimed/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Music Lab' })).toHaveAttribute('href', '/studio/create?type=music');
  });
});
