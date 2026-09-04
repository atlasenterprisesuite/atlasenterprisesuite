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

  it('keeps the restored Health home inside the same shared ATLAS shell', () => {
    render(<MemoryRouter initialEntries={['/health']}><App /></MemoryRouter>);
    expect(screen.getByRole('navigation', { name: 'ATLAS modules' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Smart Health Ecosystem' })).toBeInTheDocument();
    expect(screen.getByText(/demonstration data unless a source is explicitly marked live/i)).toBeInTheDocument();
  });
});
