// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test } from 'vitest';
import { App } from '../../apps/web/src/App';
import { AtlasProvider, type AtlasIdentitySource, type AtlasIdentityState } from '../../apps/web/src/app/AtlasContext';

afterEach(cleanup);

function renderAtlas(path: string, state: AtlasIdentityState) {
  const source: AtlasIdentitySource = { resolve: async () => state };
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AtlasProvider source={source}>
        <App />
      </AtlasProvider>
    </MemoryRouter>,
  );
}

test('routes unauthenticated canonical app access through ATLAS Identity', async () => {
  renderAtlas('/app/finance', { status: 'authentication_required' });
  expect(await screen.findByRole('heading', { name: 'Sign in to ATLAS' })).toBeInTheDocument();
});

test('renders the 18-module launcher for an authenticated owner context', async () => {
  renderAtlas('/app', {
    status: 'ready',
    userId: 'owner-1',
    userEmail: 'owner@example.com',
    tenantId: 'tenant-1',
    tenantName: 'ATLAS',
    organizationId: 'org-1',
    organizationName: 'Enterprise',
    role: 'owner',
    permissions: [
      'hr.read', 'payroll.read', 'accounting.read',
      'revenue.crm.read', 'revenue.projects.read',
      'voice.personal.read', 'forge.release.read',
    ],
  });

  expect(await screen.findByRole('heading', { name: 'ATLAS Enterprise Suite' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /ATLAS Finance/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /ATLAS Identity/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /ATLAS Global/i })).toBeInTheDocument();
});
