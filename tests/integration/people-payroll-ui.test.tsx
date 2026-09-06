// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';
import {
  AtlasProvider,
  type AtlasIdentitySource,
  type AtlasIdentityState,
} from '../../apps/web/src/app/AtlasContext';
import { PeopleRepositoryProvider } from '../../apps/web/src/modules/people/PeopleDataProvider';
import { PeoplePayrollWriteProvider } from '../../apps/web/src/modules/people/PeoplePayrollWriteProvider';
import {
  PeoplePayrollWriteService,
  type PeoplePayrollWriteGateway,
  type PeopleRepository,
} from '../../packages/people/src';

const repository: PeopleRepository = {
  listEmployees: async () => [{
    id: 'employee-a',
    organizationId: 'org-a',
    userId: 'user-a',
    fullName: 'Ada Rivera',
    department: 'Finance',
    jobTitle: 'Payroll Specialist',
    status: 'active',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  }],
  getEmployee: async () => null,
  listTimeEntries: async () => [],
  listPayrollRuns: async () => [{
    id: 'payroll-a',
    organizationId: 'org-a',
    periodStart: '2026-08-31',
    periodEnd: '2026-09-06',
    payDate: '2026-09-11',
    status: 'calculated',
    approvedBy: null,
    approvedAt: null,
    voidReason: null,
    createdAt: '2026-09-06T12:00:00Z',
    updatedAt: '2026-09-06T12:00:00Z',
  }],
  listPayrollLines: async () => [{
    id: 'line-a',
    organizationId: 'org-a',
    payrollRunId: 'payroll-a',
    employeeId: 'employee-a',
    regularHours: 40,
    overtimeHours: 5,
    hourlyRate: 20,
    salaryPeriodAmount: null,
    grossPay: 950,
    pretaxDeductions: 50,
    taxesWithheld: 150,
    posttaxDeductions: 25,
    netPay: 725,
    calculation: { calculation_version: 'people-payroll-v1', overtime_multiplier: 1.5 },
    createdAt: '2026-09-06T12:00:00Z',
    updatedAt: '2026-09-06T12:00:00Z',
  }],
  listApplications: async () => [],
};

function sourceFor(state: AtlasIdentityState): AtlasIdentitySource {
  return { resolve: async () => state };
}

function renderPayroll(
  identity: AtlasIdentityState,
  writeService: PeoplePayrollWriteService | null = null,
) {
  return render(
    <MemoryRouter initialEntries={['/people/payroll']}>
      <AtlasProvider source={sourceFor(identity)}>
        <PeopleRepositoryProvider repository={repository}>
          <PeoplePayrollWriteProvider service={writeService}>
            <App />
          </PeoplePayrollWriteProvider>
        </PeopleRepositoryProvider>
      </AtlasProvider>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

it('shows persisted payroll totals and explicit unconfigured provider states', async () => {
  renderPayroll({
    status: 'ready',
    userId: 'payroll-reader',
    organizationId: 'org-a',
    organizationName: 'Test Organization',
    role: 'accountant',
    permissions: ['payroll.read'],
  });

  expect(await screen.findByRole('heading', { name: 'Payroll' })).toBeInTheDocument();
  expect(screen.getByText('Ada Rivera')).toBeInTheDocument();
  expect(screen.getByText('$950.00')).toBeInTheDocument();
  expect(screen.getByText('$725.00')).toBeInTheDocument();
  expect(screen.getByText('Tax filing: Not configured')).toBeInTheDocument();
  expect(screen.getByText('Payment rail: Not configured')).toBeInTheDocument();
  expect(screen.queryByText(/^Filed$/)).not.toBeInTheDocument();
  expect(screen.queryByText(/^Paid$/)).not.toBeInTheDocument();
  expect(screen.queryByText(/^Connected$/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Approve payroll payroll-a' })).not.toBeInTheDocument();
});

it('approves a calculated run only when payroll.approve is present and a governed write service exists', async () => {
  const approvePayrollRun = vi.fn(async () => 'payroll-a');
  const gateway: PeoplePayrollWriteGateway = {
    createPayrollRun: async () => 'payroll-new',
    savePayrollLine: async () => 'line-new',
    calculatePayrollRun: async () => 'payroll-a',
    approvePayrollRun,
    lockPayrollRun: async () => 'payroll-a',
    voidPayrollRun: async () => 'payroll-a',
  };
  const service = new PeoplePayrollWriteService(gateway);

  renderPayroll({
    status: 'ready',
    userId: 'approver-a',
    organizationId: 'org-a',
    organizationName: 'Test Organization',
    role: 'admin',
    permissions: ['payroll.read', 'payroll.approve'],
  }, service);

  await screen.findByRole('heading', { name: 'Payroll' });
  fireEvent.click(screen.getByRole('button', { name: 'Approve payroll payroll-a' }));

  await waitFor(() => expect(approvePayrollRun).toHaveBeenCalledWith({
    organizationId: 'org-a',
    payrollRunId: 'payroll-a',
  }));
  expect(await screen.findByText('Payroll approved')).toBeInTheDocument();
});

it('denies the management payroll route without payroll.read', async () => {
  renderPayroll({
    status: 'ready',
    userId: 'hr-reader',
    organizationId: 'org-a',
    organizationName: 'Test Organization',
    role: 'manager',
    permissions: ['hr.read'],
  });

  expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Payroll' })).not.toBeInTheDocument();
});
