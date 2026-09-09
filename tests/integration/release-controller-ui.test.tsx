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

function renderRelease(permissions: string[]) {
  const state: AtlasIdentityState = {
    status: 'ready',
    userId: 'release-user',
    tenantId: 'tenant-a',
    tenantName: 'Tenant A',
    organizationId: 'org-a',
    organizationName: 'Org A',
    role: 'owner',
    permissions,
  };
  return render(
    <MemoryRouter initialEntries={['/release']}>
      <AtlasProvider source={sourceFor(state)}>
        <App />
      </AtlasProvider>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

it('shows the Release Controller without pretending the pending registry is active', async () => {
  renderRelease(['forge.release.read']);
  expect(await screen.findByRole('heading', { name: 'ATLAS Release Controller' })).toBeInTheDocument();
  expect(screen.getByText('Release registry: Pending replay')).toBeInTheDocument();
  expect(screen.getByText('Production activation: Locked')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Activate/i })).not.toBeInTheDocument();
});

it('fails closed without release-read permission', async () => {
  renderRelease(['core.read']);
  expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Release' })).not.toBeInTheDocument();
});
