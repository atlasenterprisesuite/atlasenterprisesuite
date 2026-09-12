import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';

describe('ATLAS Accounting workspace routes', () => {
  it.each([
    ['/finance/accounting/dashboard', 'Accounting Command Center'],
    ['/finance/accounting/chart-of-accounts', 'Chart of Accounts'],
    ['/finance/accounting/general-ledger', 'General Ledger'],
    ['/finance/accounting/journal-entries', 'Journal Entries'],
    ['/finance/accounting/accounts-receivable', 'Accounts Receivable'],
    ['/finance/accounting/bank-cash', 'Bank & Cash'],
    ['/finance/accounting/reconciliation', 'Reconciliation'],
    ['/finance/accounting/fixed-assets', 'Fixed Assets'],
    ['/finance/accounting/budgeting', 'Budgeting'],
    ['/finance/accounting/forecast', 'Cash Flow Forecast'],
    ['/finance/accounting/period-close', 'Period Close'],
    ['/finance/accounting/reports', 'Financial Reports'],
    ['/finance/accounting/audit-trail', 'Audit Trail'],
    ['/finance/accounting/settings', 'Accounting Settings'],
  ])('renders %s as a governed Accounting route', (path, heading) => {
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Accounting navigation' })).toBeInTheDocument();
  });
});