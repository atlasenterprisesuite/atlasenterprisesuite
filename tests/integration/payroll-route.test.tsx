import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';

const membership = [{ org_id: 'org-1', role: 'owner', status: 'active' }];

beforeEach(() => {
  window.localStorage.setItem('atlas_access_token', 'payroll-test-token');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(membership), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })));
});

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ATLAS Payroll visual foundation', () => {
  it('renders the approved Payroll identity and functional entry tiles behind ATLAS Identity', async () => {
    render(
      <MemoryRouter initialEntries={['/payroll']}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'ATLAS PAYROLL' })).toBeInTheDocument();
    expect(screen.getByText('People • Pay • Progress')).toBeInTheDocument();
    expect(document.querySelector('.module-experience-page')).toBeTruthy();
    expect(screen.getByText('Payroll intelligence, governed inputs and controlled execution.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Payroll Overview/i })).toHaveAttribute('href', '/payroll/overview');
    expect(screen.getByRole('link', { name: /Workforce People/i })).toHaveAttribute('href', '/payroll/people');
    expect(screen.getByRole('link', { name: /Time & Earnings/i })).toHaveAttribute('href', '/payroll/time-earnings');
    expect(screen.getByRole('link', { name: /Pay Runs/i })).toHaveAttribute('href', '/payroll/pay-runs');
  });

  it('renders an explicit configuration state instead of fabricated payroll metrics', async () => {
    render(
      <MemoryRouter initialEntries={['/payroll']}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Payroll data is not configured/i)).toBeInTheDocument();
    expect(screen.queryByText(/total payroll/i)).not.toBeInTheDocument();
  });

  it.each([
    ['/payroll/overview', 'Payroll Overview'],
    ['/payroll/people', 'People'],
    ['/payroll/time-earnings', 'Time & Earnings'],
    ['/payroll/pay-runs', 'Pay Runs']
  ])('keeps tile destination %s inside the authenticated route graph', async (path, heading) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Payroll/i })).toHaveAttribute('href', '/payroll');
  });
});
