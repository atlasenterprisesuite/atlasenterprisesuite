// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';
import { AtlasProvider, type AtlasIdentitySource, type AtlasIdentityState } from '../../apps/web/src/app/AtlasContext';
import { CompensationRepositoryProvider } from '../../apps/web/src/modules/people/CompensationDataProvider';
import { PeopleCompensationWriteProvider } from '../../apps/web/src/modules/people/PeopleCompensationWriteProvider';
import { PeopleRepositoryProvider } from '../../apps/web/src/modules/people/PeopleDataProvider';
import {
  PeopleCompensationWriteService,
  type CompensationRepository,
  type PeopleCompensationWriteGateway,
  type PeopleRepository,
} from '../../packages/people/src';

const peopleRepository: PeopleRepository = {
  listEmployees: async () => [{
    id: 'employee-a', organizationId: 'org-a', userId: 'user-a', fullName: 'Ada Rivera',
    department: 'Finance', jobTitle: 'Payroll Specialist', status: 'active',
    createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
  }],
  getEmployee: async () => null,
  listTimeEntries: async () => [],
  listPayrollRuns: async () => [],
  listPayrollLines: async () => [],
  listApplications: async () => [],
};

const compensationRepository: CompensationRepository = {
  listCompensation: async () => [{
    id: 'comp-a', organizationId: 'org-a', employeeId: 'employee-a', payType: 'hourly', hourlyRate: 22,
    annualSalary: null, effectiveFrom: '2026-07-01', effectiveTo: null,
    createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
  }],
  listDeductions: async () => [{
    id: 'ded-a', organizationId: 'org-a', employeeId: 'employee-a', code: 'HEALTH', label: 'Health Plan',
    treatment: 'pretax', calculationType: 'percent', amount: 0.05, active: true,
    createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
  }],
};

function sourceFor(state: AtlasIdentityState): AtlasIdentitySource {
  return { resolve: async () => state };
}

function renderCompensation(identity: AtlasIdentityState, service: PeopleCompensationWriteService | null = null) {
  return render(
    <MemoryRouter initialEntries={['/people/compensation']}>
      <AtlasProvider source={sourceFor(identity)}>
        <PeopleRepositoryProvider repository={peopleRepository}>
          <CompensationRepositoryProvider repository={compensationRepository}>
            <PeopleCompensationWriteProvider service={service}>
              <App />
            </PeopleCompensationWriteProvider>
          </CompensationRepositoryProvider>
        </PeopleRepositoryProvider>
      </AtlasProvider>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

it('shows persisted compensation and deductions to payroll readers without write controls', async () => {
  renderCompensation({
    status: 'ready', userId: 'reader-a', organizationId: 'org-a', organizationName: 'Test Organization',
    role: 'accountant', permissions: ['payroll.read'],
  });

  expect(await screen.findByRole('heading', { name: 'Compensation & Benefits' })).toBeInTheDocument();
  expect(screen.getByText('Ada Rivera')).toBeInTheDocument();
  expect(screen.getByText('$22.00 / hour')).toBeInTheDocument();
  expect(screen.getByText(/Health Plan/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save compensation' })).not.toBeInTheDocument();
});

it('creates compensation only through the governed service when payroll.write is present', async () => {
  const createCompensation = vi.fn(async () => 'comp-new');
  const gateway: PeopleCompensationWriteGateway = {
    createCompensation,
    setDeduction: async () => 'ded-a',
  };
  const service = new PeopleCompensationWriteService(gateway);

  renderCompensation({
    status: 'ready', userId: 'writer-a', organizationId: 'org-a', organizationName: 'Test Organization',
    role: 'admin', permissions: ['payroll.read', 'payroll.write'],
  }, service);

  await screen.findByRole('heading', { name: 'Compensation & Benefits' });
  fireEvent.change(screen.getByLabelText('Hourly rate'), { target: { value: '25' } });
  fireEvent.change(screen.getByLabelText('Effective start'), { target: { value: '2026-10-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save compensation' }));

  await waitFor(() => expect(createCompensation).toHaveBeenCalledWith(expect.objectContaining({
    organizationId: 'org-a',
    employeeId: 'employee-a',
    payType: 'hourly',
    hourlyRate: 25,
    annualSalary: null,
    effectiveFrom: '2026-10-01',
  })));
  expect(await screen.findByText('Compensation saved')).toBeInTheDocument();
});

it('denies Compensation management without payroll.read', async () => {
  renderCompensation({
    status: 'ready', userId: 'hr-reader', organizationId: 'org-a', organizationName: 'Test Organization',
    role: 'manager', permissions: ['hr.read'],
  });

  expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Compensation & Benefits' })).not.toBeInTheDocument();
});
