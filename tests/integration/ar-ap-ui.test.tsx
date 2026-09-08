// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import {
  AtlasProvider,
  type AtlasIdentitySource,
  type AtlasIdentityState,
} from '../../apps/web/src/app/AtlasContext';
import { AccountingRepositoryProvider } from '../../apps/web/src/modules/accounting/AccountingDataProvider';
import { ReceivablesPage } from '../../apps/web/src/modules/accounting/ReceivablesPage';
import { PayablesPage } from '../../apps/web/src/modules/accounting/PayablesPage';
import type { AccountingRepository } from '../../packages/accounting/src';

afterEach(cleanup);

const identitySource: AtlasIdentitySource = {
  resolve: async () => ({
    status: 'ready',
    userId: 'user-test',
    organizationId: 'org-test',
    organizationName: 'Test Organization',
    role: 'accountant',
    permissions: ['accounting.read', 'accounting.write'],
  } as AtlasIdentityState),
};

function repositoryWithRealisticAp(): AccountingRepository {
  return {
    listAccounts: async () => [],
    listJournals: async () => [],
    listCustomers: async () => [],
    listVendors: async () => [
      {
        id: 'vendor-1',
        organizationId: 'org-test',
        name: 'Walgreens',
        email: null,
        phone: null,
        status: 'active',
        createdBy: null,
        createdAt: null,
        updatedAt: null,
      },
    ],
    listInvoices: async () => [],
    listPayments: async () => [],
    listBills: async () => [
      {
        id: 'bill-1',
        organizationId: 'org-test',
        entityId: null,
        vendorId: 'vendor-1',
        billNumber: 'WAL-PRICE-PENDING',
        billDate: '2026-08-20',
        dueDate: null,
        amount: 39.99,
        balanceDue: 39.99,
        approvalState: 'on_hold',
        matchState: 'exception',
        status: 'open',
        sourceDocumentId: null,
        createdBy: null,
        createdAt: null,
        updatedAt: null,
      },
      {
        id: 'bill-2',
        organizationId: 'org-test',
        entityId: null,
        vendorId: 'vendor-1',
        billNumber: 'WAL-SECOND',
        billDate: '2026-08-20',
        dueDate: null,
        amount: 18.99,
        balanceDue: 18.99,
        approvalState: 'pending',
        matchState: 'no_po',
        status: 'open',
        sourceDocumentId: null,
        createdBy: null,
        createdAt: null,
        updatedAt: null,
      },
    ],
    listAuditEvents: async () => [],
  };
}

function renderPage(page: React.ReactNode) {
  render(
    <AtlasProvider source={identitySource}>
      <AccountingRepositoryProvider repository={repositoryWithRealisticAp()}>
        {page}
      </AccountingRepositoryProvider>
    </AtlasProvider>,
  );
}

test('Accounts Receivable renders a truthful empty state when there are no customers or invoices', async () => {
  renderPage(<ReceivablesPage />);

  expect(await screen.findByRole('heading', { name: 'Accounts Receivable' })).toBeInTheDocument();
  expect(await screen.findByText('No receivables recorded')).toBeInTheDocument();
  expect(screen.getByText('0 customers')).toBeInTheDocument();
  expect(screen.getByText('0 invoices')).toBeInTheDocument();
  expect(screen.getByText('0 payments')).toBeInTheDocument();
});

test('Accounts Payable renders canonical bills, vendor, statuses, and open balance', async () => {
  renderPage(<PayablesPage />);

  expect(await screen.findByRole('heading', { name: 'Accounts Payable' })).toBeInTheDocument();
  expect(await screen.findByText('Walgreens')).toBeInTheDocument();
  expect(screen.getByText('WAL-PRICE-PENDING')).toBeInTheDocument();
  expect(screen.getByText('WAL-SECOND')).toBeInTheDocument();
  expect(screen.getByText('$58.98')).toBeInTheDocument();
  expect(screen.getByText('on_hold')).toBeInTheDocument();
  expect(screen.getByText('exception')).toBeInTheDocument();
  expect(screen.getByText('pending')).toBeInTheDocument();
  expect(screen.getByText('no_po')).toBeInTheDocument();
  expect(screen.getAllByText('Due date not provided')).toHaveLength(2);
});
