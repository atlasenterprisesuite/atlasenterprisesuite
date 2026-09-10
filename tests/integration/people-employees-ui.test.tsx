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
import { PeopleEmployeeWriteProvider } from '../../apps/web/src/modules/people/PeopleEmployeeWriteProvider';
import {
  PeopleEmployeeWriteService,
  type PeopleEmployeeWriteGateway,
  type PeopleRepository,
} from '../../packages/people/src';

const repository: PeopleRepository = {
  listEmployees: async () => [
    {
      id: 'employee-a',
      organizationId: 'org-a',
      userId: null,
      fullName: 'Ada Rivera',
      department: 'Finance',
      jobTitle: 'Payroll Specialist',
      status: 'active',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    },
    {
      id: 'employee-b',
      organizationId: 'org-a',
      userId: 'user-b',
      fullName: 'Grace Torres',
      department: 'Operations',
      jobTitle: 'Operations Manager',
      status: 'leave',
      createdAt: '2026-09-02T00:00:00Z',
      updatedAt: '2026-09-02T00:00:00Z',
    },
  ],
  getEmployee: async () => null,
  listTimeEntries: async () => [],
  listPayrollRuns: async () => [],
  listPayrollLines: async () => [],
  listApplications: async () => [],
};

function sourceFor(state: AtlasIdentityState): AtlasIdentitySource {
  return { resolve: async () => state };
}

function renderEmployees(
  identity: AtlasIdentityState,
  writeService: PeopleEmployeeWriteService | null = null,
) {
  return render(
    <MemoryRouter initialEntries={['/people/employees']}>
      <AtlasProvider source={sourceFor(identity)}>
        <PeopleRepositoryProvider repository={repository}>
          <PeopleEmployeeWriteProvider service={writeService}>
            <App />
          </PeopleEmployeeWriteProvider>
        </PeopleRepositoryProvider>
      </AtlasProvider>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

it('renders the authorized employee directory with real filters', async () => {
  renderEmployees({
    status: 'ready',
    userId: 'hr-reader',
    tenantId: 'tenant-a',
    tenantName: 'Test Tenant',
    organizationId: 'org-a',
    organizationName: 'Test Organization',
    role: 'manager',
    permissions: ['hr.read'],
  });

  expect(await screen.findByRole('heading', { name: 'Employees' })).toBeInTheDocument();
  expect(screen.getByText('Ada Rivera')).toBeInTheDocument();
  expect(screen.getByText('Grace Torres')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'New employee' })).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Search employees'), { target: { value: 'operations' } });
  expect(screen.queryByText('Ada Rivera')).not.toBeInTheDocument();
  expect(screen.getByText('Grace Torres')).toBeInTheDocument();
});

it('creates an employee only through the governed write service', async () => {
  const createEmployee = vi.fn(async () => 'employee-new');
  const gateway: PeopleEmployeeWriteGateway = {
    createEmployee,
    updateEmployee: async (command) => command.employeeId,
  };
  const service = new PeopleEmployeeWriteService(gateway);

  renderEmployees({
    status: 'ready',
    userId: 'hr-writer',
    tenantId: 'tenant-a',
    tenantName: 'Test Tenant',
    organizationId: 'org-a',
    organizationName: 'Test Organization',
    role: 'manager',
    permissions: ['hr.read', 'hr.write'],
  }, service);

  await screen.findByRole('heading', { name: 'Employees' });
  fireEvent.click(screen.getByRole('button', { name: 'New employee' }));
  fireEvent.change(screen.getByLabelText('Employee full name'), { target: { value: '  Lin Vega  ' } });
  fireEvent.change(screen.getByLabelText('Employee department'), { target: { value: '  Finance  ' } });
  fireEvent.change(screen.getByLabelText('Employee job title'), { target: { value: '  Staff Accountant  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create employee' }));

  await waitFor(() => expect(createEmployee).toHaveBeenCalledWith({
    scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
    fullName: 'Lin Vega',
    department: 'Finance',
    jobTitle: 'Staff Accountant',
    status: 'active',
  }));
  expect(await screen.findByText('Employee created.')).toBeInTheDocument();
});

it('fails closed without an HR permission', async () => {
  renderEmployees({
    status: 'ready',
    userId: 'viewer-a',
    tenantId: 'tenant-a',
    tenantName: 'Test Tenant',
    organizationId: 'org-a',
    organizationName: 'Test Organization',
    role: 'viewer',
    permissions: ['accounting.read'],
  });

  expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Employees' })).not.toBeInTheDocument();
});
