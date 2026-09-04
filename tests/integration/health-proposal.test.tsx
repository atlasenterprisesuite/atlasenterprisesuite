import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';

describe('AdventHealth proposal workspace', () => {
  it('navigates through proposal sections without fake live claims', async () => {
    render(<MemoryRouter initialEntries={['/health/proposal/adventhealth']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Executive Summary' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Pilot Roadmap' }));
    expect(await screen.findByRole('heading', { name: 'Pilot Roadmap' })).toBeInTheDocument();
    expect(screen.getByText(/illustrative|demo/i)).toBeInTheDocument();
    expect(screen.queryByText(/AdventHealth deployment is live/i)).not.toBeInTheDocument();
  });

  it('exposes exactly nine proposal section links', async () => {
    render(<MemoryRouter initialEntries={['/health/proposal/adventhealth/executive-summary']}><App /></MemoryRouter>);
    expect(await screen.findByRole('navigation', { name: 'Proposal sections' })).toBeInTheDocument();
    expect(screen.getAllByTestId('proposal-section-link')).toHaveLength(9);
  });
});
