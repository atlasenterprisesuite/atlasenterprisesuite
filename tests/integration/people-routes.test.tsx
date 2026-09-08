// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';
import {
  AtlasProvider,
  type AtlasIdentitySource,
  type AtlasIdentityState,
} from '../../apps/web/src/app/AtlasContext';

function sourceFor(state: AtlasIdentityState): AtlasIdentitySource {
  return { resolve: async () => state };
}

function renderPeopleHome(state: AtlasIdentityState) {
  return render(
    <MemoryRouter initialEntries={['/people']}>
      <AtlasProvider source={sourceFor(state)}>
        <App />
      </AtlasProvider>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

it('shows Payroll and Compensation for a payroll reader', async () => {
  renderPeopleHome({
    status: 'ready',
    userId: 'payroll-reader',
    organizationId: 'org-a',
    organizationName: 'Test Organization',
    role: 'accountant',
    permissions: ['payroll.read'],
  });

  expect(await screen.findByRole('heading', { name: 'People Operations' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'People' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Payroll/ })).toHaveAttribute('href', '/people/payroll');
  expect(screen.getByRole('link', { name: /Compensation & Benefits/ })).toHaveAttribute('href', '/people/compensation');
  expect(screen.queryByRole('link', { name: /Time & Attendance/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Recruiting/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Employee Self-Service/ })).not.toBeInTheDocument();
});

it('shows Time & Attendance and Recruiting for an HR reader without payroll access', async () => {
  renderPeopleHome({
    status: 'ready',
    userId: 'hr-reader',
    organizationId: 'org-a',
    organizationName: 'Test Organization',
    role: 'manager',
    permissions: ['hr.read'],
  });

  expect(await screen.findByRole('heading', { name: 'People Operations' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Time & Attendance/ })).toHaveAttribute('href', '/people/time');
  expect(screen.getByRole('link', { name: /Recruiting/ })).toHaveAttribute('href', '/people/recruiting');
  expect(screen.queryByRole('link', { name: /^Payroll/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Compensation & Benefits/ })).not.toBeInTheDocument();
});

it('shows self-service and time for an employee self-service identity', async () => {
  renderPeopleHome({
    status: 'ready',
    userId: 'employee-a',
    organizationId: 'org-a',
    organizationName: 'Test Organization',
    role: 'staff',
    permissions: ['payroll.self'],
  });

  expect(await screen.findByRole('heading', { name: 'People Operations' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Time & Attendance/ })).toHaveAttribute('href', '/people/time');
  expect(screen.getByRole('link', { name: /Employee Self-Service/ })).toHaveAttribute('href', '/people/self-service');
  expect(screen.queryByRole('link', { name: /^Payroll/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Compensation & Benefits/ })).not.toBeInTheDocument();
});

it('fails closed and hides People navigation without People permissions', async () => {
  renderPeopleHome({
    status: 'ready',
    userId: 'viewer-a',
    organizationId: 'org-a',
    organizationName: 'Test Organization',
    role: 'viewer',
    permissions: ['accounting.read'],
  });

  expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'People' })).not.toBeInTheDocument();
});
