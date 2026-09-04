// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import {
  JournalWriteService,
  type AccountRecord,
  type AccountingRepository,
  type JournalRecord,
  type JournalWriteGateway,
} from '../../packages/accounting/src';
import {
  AtlasProvider,
  type AtlasIdentitySource,
  type AtlasIdentityState,
} from '../../apps/web/src/app/AtlasContext';
import { AccountingRepositoryProvider } from '../../apps/web/src/modules/accounting/AccountingDataProvider';
import { AccountingWriteProvider } from '../../apps/web/src/modules/accounting/AccountingWriteProvider';
import { JournalEntriesPage } from '../../apps/web/src/modules/accounting/JournalEntriesPage';

afterEach(cleanup);

const accounts: AccountRecord[] = [
  {
    id: 'account-cash',
    organizationId: 'org-test',
    accountNumber: '1000',
    name: 'Cash',
    accountType: 'asset',
    active: true,
    createdAt: null,
    updatedAt: null,
  },
  {
    id: 'account-revenue',
    organizationId: 'org-test',
    accountNumber: '4000',
    name: 'Revenue',
    accountType: 'revenue',
    active: true,
    createdAt: null,
    updatedAt: null,
  },
];

function journal(overrides: Partial<JournalRecord> = {}): JournalRecord {
  return {
    id: 'journal-1',
    organizationId: 'org-test',
    entryNumber: 'JE-1001',
    entryDate: '2026-09-03',
    memo: 'Opening entry',
    status: 'posted',
    createdBy: 'user-test',
    createdAt: null,
    updatedAt: null,
    reversesJournalEntryId: null,
    lines: [],
    ...overrides,
  };
}

function repositoryWith(journals: JournalRecord[] = [], accountRows = accounts): AccountingRepository {
  return {
    listAccounts: async () => accountRows,
    listJournals: async () => journals,
    listCustomers: async () => [],
    listVendors: async () => [],
    listInvoices: async () => [],
    listPayments: async () => [],
    listBills: async () => [],
    listAuditEvents: async () => [],
  };
}

function identitySource(permissions: AtlasIdentityState extends infer _ ? string[] : never): AtlasIdentitySource {
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

function gatewayWith(overrides: Partial<JournalWriteGateway> = {}): JournalWriteGateway {
  return {
    createBalancedJournalEntry: async () => 'journal-created',
    reversePostedJournalEntry: async () => 'journal-reversal',
    ...overrides,
  };
}

function renderPage({
  permissions = ['accounting.read', 'accounting.post'],
  journals = [],
  repository = repositoryWith(journals),
  gateway = gatewayWith(),
  writesEnabled = true,
}: {
  permissions?: string[];
  journals?: JournalRecord[];
  repository?: AccountingRepository;
  gateway?: JournalWriteGateway;
  writesEnabled?: boolean;
} = {}) {
  const service = writesEnabled ? new JournalWriteService(gateway) : null;

  render(
    <AtlasProvider source={identitySource(permissions)}>
      <AccountingRepositoryProvider repository={repository}>
        <AccountingWriteProvider service={service}>
          <JournalEntriesPage />
        </AccountingWriteProvider>
      </AccountingRepositoryProvider>
    </AtlasProvider>,
  );
}

test('shows real accounts and journals but no write controls without posting permission', async () => {
  renderPage({ permissions: ['accounting.read'], journals: [journal()] });

  expect(await screen.findByRole('heading', { name: 'Journal Entries' })).toBeInTheDocument();
  expect(await screen.findByText('1000 · Cash')).toBeInTheDocument();
  expect(screen.getByText('JE-1001')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Post journal entry' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reverse JE-1001' })).not.toBeInTheDocument();
});

test('posts a balanced journal using only selected real account ids', async () => {
  let received: Parameters<JournalWriteGateway['createBalancedJournalEntry']>[0] | undefined;
  renderPage({
    gateway: gatewayWith({
      createBalancedJournalEntry: async (command) => {
        received = command;
        return 'journal-created';
      },
    }),
  });

  const entryNumberInput = await screen.findByLabelText('Entry number');
  fireEvent.change(entryNumberInput, { target: { value: 'JE-2001' } });
  fireEvent.change(screen.getByLabelText('Entry date'), { target: { value: '2026-09-03' } });
  fireEvent.change(screen.getByLabelText('Memo'), { target: { value: 'Cash sale' } });
  fireEvent.change(screen.getByLabelText('Debit account'), { target: { value: 'account-cash' } });
  fireEvent.change(screen.getByLabelText('Credit account'), { target: { value: 'account-revenue' } });
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '250.75' } });
  fireEvent.click(screen.getByRole('button', { name: 'Post journal entry' }));

  expect(await screen.findByText('Journal posted')).toBeInTheDocument();
  expect(received).toEqual({
    organizationId: 'org-test',
    entryNumber: 'JE-2001',
    entryDate: '2026-09-03',
    memo: 'Cash sale',
    debitAccountId: 'account-cash',
    creditAccountId: 'account-revenue',
    amount: 250.75,
  });
});

test('reverses an unreversed posted journal with user-supplied reversal fields', async () => {
  let received: Parameters<JournalWriteGateway['reversePostedJournalEntry']>[0] | undefined;
  renderPage({
    journals: [journal()],
    gateway: gatewayWith({
      reversePostedJournalEntry: async (command) => {
        received = command;
        return 'journal-reversal';
      },
    }),
  });

  fireEvent.click(await screen.findByRole('button', { name: 'Reverse JE-1001' }));
  fireEvent.change(screen.getByLabelText('Reversal entry number'), { target: { value: 'JE-1001-R1' } });
  fireEvent.change(screen.getByLabelText('Reversal date'), { target: { value: '2026-09-03' } });
  fireEvent.change(screen.getByLabelText('Reversal reason'), { target: { value: 'Correcting entry' } });
  fireEvent.click(screen.getByRole('button', { name: 'Post reversal' }));

  expect(await screen.findByText('Reversal posted')).toBeInTheDocument();
  expect(received).toEqual({
    organizationId: 'org-test',
    journalEntryId: 'journal-1',
    reversalEntryNumber: 'JE-1001-R1',
    reversalDate: '2026-09-03',
    reason: 'Correcting entry',
  });
});

test('does not offer a second reversal when a linked reversal already exists', async () => {
  const original = journal();
  const reversal = journal({
    id: 'journal-r1',
    entryNumber: 'JE-1001-R1',
    reversesJournalEntryId: original.id,
  });
  renderPage({ journals: [original, reversal] });

  await screen.findByText('JE-1001-R1');
  expect(screen.queryByRole('button', { name: 'Reverse JE-1001' })).not.toBeInTheDocument();
  expect(screen.getByText('Reversal of JE-1001')).toBeInTheDocument();
});

test('keeps journal data readable when the write service is unavailable', async () => {
  renderPage({ journals: [journal()], writesEnabled: false });

  expect(await screen.findByText('Journal posting unavailable')).toBeInTheDocument();
  expect(screen.getByText('JE-1001')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Post journal entry' })).not.toBeInTheDocument();
});
