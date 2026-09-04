// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import {
  AccountWriteService,
  type AccountingRepository,
  type AccountWriteGateway,
  type CreateAccountCommand,
  type UpdateAccountCommand,
} from '../../packages/accounting/src';
import {
  AtlasProvider,
  type AtlasIdentitySource,
  type AtlasIdentityState,
} from '../../apps/web/src/app/AtlasContext';
import { AccountingRepositoryProvider } from '../../apps/web/src/modules/accounting/AccountingDataProvider';
import { AccountWriteProvider } from '../../apps/web/src/modules/accounting/AccountWriteProvider';
import { ChartOfAccountsPage } from '../../apps/web/src/modules/accounting/ChartOfAccountsPage';

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

function repositoryWithInactive(): AccountingRepository {
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
        id: 'ap',
        organizationId: 'org-test',
        accountNumber: '2000',
        name: 'Accounts Payable',
        accountType: 'liability',
        active: false,
        createdAt: null,
        updatedAt: null,
      },
    ],
    listJournals: async () => [],
    listCustomers: async () => [],
    listVendors: async () => [],
    listInvoices: async () => [],
    listPayments: async () => [],
    listBills: async () => [],
    listAuditEvents: async () => [],
  };
}

function gatewayWith(overrides: Partial<AccountWriteGateway> = {}): AccountWriteGateway {
  return {
    createAccount: async () => 'account-created',
    updateAccount: async (command) => command.accountId,
    ...overrides,
  };
}

function renderPage({
  permissions = ['accounting.read'],
  service = null,
}: {
  permissions?: string[];
  service?: AccountWriteService | null;
} = {}) {
  render(
    <AtlasProvider source={sourceWith(permissions)}>
      <AccountingRepositoryProvider repository={repositoryWithInactive()}>
        <AccountWriteProvider service={service}>
          <ChartOfAccountsPage />
        </AccountWriteProvider>
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
  renderPage();
  await screen.findByText('Cash');

  expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit 1000' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Deactivate 1000' })).not.toBeInTheDocument();
});

test('creates an account through the governed write service', async () => {
  let received: CreateAccountCommand | undefined;
  const service = new AccountWriteService(gatewayWith({
    createAccount: async (command) => {
      received = command;
      return 'account-created';
    },
  }));
  renderPage({ permissions: ['accounting.read', 'accounting.write'], service });

  await screen.findByText('Cash');
  fireEvent.change(screen.getByLabelText('New account number'), { target: { value: '3000' } });
  fireEvent.change(screen.getByLabelText('New account name'), { target: { value: 'Owner Equity' } });
  fireEvent.change(screen.getByLabelText('New account type'), { target: { value: 'equity' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

  expect(await screen.findByText('Account created')).toBeInTheDocument();
  expect(received).toEqual({
    organizationId: 'org-test',
    accountNumber: '3000',
    name: 'Owner Equity',
    accountType: 'equity',
  });
});

test('edits an account and preserves its active state', async () => {
  let received: UpdateAccountCommand | undefined;
  const service = new AccountWriteService(gatewayWith({
    updateAccount: async (command) => {
      received = command;
      return command.accountId;
    },
  }));
  renderPage({ permissions: ['accounting.read', 'accounting.write'], service });

  fireEvent.click(await screen.findByRole('button', { name: 'Edit 1000' }));
  fireEvent.change(screen.getByLabelText('Edit account name'), { target: { value: 'Operating Cash' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save account' }));

  expect(await screen.findByText('Account updated')).toBeInTheDocument();
  expect(received).toEqual({
    organizationId: 'org-test',
    accountId: 'cash',
    accountNumber: '1000',
    name: 'Operating Cash',
    accountType: 'asset',
    active: true,
  });
});

test('deactivates and reactivates without destructive deletion', async () => {
  const received: UpdateAccountCommand[] = [];
  const service = new AccountWriteService(gatewayWith({
    updateAccount: async (command) => {
      received.push(command);
      return command.accountId;
    },
  }));
  renderPage({ permissions: ['accounting.read', 'accounting.write'], service });

  fireEvent.click(await screen.findByRole('button', { name: 'Deactivate 1000' }));
  expect(await screen.findByText('Account deactivated')).toBeInTheDocument();

  const activateButton = screen.getByRole('button', { name: 'Activate 2000' });
  await waitFor(() => expect(activateButton).toBeEnabled());
  fireEvent.click(activateButton);
  expect(await screen.findByText('Account activated')).toBeInTheDocument();

  expect(received).toEqual([
    {
      organizationId: 'org-test',
      accountId: 'cash',
      accountNumber: '1000',
      name: 'Cash',
      accountType: 'asset',
      active: false,
    },
    {
      organizationId: 'org-test',
      accountId: 'ap',
      accountNumber: '2000',
      name: 'Accounts Payable',
      accountType: 'liability',
      active: true,
    },
  ]);
  expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
});
