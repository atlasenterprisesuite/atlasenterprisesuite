// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import {
  AtlasProvider,
  type AtlasIdentitySource,
  type AtlasIdentityState,
} from '../../apps/web/src/app/AtlasContext';
import { AccountingRepositoryProvider } from '../../apps/web/src/modules/accounting/AccountingDataProvider';
import { ChartOfAccountsPage } from '../../apps/web/src/modules/accounting/ChartOfAccountsPage';
import type { AccountingRepository } from '../../packages/accounting/src';

afterEach(cleanup);

function sourceWith(permissions: string[]): AtlasIdentitySource {
  return {
    resolve: async () => ({
      status: 'ready',
      userId: 'user-test',
      organizationId: 'org-test',
      organizationName: 'Test Organization',
      role: 'accountant',
      permissions,
    } as AtlasIdentityState),
  };
}

const repository: AccountingRepository = {
  listAccounts: async () => [
    {
      id: 'cash',
      organizationId: 'org-test',
      accountNumber: '1000',
      name: 'Cash',
      accountType: 'asset',
      createdAt: null,
      updatedAt: null,
    },
    {
      id: 'ap',
      organizationId: 'org-test',
      accountNumber: '2000',
      name: 'Accounts Payable',
      accountType: 'liability',
      createdAt: null,
      updatedAt: null,
    },
  ],
  listJournals: async () => [],
  listCustomers: async () => [],
  listVendors: async () => [],
  listInvoices: async () => [],
  listPayments: async () => [],
  listAuditEvents: async () => [],
};

function renderPage(permissions: string[] = ['accounting.read']) {
  render(
    <AtlasProvider source={sourceWith(permissions)}>
      <AccountingRepositoryProvider repository={repository}>
        <ChartOfAccountsPage />
      </AccountingRepositoryProvider>
    </AtlasProvider>,
  );
}

test('renders real chart of accounts rows and no fabricated balances', async () => {
  renderPage();

  expect(await screen.findByRole('heading', { name: 'Chart of Accounts' })).toBeInTheDocument();
  expect(await screen.findByText('1000')).toBeInTheDocument();
  expect(screen.getByText('Cash')).toBeInTheDocument();
  expect(screen.getByText('2000')).toBeInTheDocument();
  expect(screen.getByText('Accounts Payable')).toBeInTheDocument();
  expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
});

test('filters accounts by number, name, or type', async () => {
  renderPage();
  await screen.findByText('Cash');

  fireEvent.change(screen.getByLabelText('Search accounts'), { target: { value: 'liability' } });
  expect(screen.getByText('Accounts Payable')).toBeInTheDocument();
  expect(screen.queryByText('Cash')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Search accounts'), { target: { value: '1000' } });
  expect(screen.getByText('Cash')).toBeInTheDocument();
  expect(screen.queryByText('Accounts Payable')).not.toBeInTheDocument();
});

test('does not expose account mutation controls without accounting.write', async () => {
  renderPage(['accounting.read']);
  await screen.findByText('Cash');

  expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit 1000' })).not.toBeInTheDocument();
});
