// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import {
  ArApWriteService,
  type AccountingRepository,
  type ArApWriteGateway,
  type RecordInvoicePaymentCommand,
  type SetBillApprovalCommand,
} from '../../packages/accounting/src';
import {
  AtlasProvider,
  type AtlasIdentitySource,
  type AtlasIdentityState,
} from '../../apps/web/src/app/AtlasContext';
import { AccountingRepositoryProvider } from '../../apps/web/src/modules/accounting/AccountingDataProvider';
import { ArApWriteProvider } from '../../apps/web/src/modules/accounting/ArApWriteProvider';
import { ReceivablesPage } from '../../apps/web/src/modules/accounting/ReceivablesPage';
import { PayablesPage } from '../../apps/web/src/modules/accounting/PayablesPage';

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

function gatewayWith(overrides: Partial<ArApWriteGateway> = {}): ArApWriteGateway {
  return {
    recordInvoicePayment: async () => 'payment-1',
    setBillApprovalState: async () => 'bill-1',
    ...overrides,
  };
}

function repositoryWithState(state: { invoiceBalance: number; billApproval: string }): AccountingRepository {
  return {
    listAccounts: async () => [],
    listJournals: async () => [],
    listCustomers: async () => [{
      id: 'customer-1',
      organizationId: 'org-test',
      name: 'Acme Health',
      email: null,
      phone: null,
      status: 'active',
      createdBy: null,
      createdAt: null,
      updatedAt: null,
    }],
    listVendors: async () => [{
      id: 'vendor-1',
      organizationId: 'org-test',
      name: 'Vendor One',
      email: null,
      phone: null,
      status: 'active',
      createdBy: null,
      createdAt: null,
      updatedAt: null,
    }],
    listInvoices: async () => [{
      id: 'invoice-1',
      organizationId: 'org-test',
      customerId: 'customer-1',
      invoiceNumber: 'INV-1001',
      issueDate: '2026-09-01',
      dueDate: '2026-09-30',
      total: 100,
      balanceDue: state.invoiceBalance,
      status: state.invoiceBalance > 0 ? 'open' : 'paid',
      createdBy: null,
      createdAt: null,
      updatedAt: null,
    }],
    listPayments: async () => [],
    listBills: async () => [{
      id: 'bill-1',
      organizationId: 'org-test',
      entityId: null,
      vendorId: 'vendor-1',
      billNumber: 'BILL-1001',
      billDate: '2026-09-01',
      dueDate: '2026-09-30',
      amount: 80,
      balanceDue: 80,
      approvalState: state.billApproval,
      matchState: 'no_po',
      status: 'open',
      sourceDocumentId: null,
      createdBy: null,
      createdAt: null,
      updatedAt: null,
    }],
    listAuditEvents: async () => [],
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
  service: ArApWriteService | null;
}) {
  render(
    <AtlasProvider source={identitySource(permissions)}>
      <AccountingRepositoryProvider repository={repository}>
        <ArApWriteProvider service={service}>{page}</ArApWriteProvider>
      </AccountingRepositoryProvider>
    </AtlasProvider>,
  );
}

test('does not expose receivable payment controls without accounting.write', async () => {
  const state = { invoiceBalance: 100, billApproval: 'pending' };
  renderPage({
    page: <ReceivablesPage />,
    permissions: ['accounting.read'],
    repository: repositoryWithState(state),
    service: new ArApWriteService(gatewayWith()),
  });

  await screen.findByText('INV-1001');
  expect(screen.queryByRole('button', { name: 'Record payment INV-1001' })).not.toBeInTheDocument();
});

test('records an invoice payment through the governed service and reloads real data', async () => {
  const state = { invoiceBalance: 100, billApproval: 'pending' };
  let received: RecordInvoicePaymentCommand | undefined;
  const service = new ArApWriteService(gatewayWith({
    recordInvoicePayment: async (command) => {
      received = command;
      state.invoiceBalance -= command.amount;
      return 'payment-1';
    },
  }));

  renderPage({
    page: <ReceivablesPage />,
    permissions: ['accounting.read', 'accounting.write'],
    repository: repositoryWithState(state),
    service,
  });

  fireEvent.click(await screen.findByRole('button', { name: 'Record payment INV-1001' }));
  fireEvent.change(screen.getByLabelText('Payment amount'), { target: { value: '25' } });
  fireEvent.change(screen.getByLabelText('Payment date'), { target: { value: '2026-09-04' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit payment' }));

  expect(await screen.findByText('Payment recorded')).toBeInTheDocument();
  expect(received).toEqual({
    organizationId: 'org-test',
    invoiceId: 'invoice-1',
    amount: 25,
    paidOn: '2026-09-04',
  });
  expect(await screen.findByText('$75.00')).toBeInTheDocument();
});

test('does not expose bill approval controls without accounting.write', async () => {
  const state = { invoiceBalance: 100, billApproval: 'pending' };
  renderPage({
    page: <PayablesPage />,
    permissions: ['accounting.read'],
    repository: repositoryWithState(state),
    service: new ArApWriteService(gatewayWith()),
  });

  await screen.findByText('BILL-1001');
  expect(screen.queryByRole('button', { name: 'Approve BILL-1001' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reject BILL-1001' })).not.toBeInTheDocument();
});

test('approves a bill through the governed service and reloads real data', async () => {
  const state = { invoiceBalance: 100, billApproval: 'pending' };
  let received: SetBillApprovalCommand | undefined;
  const service = new ArApWriteService(gatewayWith({
    setBillApprovalState: async (command) => {
      received = command;
      state.billApproval = command.approvalState;
      return command.billId;
    },
  }));

  renderPage({
    page: <PayablesPage />,
    permissions: ['accounting.read', 'accounting.write'],
    repository: repositoryWithState(state),
    service,
  });

  fireEvent.click(await screen.findByRole('button', { name: 'Approve BILL-1001' }));

  expect(await screen.findByText('Bill approval updated')).toBeInTheDocument();
  expect(received).toEqual({
    organizationId: 'org-test',
    billId: 'bill-1',
    approvalState: 'approved',
  });
  expect(await screen.findByText('approved')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
});
