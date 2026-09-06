// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';
import { AtlasProvider, type AtlasIdentitySource, type AtlasIdentityState } from '../../apps/web/src/app/AtlasContext';
import { CompensationRepositoryProvider } from '../../apps/web/src/modules/people/CompensationDataProvider';
import { PeopleRepositoryProvider } from '../../apps/web/src/modules/people/PeopleDataProvider';
import type { CompensationRepository, PeopleRepository } from '../../packages/people/src';

const peopleRepository: PeopleRepository = {
  listEmployees: async () => [
    {
      id: 'employee-a', organizationId: 'org-a', userId: 'user-a', fullName: 'Ada Rivera', department: 'Finance',
      jobTitle: 'Payroll Specialist', status: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
    },
    {
      id: 'employee-b', organizationId: 'org-a', userId: 'user-b', fullName: 'Bob Other', department: 'Sales',
      jobTitle: 'Sales Rep', status: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
    },
  ],
  getEmployee: async (_org, employeeId) => employeeId === 'employee-a' ? {
    id: 'employee-a', organizationId: 'org-a', userId: 'user-a', fullName: 'Ada Rivera', department: 'Finance',
    jobTitle: 'Payroll Specialist', status: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
  } : null,
  listTimeEntries: async (_org, employeeId) => employeeId === 'employee-a' ? [{
    id: 'time-a', organizationId: 'org-a', employeeId: 'employee-a', workDate: '2026-09-06',
    clockIn: '2026-09-06T09:00:00Z', clockOut: '2026-09-06T17:30:00Z', breakMinutes: 30,
    status: 'approved', approvedBy: 'manager-a', approvedAt: '2026-09-06T18:00:00Z',
    createdAt: '2026-09-06T09:00:00Z', updatedAt: '2026-09-06T18:00:00Z',
  }] : [],
  listPayrollRuns: async () => [],
  listPayrollLines: async (_org, runId) => runId ? [] : [{
    id: 'line-a', organizationId: 'org-a', payrollRunId: 'run-a', employeeId: 'employee-a',
    regularHours: 40, overtimeHours: 5, hourlyRate: 22, salaryPeriodAmount: null, grossPay: 1045,
    pretaxDeductions: 50, taxesWithheld: 170, posttaxDeductions: 25, netPay: 800,
    calculation: { calculation_version: 'people-payroll-v1' }, createdAt: '2026-09-06T12:00:00Z', updatedAt: '2026-09-06T12:00:00Z',
  }],
  listApplications: async () => [],
};

const compensationRepository: CompensationRepository = {
  listCompensation: async (_org, employeeId) => employeeId === 'employee-a' ? [{
    id: 'comp-a', organizationId: 'org-a', employeeId: 'employee-a', payType: 'hourly', hourlyRate: 22,
    annualSalary: null, effectiveFrom: '2026-07-01', effectiveTo: null,
    createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
  }] : [],
  listDeductions: async (_org, employeeId) => employeeId === 'employee-a' ? [{
    id: 'ded-a', organizationId: 'org-a', employeeId: 'employee-a', code: 'HEALTH', label: 'Health Plan',
    treatment: 'pretax', calculationType: 'fixed', amount: 50, active: true,
    createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
  }] : [],
};

function sourceFor(state: AtlasIdentityState): AtlasIdentitySource {
  return { resolve: async () => state };
}

afterEach(cleanup);

it('shows only the authenticated employee self-service read model', async () => {
  render(
    <MemoryRouter initialEntries={['/people/self-service']}>
      <AtlasProvider source={sourceFor({
        status: 'ready', userId: 'user-a', organizationId: 'org-a', organizationName: 'Test Organization',
        role: 'staff', permissions: ['payroll.self'],
      })}>
        <PeopleRepositoryProvider repository={peopleRepository}>
          <CompensationRepositoryProvider repository={compensationRepository}>
            <App />
          </CompensationRepositoryProvider>
        </PeopleRepositoryProvider>
      </AtlasProvider>
    </MemoryRouter>,
  );

  expect(await screen.findByRole('heading', { name: 'Employee Self-Service' })).toBeInTheDocument();
  expect(screen.getByText('Ada Rivera')).toBeInTheDocument();
  expect(screen.getByText('$22.00 / hour')).toBeInTheDocument();
  expect(screen.getByText('Health Plan')).toBeInTheDocument();
  expect(screen.getByText('$800.00')).toBeInTheDocument();
  expect(screen.getByText('8.00 h')).toBeInTheDocument();
  expect(screen.queryByText('Bob Other')).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('denies self-service without payroll.self', async () => {
  render(
    <MemoryRouter initialEntries={['/people/self-service']}>
      <AtlasProvider source={sourceFor({
        status: 'ready', userId: 'user-a', organizationId: 'org-a', organizationName: 'Test Organization',
        role: 'viewer', permissions: ['accounting.read'],
      })}>
        <PeopleRepositoryProvider repository={peopleRepository}>
          <CompensationRepositoryProvider repository={compensationRepository}>
            <App />
          </CompensationRepositoryProvider>
        </PeopleRepositoryProvider>
      </AtlasProvider>
    </MemoryRouter>,
  );

  expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
});
