import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';

describe('ATLAS Payroll visual foundation', () => {
  it('renders the approved Payroll identity and functional entry tiles', () => {
    render(
      <MemoryRouter initialEntries={['/payroll']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'ATLAS PAYROLL' })).toBeInTheDocument();
    expect(screen.getByText('People • Pay • Progress')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Payroll Overview/i })).toHaveAttribute('href', '/payroll/overview');
    expect(screen.getByRole('link', { name: /Workforce People/i })).toHaveAttribute('href', '/payroll/people');
    expect(screen.getByRole('link', { name: /Time & Earnings/i })).toHaveAttribute('href', '/payroll/time-earnings');
    expect(screen.getByRole('link', { name: /Pay Runs/i })).toHaveAttribute('href', '/payroll/pay-runs');
  });

  it('renders an explicit configuration state instead of fabricated payroll metrics', () => {
    render(
      <MemoryRouter initialEntries={['/payroll']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText(/Payroll data is not configured/i)).toBeInTheDocument();
    expect(screen.queryByText(/total payroll/i)).not.toBeInTheDocument();
  });

  it.each([
    ['/payroll/overview', 'Payroll Overview'],
    ['/payroll/people', 'People'],
    ['/payroll/time-earnings', 'Time & Earnings'],
    ['/payroll/pay-runs', 'Pay Runs']
  ])('keeps tile destination %s inside the real route graph', (path, heading) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Payroll/i })).toHaveAttribute('href', '/payroll');
  });
});
