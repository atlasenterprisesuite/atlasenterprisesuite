import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';

function renderAt(route: string) {
  return render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>);
}

describe('ATLAS Health route skeleton', () => {
  it('renders the Health home', async () => {
    renderAt('/health');
    expect(await screen.findByRole('heading', { name: 'Smart Health Ecosystem' })).toBeInTheDocument();
  });

  it('renders the AdventHealth proposal landing', async () => {
    renderAt('/health/proposal/adventhealth');
    expect(await screen.findByRole('heading', { name: 'AdventHealth Business Proposal' })).toBeInTheDocument();
  });

  it('renders the Health operations landing', async () => {
    renderAt('/health/operations');
    expect(await screen.findByRole('heading', { name: 'Health Operations' })).toBeInTheDocument();
  });

  it('keeps command center and module portfolio as intentional Health routes', async () => {
    renderAt('/health/operations/command-center');
    expect(await screen.findByRole('heading', { name: 'Smart Health Command Center' })).toBeInTheDocument();
  });
});
