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
import { CompensationRepositoryProvider } from '../../apps/web/src/modules/people/CompensationDataProvider';
import { PeopleRepositoryProvider } from '../../apps/web/src/modules/people/PeopleDataProvider';
import { PeoplePayrollWriteProvider } from '../../apps/web/src/modules/people/PeoplePayrollWriteProvider';
import {
  PeoplePayrollWriteService,
  type CompensationRepository,
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
  }, {
    id: 'payroll-draft',
    organizationId: 'org-a',
    periodStart: '2026-09-07',
    periodEnd: '2026-09-13',
    payDate: '2026-09-18',
    status: 'draft',
    approvedBy: null,
    approvedAt: null,
    voidReason: null,
    createdAt: '2026-09-10T12:00:00Z',
    updatedAt: '2026-09-10T12:00:00Z',
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
  compensationRepository: CompensationRepository | null = null,
) {
  return render(
    <MemoryRouter initialEntries={['/people/payroll']}>
      <AtlasProvider source={sourceFor(identity)}>
        <PeopleRepositoryProvider repository={repository}>
          <CompensationRepositoryProvider repository={compensationRepository}>
            <PeoplePayrollWriteProvider service={writeService}>
              <App />
            </PeoplePayrollWriteProvider>
          </CompensationRepositoryProvider>
        </PeopleRepositoryProvider>
      </AtlasProvider>
    </MemoryRouter>,
  );
}

function payrollGateway(overrides: Partial<PeoplePayrollWriteGateway> = {}): PeoplePayrollWriteGateway {
  return {
    createPayrollRun: async () => 'payroll-new',
    savePayrollLine: async () => 'line-new',
    calculatePayrollRun: async () => 'payroll-a',
    approvePayrollRun: async () => 'payroll-a',
    lockPayrollRun: async () => 'payroll-a',
    voidPayrollRun: async () => 'payroll-a',
    ...overrides,
  };
}

afterEach(cleanup);

