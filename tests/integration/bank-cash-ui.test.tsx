// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import {
  BankCashWriteService,
  type AccountingRepository,
  type BankAccountRecord,
  type BankCashWriteGateway,
  type ReconciliationItemRecord,
  type ReconciliationSessionRecord,
  type StartReconciliationCommand,
} from '../../packages/accounting/src';
import {
  AtlasProvider,
  type AtlasIdentitySource,
  type AtlasIdentityState,
} from '../../apps/web/src/app/AtlasContext';
import { AccountingRepositoryProvider } from '../../apps/web/src/modules/accounting/AccountingDataProvider';
import { BankCashWriteProvider } from '../../apps/web/src/modules/accounting/BankCashWriteProvider';
import { BankCashPage } from '../../apps/web/src/modules/accounting/BankCashPage';
import { ReconciliationPage } from '../../apps/web/src/modules/accounting/ReconciliationPage';

afterEach(cleanup);

function identitySource(permissions: string[]): AtlasIdentitySource {
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

function bankAccount(): BankAccountRecord {
  return {
    id: 'bank-1',
    organizationId: 'org-test',
    entityId: null,
    provider: 'manual',
    providerAccountRef: null,
    displayName: 'Operating Account',
    accountType: 'checking',
    currency: 'USD',
    mask: '4242',
    connectionState: 'not_connected',
    currentBalance: 1200,
    balanceAsOf: '2026-09-04T08:00:00Z',
    metadata: {},
    createdAt: null,
    updatedAt: null,
  };
}

function repositoryWith(
  banks: BankAccountRecord[],
  sessions: ReconciliationSessionRecord[],
  items: ReconciliationItemRecord[] = [],
): AccountingRepository {
  return {
    listAccounts: async () => [],
    listJournals: async () => [],
    listCustomers: async () => [],
    listVendors: async () => [],
    listInvoices: async () => [],
    listPayments: async () => [],
    listBills: async () => [],
    listBankAccounts: async () => [...banks],
    listBankTransactions: async () => [],
    listReconciliationSessions: async () => [...sessions],
    listReconciliationItems: async () => [...items],
    listAuditEvents: async () => [],
  };
}

function gatewayWith(overrides: Partial<BankCashWriteGateway> = {}): BankCashWriteGateway {
  return {
    startReconciliation: async () => 'session-1',
    resolveReconciliationItem: async () => 'item-1',
    closeReconciliation: async () => 'session-1',
    ...overrides,
  };
}

function renderPage({
  page,
  permissions,
  repository,
  service,
}: {
  page: React.ReactNode;
  permissions: string[];
  repository: AccountingRepository;
  service: BankCashWriteService | null;
}) {
  render(
    <AtlasProvider source={identitySource(permissions)}>
      <AccountingRepositoryProvider repository={repository}>
        <BankCashWriteProvider service={service}>{page}</BankCashWriteProvider>
      </AccountingRepositoryProvider>
    </AtlasProvider>,
  );
}

test('shows a truthful zero-row Bank & Cash state without a fake connect action', async () => {
  renderPage({
    page: <BankCashPage />,
    permissions: ['accounting.read'],
    repository: repositoryWith([], []),
    service: null,
  });

  expect(await screen.findByText('No bank or cash records')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /connect bank/i })).not.toBeInTheDocument();
});

test('does not expose reconciliation write controls without accounting.write', async () => {
  renderPage({
    page: <ReconciliationPage />,
    permissions: ['accounting.read'],
    repository: repositoryWith([bankAccount()], []),
    service: new BankCashWriteService(gatewayWith()),
  });

  await screen.findByText(/Operating Account/);
  expect(screen.queryByRole('button', { name: 'Start reconciliation' })).not.toBeInTheDocument();
});

test('starts a reconciliation through the governed service and reloads the real repository', async () => {
  const sessions: ReconciliationSessionRecord[] = [];
  let received: StartReconciliationCommand | undefined;
  const service = new BankCashWriteService(gatewayWith({
    startReconciliation: async (command) => {
      received = command;
      sessions.push({
        id: 'session-1', organizationId: 'org-test', entityId: null, bankAccountId: 'bank-1',
        periodStart: command.periodStart, periodEnd: command.periodEnd,
        statementEndingBalance: command.statementEndingBalance, ledgerEndingBalance: command.ledgerEndingBalance,
        status: 'in_review', readinessScore: 100, closedBy: null, closedAt: null, createdAt: null, updatedAt: null,
      });
      return 'session-1';
    },
  }));

  renderPage({
    page: <ReconciliationPage />,
    permissions: ['accounting.read', 'accounting.write'],
    repository: repositoryWith([bankAccount()], sessions),
    service,
  });

  fireEvent.click(await screen.findByRole('button', { name: 'Start reconciliation' }));
  fireEvent.change(screen.getByLabelText('Period start'), { target: { value: '2026-08-01' } });
  fireEvent.change(screen.getByLabelText('Period end'), { target: { value: '2026-08-31' } });
  fireEvent.change(screen.getByLabelText('Statement ending balance'), { target: { value: '1200' } });
  fireEvent.change(screen.getByLabelText('Ledger ending balance'), { target: { value: '1200' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit reconciliation' }));

  expect(await screen.findByText('Reconciliation started')).toBeInTheDocument();
  expect(received).toEqual({
    organizationId: 'org-test', bankAccountId: 'bank-1', periodStart: '2026-08-01', periodEnd: '2026-08-31',
    statementEndingBalance: 1200, ledgerEndingBalance: 1200,
  });
  expect(await screen.findByText('in_review')).toBeInTheDocument();
});

test('closes an eligible reconciliation through the governed service and refreshes status', async () => {
  const sessions: ReconciliationSessionRecord[] = [{
    id: 'session-1', organizationId: 'org-test', entityId: null, bankAccountId: 'bank-1',
    periodStart: '2026-08-01', periodEnd: '2026-08-31', statementEndingBalance: 1200,
    ledgerEndingBalance: 1200, status: 'in_review', readinessScore: 100,
    closedBy: null, closedAt: null, createdAt: null, updatedAt: null,
  }];
  const service = new BankCashWriteService(gatewayWith({
    closeReconciliation: async () => {
      sessions[0] = { ...sessions[0]!, status: 'reconciled', closedBy: 'user-test', closedAt: '2026-09-04T09:00:00Z' };
      return 'session-1';
    },
  }));

  renderPage({
    page: <ReconciliationPage />,
    permissions: ['accounting.read', 'accounting.write'],
    repository: repositoryWith([bankAccount()], sessions),
    service,
  });

  fireEvent.click(await screen.findByRole('button', { name: 'Close reconciliation session-1' }));
  expect(await screen.findByText('Reconciliation closed')).toBeInTheDocument();
  expect(await screen.findByText('reconciled')).toBeInTheDocument();
});
