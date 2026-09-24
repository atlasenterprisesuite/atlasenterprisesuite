import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';

const membership = [{
  org_id: 'org-1',
  role: 'owner',
  status: 'active',
  organizations: { id: 'org-1', name: 'ATLAS Test', legal_name: null, active: true }
}];
const responseBody = (url: string) => {
  if (url.includes('/rest/v1/organization_members')) return membership;
  if (url.includes('/rest/v1/')) return [];
  return {};
};

beforeEach(() => {
  window.localStorage.setItem('atlas_access_token', 'payroll-test-token');
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    return new Response(JSON.stringify(responseBody(url)), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }));
});

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ATLAS Payroll governed core routing', () => {
  it('renders the governed Payroll workspace behind ATLAS Identity', async () => {
    render(<MemoryRouter initialEntries={['/payroll']}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Payroll' })).toBeInTheDocument();
    expect(screen.getByText(/Governed payroll preparation and approval/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/payroll');
    expect(screen.getByRole('link', { name: 'People' })).toHaveAttribute('href', '/payroll/people');
    expect(screen.getByRole('link', { name: 'Time & Earnings' })).toHaveAttribute('href', '/payroll/time-earnings');
    expect(screen.getByRole('link', { name: 'Pay Runs' })).toHaveAttribute('href', '/payroll/pay-runs');
  });

  it('keeps external payment and tax execution explicitly gated', async () => {
    render(<MemoryRouter initialEntries={['/payroll']}><App /></MemoryRouter>);
    expect(await screen.findByText('Tax determination & filing')).toBeInTheDocument();
    expect(screen.getByText('Direct deposit')).toBeInTheDocument();
    expect(screen.getByText(/No bank transfer is represented as paid/i)).toBeInTheDocument();
  });

  it.each([
    ['/payroll/people', 'People'],
    ['/payroll/time-earnings', 'Time & Earnings'],
    ['/payroll/pay-runs', 'Pay Runs']
  ])('keeps destination %s inside the authenticated route graph', async (path, label) => {
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Payroll' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', path);
  });
});
