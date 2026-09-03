import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';

describe('Accounts Payable route', () => {
  it('renders the AP workspace inside the shared ATLAS shell', () => {
    render(<MemoryRouter initialEntries={['/finance/accounting/accounts-payable']}><App /></MemoryRouter>);
    expect(screen.getByRole('navigation', { name: 'ATLAS modules' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Accounts Payable' })).toBeInTheDocument();
    expect(screen.getAllByText('Northstar Office Supply').length).toBeGreaterThan(0);
    expect(screen.getByText(/No bank, payment processor/)).toBeInTheDocument();
  });

  it('preserves an intentional degraded Health route instead of breaking', () => {
    render(<MemoryRouter initialEntries={['/health']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Health source unavailable/ })).toBeInTheDocument();
  });
});
