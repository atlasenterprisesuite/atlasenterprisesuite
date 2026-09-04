import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';

describe('ATLAS integrated route graph', () => {
  it('renders the AP workspace inside the shared ATLAS shell', () => {
    render(<MemoryRouter initialEntries={['/finance/accounting/accounts-payable']}><App /></MemoryRouter>);
    expect(screen.getByRole('navigation', { name: 'ATLAS modules' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Accounts Payable' })).toBeInTheDocument();
    expect(screen.getAllByText('Northstar Office Supply').length).toBeGreaterThan(0);
    expect(screen.getByText(/No bank, payment processor/)).toBeInTheDocument();
  });

  it('renders the governed Health route in the same shell', () => {
    render(<MemoryRouter initialEntries={['/health']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Health' })).toBeInTheDocument();
    expect(screen.getByText(/Research \/ Demo Environment/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Health Frontiers/i })).toHaveAttribute('href', '/health/research');
  });
});
