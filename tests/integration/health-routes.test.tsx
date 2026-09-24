import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
    expect(within(labNavigation).getByRole('link', { name: 'Jaque Mate + Sentinel' })).toHaveAttribute(
      'href',
      '/health/research/frontiers/disease-reconstruction/jaque-mate-sentinel'
    );
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

  it('renders Jaque Mate + Sentinel inside the existing Disease Reconstruction Lab and runs only educational simulation', () => {
    render(<MemoryRouter initialEntries={['/health/research/frontiers/disease-reconstruction/jaque-mate-sentinel']}><App /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Jaque Mate + Sentinel' })).toBeInTheDocument();
    expect(screen.getAllByText('SIMULATION — NOT CLINICAL EVIDENCE').length).toBeGreaterThan(0);
    expect(screen.getByText(/No automated clinical action/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Validated evidence/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hypothesis/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /Jaque Mate findings can be integrated into ATLAS as governed cure candidates/i })).toBeInTheDocument();
    expect(screen.getByText('POSSIBLE CURE — RESEARCH CANDIDATE')).toBeInTheDocument();
    expect(screen.getByText(/Validated evidence can advance a candidate to human review/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Seed'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('State'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('Niche'), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run educational simulation' }));

    expect(screen.getByText('Research score: 50')).toBeInTheDocument();
    expect(screen.getByText('Evidence type: SIMULATION')).toBeInTheDocument();
  });

  it('keeps the v2 alias on the same governed Jaque Mate + Sentinel surface', () => {
    render(<MemoryRouter initialEntries={['/health/jaque-mate/sentinel/v2']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Jaque Mate + Sentinel' })).toBeInTheDocument();
    expect(screen.getAllByText('SIMULATION — NOT CLINICAL EVIDENCE').length).toBeGreaterThan(0);
  });

  it('redirects the legacy Jaque Mate + Sentinel route to the governed v2 surface', () => {
    render(<MemoryRouter initialEntries={['/health/jaque-mate/sentinel']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Jaque Mate + Sentinel' })).toBeInTheDocument();
    expect(screen.getByText(/Research and simulation only/i)).toBeInTheDocument();
  });
});
