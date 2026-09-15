import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';

describe('ATLAS Health governed routes', () => {
  it('renders the ASTRA-derived Health home without pretending clinical integrations are live', () => {
    render(<MemoryRouter initialEntries={['/health']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Health' })).toBeInTheDocument();
    expect(document.querySelector('.module-experience-page')).toBeTruthy();
    expect(screen.getByText('Health intelligence, research and wellbeing with explicit evidence boundaries.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Health Frontiers/i })).toHaveAttribute('href', '/health/research');
    expect(screen.getByRole('link', { name: /Neuroplasticity Program/i })).toHaveAttribute('href', '/health/wellbeing/neuroplasticity');
    expect(screen.getByText('Clinical systems').closest('[aria-disabled="true"]')).toBeTruthy();
    expect(screen.getByText('Hospital operations').closest('[aria-disabled="true"]')).toBeTruthy();
  });

  it('renders Disease Reconstruction Lab overview with repository-backed counts', () => {
    render(<MemoryRouter initialEntries={['/health/research/frontiers/disease-reconstruction']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Disease Reconstruction Lab' })).toBeInTheDocument();
    expect(screen.getByText(/ATLAS research demo data only/i)).toBeInTheDocument();
    expect(screen.getByText('PASS')).toBeInTheDocument();
    const labNavigation = screen.getByRole('navigation', { name: 'Disease Reconstruction Lab navigation' });
    expect(within(labNavigation).getByRole('link', { name: 'Evidence Registry' })).toHaveAttribute('href', expect.stringContaining('/evidence'));
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