it('shows persisted payroll totals and explicit unconfigured provider states', async () => {
  renderPayroll({
    status: 'ready',
    userId: 'payroll-reader',
    tenantId: 'tenant-a',
    tenantName: 'Test Tenant',
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
  expect(screen.queryByRole('button', { name: 'Create payroll run' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save payroll line payroll-draft' })).not.toBeInTheDocument();
});

it('creates a payroll run through the governed write service for payroll.write', async () => {
  const createPayrollRun = vi.fn(async () => 'payroll-new');
  const service = new PeoplePayrollWriteService(payrollGateway({ createPayrollRun }));

  renderPayroll({
    status: 'ready',
    userId: 'payroll-writer',
    tenantId: 'tenant-a',
    tenantName: 'Test Tenant',
    organizationId: 'org-a',
    organizationName: 'Test Organization',
    role: 'payroll-admin',
    permissions: ['payroll.read', 'payroll.write'],
  }, service);

  await screen.findByRole('heading', { name: 'Payroll' });
  fireEvent.change(screen.getByLabelText('Payroll period start'), { target: { value: '2026-09-14' } });
  fireEvent.change(screen.getByLabelText('Payroll period end'), { target: { value: '2026-09-20' } });
  fireEvent.change(screen.getByLabelText('Payroll pay date'), { target: { value: '2026-09-25' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create payroll run' }));

  await waitFor(() => expect(createPayrollRun).toHaveBeenCalledWith({
    organizationId: 'org-a',
    periodStart: '2026-09-14',
    periodEnd: '2026-09-20',
    payDate: '2026-09-25',
  }));
  expect(await screen.findByText('Payroll run created')).toBeInTheDocument();
});

it('saves an hourly payroll line and uses persisted compensation as the rate source when available', async () => {
  const savePayrollLine = vi.fn(async () => 'line-new');
  const service = new PeoplePayrollWriteService(payrollGateway({ savePayrollLine }));
  const compensationRepository: CompensationRepository = {
    listCompensation: async () => [{
      id: 'comp-a',
      organizationId: 'org-a',
      employeeId: 'employee-a',
      payType: 'hourly',
      hourlyRate: 22.5,
      annualSalary: null,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }],
    listDeductions: async () => [],
  };

  renderPayroll({
    status: 'ready',
    userId: 'payroll-writer',
    tenantId: 'tenant-a',
    tenantName: 'Test Tenant',
    organizationId: 'org-a',
    organizationName: 'Test Organization',
    role: 'payroll-admin',
    permissions: ['payroll.read', 'payroll.write'],
  }, service, compensationRepository);

  await screen.findByRole('heading', { name: 'Payroll' });
  fireEvent.change(screen.getByLabelText('Payroll line employee payroll-draft'), { target: { value: 'employee-a' } });

  await waitFor(() => expect(screen.getByLabelText('Hourly rate payroll-draft')).toHaveValue(22.5));
  expect(screen.getByText('Rate loaded from compensation effective on 2026-09-13.')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Regular hours payroll-draft'), { target: { value: '40' } });
  fireEvent.change(screen.getByLabelText('Overtime hours payroll-draft'), { target: { value: '5' } });
  fireEvent.change(screen.getByLabelText('Pretax deductions payroll-draft'), { target: { value: '50' } });
  fireEvent.change(screen.getByLabelText('Taxes withheld payroll-draft'), { target: { value: '150' } });
  fireEvent.change(screen.getByLabelText('Posttax deductions payroll-draft'), { target: { value: '25' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save payroll line payroll-draft' }));

  await waitFor(() => expect(savePayrollLine).toHaveBeenCalledWith({
    organizationId: 'org-a',
    payrollRunId: 'payroll-draft',
    employeeId: 'employee-a',
    calculationInput: {
      regularHours: 40,
      overtimeHours: 5,
      hourlyRate: 22.5,
      overtimeMultiplier: 1.5,
      salaryPeriodAmount: null,
      pretaxDeductions: 50,
      taxesWithheld: 150,
      posttaxDeductions: 25,
    },
    calculation: {
      regularPay: 900,
      overtimePay: 168.75,
      grossPay: 1068.75,
      pretaxDeductions: 50,
      taxesWithheld: 150,
      posttaxDeductions: 25,
      netPay: 843.75,
    },
  }));
  expect(await screen.findByText('Payroll line saved')).toBeInTheDocument();
});

it('does not invent a salary-period amount from annual compensation', async () => {
  const service = new PeoplePayrollWriteService(payrollGateway());
  const compensationRepository: CompensationRepository = {
    listCompensation: async () => [{
      id: 'comp-salary',
      organizationId: 'org-a',
      employeeId: 'employee-a',
      payType: 'salary',
      hourlyRate: null,
      annualSalary: 78000,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }],
    listDeductions: async () => [],
  };

  renderPayroll({
    status: 'ready',
    userId: 'payroll-writer',
    tenantId: 'tenant-a',
    tenantName: 'Test Tenant',
    organizationId: 'org-a',
    organizationName: 'Test Organization',
    role: 'payroll-admin',
    permissions: ['payroll.read', 'payroll.write'],
  }, service, compensationRepository);

  await screen.findByRole('heading', { name: 'Payroll' });
  fireEvent.change(screen.getByLabelText('Payroll line employee payroll-draft'), { target: { value: 'employee-a' } });

  await waitFor(() => expect(screen.getByLabelText('Pay type payroll-draft')).toHaveValue('salary'));
  expect(screen.getByLabelText('Salary period amount payroll-draft')).toHaveValue(null);
  expect(screen.getByText('Annual salary on file: $78,000.00. Enter the verified amount for this payroll period; ATLAS does not infer payroll frequency.')).toBeInTheDocument();
});

it('approves a calculated run only when payroll.approve is present and a governed write service exists', async () => {
  const approvePayrollRun = vi.fn(async () => 'payroll-a');
  const service = new PeoplePayrollWriteService(payrollGateway({ approvePayrollRun }));

  renderPayroll({
    status: 'ready',
    userId: 'approver-a',
    tenantId: 'tenant-a',
    tenantName: 'Test Tenant',
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
    tenantId: 'tenant-a',
    tenantName: 'Test Tenant',
    organizationId: 'org-a',
    organizationName: 'Test Organization',
    role: 'manager',
    permissions: ['hr.read'],
  });

  expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Payroll' })).not.toBeInTheDocument();
});
