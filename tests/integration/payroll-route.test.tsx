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
const readiness = {
  as_of: '2026-10-04T18:00:00Z',
  pay_date: '2026-10-09',
  capabilities: {
    tax_determination: { status: 'blocked', severity: 'P0_BLOCKER', reason: 'No verified production tax rule coverage.' },
    tax_filing: { status: 'blocked', severity: 'P0_BLOCKER', reason: 'No verified production tax-filing provider.' },
    tax_remittance: { status: 'blocked', severity: 'P0_BLOCKER', reason: 'No verified production tax-remittance provider.' },
    direct_deposit: { status: 'blocked', severity: 'P0_BLOCKER', reason: 'No verified production ACH disbursement provider.' }
  }
};
const responseBody = (url: string) => {
  if (url.includes('/rest/v1/organization_members')) return membership;
  if (url.includes('/rest/v1/rpc/payroll_get_capability_readiness')) return readiness;
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
    expect(screen.getByText(/Governed payroll preparation, deterministic tax calculation and evidence-gated execution/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/payroll');
    expect(screen.getByRole('link', { name: 'People' })).toHaveAttribute('href', '/payroll/people');
    expect(screen.getByRole('link', { name: 'Time & Earnings' })).toHaveAttribute('href', '/payroll/time-earnings');
    expect(screen.getByRole('link', { name: 'Pay Runs' })).toHaveAttribute('href', '/payroll/pay-runs');
    expect(screen.getByRole('link', { name: 'Operations' })).toHaveAttribute('href', '/payroll/operations');
  });

  it('renders backend evidence-driven payroll capability blockers without false success claims', async () => {
    render(<MemoryRouter initialEntries={['/payroll']}><App /></MemoryRouter>);
    for (const label of ['Tax determination', 'Tax filing', 'Tax remittance', 'Direct deposit']) {
      expect(await screen.findByText(label)).toBeInTheDocument();
    }
    for (const reason of [
      'No verified production tax rule coverage.',
      'No verified production tax-filing provider.',
      'No verified production tax-remittance provider.',
      'No verified production ACH disbursement provider.'
    ]) expect(screen.getByText(reason)).toBeInTheDocument();
    expect(screen.getAllByText('Blocked')).toHaveLength(4);
    for (const falseClaim of ['Filed','Paid','Connected','Settled']) {
      expect(screen.queryByText(new RegExp(`^${falseClaim}$`, 'i'))).not.toBeInTheDocument();
    }
  });

  it.each([
    ['/payroll/people', 'People'],
    ['/payroll/time-earnings', 'Time & Earnings'],
    ['/payroll/pay-runs', 'Pay Runs'],
    ['/payroll/operations', 'Operations']
  ])('keeps destination %s inside the authenticated route graph', async (path, label) => {
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Payroll' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', path);
  });
});
