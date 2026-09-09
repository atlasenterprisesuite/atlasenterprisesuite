// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';
import { AtlasProvider, type AtlasIdentitySource, type AtlasIdentityState } from '../../apps/web/src/app/AtlasContext';

function sourceFor(state: AtlasIdentityState): AtlasIdentitySource {
  return { resolve: async () => state };
}

function renderRoute(state: AtlasIdentityState) {
  return render(
    <MemoryRouter initialEntries={['/operations']}>
      <AtlasProvider source={sourceFor(state)}>
        <App />
      </AtlasProvider>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

it('mounts the Revenue Operations Center for an authorized identity', async () => {
  renderRoute({
    status: 'ready',
    userId: 'ops-a',
    tenantId: 'tenant-a',
    tenantName: 'Tenant A',
    organizationId: 'org-a',
    organizationName: 'Org A',
    role: 'manager',
    permissions: ['revenue.crm.read', 'revenue.sales.read', 'revenue.inventory.read'],
  });

  expect(await screen.findByRole('heading', { name: 'Revenue Operations' })).toBeInTheDocument();
  expect(screen.getByText('Purchasing: Not configured')).toBeInTheDocument();
  expect(screen.queryByText(/Payment provider connected/i)).not.toBeInTheDocument();
});

it('fails closed without Revenue Operations permissions', async () => {
  renderRoute({
    status: 'ready',
    userId: 'viewer-a',
    tenantId: 'tenant-a',
    tenantName: 'Tenant A',
    organizationId: 'org-a',
    organizationName: 'Org A',
    role: 'viewer',
    permissions: ['core.read'],
  });

  expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Operations' })).not.toBeInTheDocument();
});
