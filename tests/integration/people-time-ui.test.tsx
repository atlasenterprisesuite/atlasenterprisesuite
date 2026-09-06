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
import { PeopleTimeWriteProvider } from '../../apps/web/src/modules/people/PeopleTimeWriteProvider';
import {
  PeopleTimeWriteService,
  type PeopleRepository,
  type PeopleTimeWriteGateway,
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
  listTimeEntries: async () => [{
    id: 'time-a',
    organizationId: 'org-a',
    employeeId: 'employee-a',
    workDate: '2026-09-06',
    clockIn: '2026-09-06T09:00:00Z',
    clockOut: '2026-09-06T17:30:00Z',
    breakMinutes: 30,
    status: 'draft',
    approvedBy: null,
    approvedAt: null,
    createdAt: '2026-09-06T09:00:00Z',
    updatedAt: '2026-09-06T17:30:00Z',
  }],
  listPayrollRuns: async () => [],
  listPayrollLines: async () => [],
  listApplications: async () => [],
};

function sourceFor(state: AtlasIdentityState): AtlasIdentitySource {
  return { resolve: async () => state };
}

function renderPeople(
  identity: AtlasIdentityState,
  writeService: PeopleTimeWriteService | null = null,
) {
  return render(
    <MemoryRouter initialEntries={['/people/time']}>
      <AtlasProvider source={sourceFor(identity)}>
        <PeopleRepositoryProvider repository={repository}>
          <PeopleTimeWriteProvider service={writeService}>
            <App />
          </PeopleTimeWriteProvider>
        </PeopleRepositoryProvider>
      </AtlasProvider>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

it('renders organization time data and derives worked hours without fake metrics', async () => {
  renderPeople({
    status: 'ready',
    userId: 'manager-a',
    organizationId: 'org-a',
    organizationName: 'Test Organization',
    role: 'manager',
    permissions: ['hr.read'],
  });

  expect(await screen.findByRole('heading', { name: 'Time & Attendance' })).toBeInTheDocument();
  expect(screen.getByText('Ada Rivera')).toBeInTheDocument();
  expect(screen.getByText('8.00 h')).toBeInTheDocument();
  expect(screen.getByLabelText('Status filter')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Submit time entry time-a' })).not.toBeInTheDocument();
});

it('submits a draft through the governed write service when HR write is authorized', async () => {
  const submitTimeEntry = vi.fn(async () => 'time-a');
  const gateway: PeopleTimeWriteGateway = {
    createTimeEntry: async () => 'time-new',
    submitTimeEntry,
    approveTimeEntry: async () => 'time-a',
    rejectTimeEntry: async () => 'time-a',
  };
  const service = new PeopleTimeWriteService(gateway);

  renderPeople({
    status: 'ready',
    userId: 'manager-a',
    organizationId: 'org-a',
    organizationName: 'Test Organization',
    role: 'manager',
    permissions: ['hr.read', 'hr.write'],
  }, service);

  await screen.findByRole('heading', { name: 'Time & Attendance' });
  fireEvent.click(screen.getByRole('button', { name: 'Submit time entry time-a' }));

  await waitFor(() => expect(submitTimeEntry).toHaveBeenCalledWith({
    organizationId: 'org-a',
    timeEntryId: 'time-a',
  }));
  expect(await screen.findByText('Time entry submitted')).toBeInTheDocument();
});

it('fails closed when the identity has no People permission', async () => {
  renderPeople({
    status: 'ready',
    userId: 'viewer-a',
    organizationId: 'org-a',
    organizationName: 'Test Organization',
    role: 'viewer',
    permissions: ['accounting.read'],
  });

  expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Time & Attendance' })).not.toBeInTheDocument();
});
