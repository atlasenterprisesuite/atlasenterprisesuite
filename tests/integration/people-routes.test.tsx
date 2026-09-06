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

it('shows only Payroll for a payroll reader', async () => {
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
  expect(screen.queryByRole('link', { name: /Time & Attendance/ })).not.toBeInTheDocument();
});

it('shows only Time & Attendance for an HR reader without payroll access', async () => {
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
  expect(screen.queryByRole('link', { name: /^Payroll/ })).not.toBeInTheDocument();
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
