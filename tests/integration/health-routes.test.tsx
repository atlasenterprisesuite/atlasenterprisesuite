import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';

describe('ATLAS Health governed routes', () => {
  it('renders Disease Reconstruction Lab overview with repository-backed counts', () => {
    render(<MemoryRouter initialEntries={['/health/research/frontiers/disease-reconstruction']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Disease Reconstruction Lab' })).toBeInTheDocument();
    expect(screen.getByText(/ATLAS research demo data only/i)).toBeInTheDocument();
    expect(screen.getByText('PASS')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Evidence Registry/i })).toHaveAttribute('href', expect.stringContaining('/evidence'));
  });

  it('renders a disease detail without presenting it as clinical advice', () => {
    render(<MemoryRouter initialEntries={['/health/research/frontiers/disease-reconstruction/diseases/hiv']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'HIV' })).toBeInTheDocument();
    expect(screen.getByText(/Research classification only/i)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Neural Graph' })).toBeInTheDocument();
  });

  it('renders the curability evidence gate', () => {
    render(<MemoryRouter initialEntries={['/health/research/frontiers/disease-reconstruction/curability']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Curability Index' })).toBeInTheDocument();
    expect(screen.getByText(/C5–C7 are evidence-gated/i)).toBeInTheDocument();
  });
});
