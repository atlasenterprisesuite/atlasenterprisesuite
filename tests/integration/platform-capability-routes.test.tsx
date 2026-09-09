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

function renderAt(path: string, permissions: string[]) {
  const state: AtlasIdentityState = {
    status: 'ready',
    userId: 'platform-user',
    tenantId: 'tenant-a',
    tenantName: 'Tenant A',
    organizationId: 'org-a',
    organizationName: 'Org A',
    role: 'manager',
    permissions,
  };
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AtlasProvider source={sourceFor(state)}>
        <App />
      </AtlasProvider>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

it('mounts Automations with a truthful persistence boundary', async () => {
  renderAt('/automations', ['automation.read']);
  expect(await screen.findByRole('heading', { name: 'ATLAS Automations' })).toBeInTheDocument();
  expect(screen.getByText('Persistent automation repository: Not configured')).toBeInTheDocument();
  expect(screen.getByText(/Trigger → Conditions → Actions → Permissions → Result/)).toBeInTheDocument();
});

it('mounts Site Review with external providers explicitly not configured', async () => {
  renderAt('/site-review', ['site-review.read']);
  expect(await screen.findByRole('heading', { name: 'ATLAS Site Review' })).toBeInTheDocument();
  expect(screen.getByText(/Core Web Vitals: Not configured/)).toBeInTheDocument();
  expect(screen.getByText(/Search Console: Not configured/)).toBeInTheDocument();
});

it('fails closed when platform permissions are absent', async () => {
  renderAt('/automations', ['core.read']);
  expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Automations' })).not.toBeInTheDocument();
});
