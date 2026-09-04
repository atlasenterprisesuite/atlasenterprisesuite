// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test } from 'vitest';
import {
  AtlasProvider,
  type AtlasIdentitySource,
  type AtlasIdentityState,
} from '../../apps/web/src/app/AtlasContext';
import { AccountingRepositoryProvider } from '../../apps/web/src/modules/accounting/AccountingDataProvider';
import { AccountingPage } from '../../apps/web/src/modules/accounting/AccountingPage';
import type { AccountingRepository } from '../../packages/accounting/src';

afterEach(cleanup);

const identity: AtlasIdentityState = {
  status: 'ready',
  userId: 'test-user',
  organizationId: 'org-test',
  organizationName: 'Test Organization',
  role: 'accountant',
  permissions: ['accounting.read', 'accounting.write', 'audit.read'],
};

const source: AtlasIdentitySource = { resolve: async () => identity };

function repositoryWith(overrides: Partial<AccountingRepository> = {}): AccountingRepository {
  return {
    listAccounts: async () => [],
    listJournals: async () => [],
    listCustomers: async () => [],
    listVendors: async () => [],
    listInvoices: async () => [],
    listPayments: async () => [],
    listAuditEvents: async () => [],
    ...overrides,
  };
}

function renderAccounting(repository: AccountingRepository | null) {
  render(
    <MemoryRouter>
      <AtlasProvider source={source}>
        <AccountingRepositoryProvider repository={repository}>
          <AccountingPage />
        </AccountingRepositoryProvider>
      </AtlasProvider>
    </MemoryRouter>,
  );
}

test('shows a truthful empty state when the organization has no accounting rows', async () => {
  renderAccounting(repositoryWith());
  expect(await screen.findByRole('heading', { name: 'Accounting' })).toBeInTheDocument();
  expect(await screen.findByText('No accounting records')).toBeInTheDocument();
  expect(screen.queryByText(/demo/i)).not.toBeInTheDocument();
});

test('links Accounting to the real General Ledger, Chart of Accounts, and Journal Entries routes', async () => {
  renderAccounting(repositoryWith());

  expect(await screen.findByRole('link', { name: 'General Ledger' })).toHaveAttribute(
    'href',
    '/finance/accounting/general-ledger',
  );
  expect(screen.getByRole('link', { name: 'Chart of Accounts' })).toHaveAttribute(
    'href',
    '/finance/accounting/chart-of-accounts',
  );
  expect(screen.getByRole('link', { name: 'Journal Entries' })).toHaveAttribute(
    'href',
    '/finance/accounting/journal-entries',
  );
});

test('shows counts derived only from repository records', async () => {
  renderAccounting(
    repositoryWith({
      listAccounts: async () => [
        {
          id: 'account-1',
          organizationId: 'org-test',
          accountNumber: '1000',
          name: 'Cash',
          accountType: 'asset',
          createdAt: null,
          updatedAt: null,
        },
        {
          id: 'account-2',
          organizationId: 'org-test',
          accountNumber: '2000',
          name: 'Accounts Payable',
          accountType: 'liability',
          createdAt: null,
          updatedAt: null,
        },
      ],
      listVendors: async () => [
        {
          id: 'vendor-1',
          organizationId: 'org-test',
          name: 'Test Vendor',
          email: null,
          phone: null,
          status: 'active',
          createdBy: null,
          createdAt: null,
          updatedAt: null,
        },
      ],
    }),
  );

  expect(await screen.findByText('2 Accounts')).toBeInTheDocument();
  expect(screen.getByText('1 Vendor')).toBeInTheDocument();
  expect(screen.getByText('0 Journals')).toBeInTheDocument();
  expect(screen.queryByText('$0')).not.toBeInTheDocument();
});

test('shows an explicit unavailable state when no real repository is configured', async () => {
  renderAccounting(null);
  expect(await screen.findByRole('heading', { name: 'Accounting' })).toBeInTheDocument();
  expect(await screen.findByText('Accounting connection unavailable')).toBeInTheDocument();
});

test('shows an explicit error state when the real query fails', async () => {
  renderAccounting(
    repositoryWith({
      listAccounts: async () => {
        throw new Error('query failed');
      },
    }),
  );

  expect(await screen.findByText('Accounting data unavailable')).toBeInTheDocument();
});
