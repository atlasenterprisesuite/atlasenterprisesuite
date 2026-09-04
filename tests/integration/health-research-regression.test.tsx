import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';

describe('ATLAS Health research regression', () => {
  it('preserves the Health Frontiers route', async () => {
    render(<MemoryRouter initialEntries={['/health/research/frontiers']}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Health Frontiers' })).toBeInTheDocument();
  });

  it('routes the operations Research & Innovation module into the governed research workspace', async () => {
    render(<MemoryRouter initialEntries={['/health/operations/modules/research-innovation']}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Research & Innovation' })).toBeInTheDocument();
  });

  it('keeps disease reconstruction explicitly research-only', async () => {
    render(<MemoryRouter initialEntries={['/health/research/frontiers/disease-reconstruction']}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Disease Reconstruction Lab' })).toBeInTheDocument();
    expect(screen.getByText(/research-only/i)).toBeInTheDocument();
  });
});
