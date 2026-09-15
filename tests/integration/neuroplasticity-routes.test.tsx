import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';

describe('ATLAS Neuroplasticity routes', () => {
  beforeEach(() => window.localStorage.clear());

  it('renders Learning through the shared ASTRA module experience with a real Practice Lab route', () => {
    render(<MemoryRouter initialEntries={['/learning']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Learning' })).toBeInTheDocument();
    expect(document.querySelector('.module-experience-page')).toBeTruthy();
    expect(screen.getByText('Practice, recovery and measurable progress under one governed learning context.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Neuroplasticity Program/i })).toHaveAttribute('href', '/learning/neuroplasticity');
    expect(screen.getByText('Clinical diagnosis & treatment').closest('[aria-disabled="true"]')).toBeTruthy();
  });

  it.each([
    ['/health/wellbeing/neuroplasticity', 'ATLAS Health · Wellbeing'],
    ['/learning/neuroplasticity', 'ATLAS Learning · Practice Lab']
  ])('renders the shared program at %s', (route, eyebrow) => {
    render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Neuroplasticity Program' })).toBeInTheDocument();
    expect(screen.getByText(eyebrow)).toBeInTheDocument();
    expect(screen.getByText(/does not diagnose, treat or measure neurological change/i)).toBeInTheDocument();
  });

  it('builds a plan and tracks activity completion', async () => {
    render(<MemoryRouter initialEntries={['/learning/neuroplasticity']}><App /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Build my plan' }));
    expect(screen.getByRole('region', { name: 'Daily progress' })).toHaveTextContent('0% complete');
    fireEvent.click(screen.getByRole('button', { name: /Deliberate practice/i }));
    expect(screen.getByRole('region', { name: 'Daily progress' })).not.toHaveTextContent('0% complete');
    expect(await screen.findByText(/Supabase environment is not configured|Sign in to save this program/i)).toBeInTheDocument();
  });

  it('shows the professional guidance boundary when indicated', () => {
    render(<MemoryRouter initialEntries={['/health/wellbeing/neuroplasticity']}><App /></MemoryRouter>);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Build my plan' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Professional guidance recommended');
  });
});
