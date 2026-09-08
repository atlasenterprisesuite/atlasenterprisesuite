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
import { GeneralLedgerPage } from '../../apps/web/src/modules/accounting/GeneralLedgerPage';
import type { AccountingRepository, JournalRecord } from '../../packages/accounting/src';

afterEach(cleanup);

const source: AtlasIdentitySource = {
  resolve: async () => ({
    status: 'ready',
    userId: 'user-test',
    organizationId: 'org-test',
    organizationName: 'Test Organization',
    role: 'accountant',
    permissions: ['accounting.read'],
  } as AtlasIdentityState),
};

function repositoryWith(journals: JournalRecord[] = []): AccountingRepository {
  return {
    listAccounts: async () => [
      {
        id: 'cash',
        organizationId: 'org-test',
        accountNumber: '1000',
        name: 'Cash',
        accountType: 'asset',
        active: true,
        createdAt: null,
        updatedAt: null,
      },
      {
        id: 'revenue',
        organizationId: 'org-test',
        accountNumber: '4000',
        name: 'Revenue',
        accountType: 'revenue',
        active: true,
        createdAt: null,
        updatedAt: null,
      },
    ],
    listJournals: async () => journals,
    listCustomers: async () => [],
    listVendors: async () => [],
    listInvoices: async () => [],
    listPayments: async () => [],
    listBills: async () => [],
    listAuditEvents: async () => [],
  };
}

function renderPage(repository: AccountingRepository) {
  render(
    <AtlasProvider source={source}>
      <AccountingRepositoryProvider repository={repository}>
        <GeneralLedgerPage />
      </AccountingRepositoryProvider>
    </AtlasProvider>,
  );
}

function journal(status: string): JournalRecord {
  return {
    id: `journal-${status}`,
    organizationId: 'org-test',
    entryNumber: status === 'posted' ? 'JE-1001' : 'JE-DRAFT',
    entryDate: '2026-09-03',
    memo: status === 'posted' ? 'Cash sale' : 'Draft entry',
    status,
    createdBy: null,
    createdAt: null,
    updatedAt: null,
    reversesJournalEntryId: null,
    lines: [
      {
        id: `line-${status}-1`,
        organizationId: 'org-test',
        journalEntryId: `journal-${status}`,
        accountId: 'cash',
        debit: 125,
        credit: 0,
        createdAt: null,
      },
      {
        id: `line-${status}-2`,
        organizationId: 'org-test',
        journalEntryId: `journal-${status}`,
        accountId: 'revenue',
        debit: 0,
        credit: 125,
        createdAt: null,
      },
    ],
  };
}

test('shows a truthful empty General Ledger when there is no posted activity', async () => {
  renderPage(repositoryWith());
  expect(await screen.findByRole('heading', { name: 'General Ledger' })).toBeInTheDocument();
  expect(await screen.findByText('No posted ledger activity')).toBeInTheDocument();
});

test('renders only posted journal lines with account metadata and running net', async () => {
  renderPage(repositoryWith([journal('draft'), journal('posted')]));

  expect(await screen.findAllByText('JE-1001')).toHaveLength(2);
  expect(screen.queryByText('JE-DRAFT')).not.toBeInTheDocument();
  expect(screen.getByText('1000 · Cash')).toBeInTheDocument();
  expect(screen.getByText('4000 · Revenue')).toBeInTheDocument();
  expect(screen.getAllByText('125.00').length).toBeGreaterThan(0);
  expect(screen.getByText('-125.00')).toBeInTheDocument();
});
