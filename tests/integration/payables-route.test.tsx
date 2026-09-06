// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';
import {
  AtlasProvider,
  type AtlasIdentitySource,
  type AtlasIdentityState,
} from '../../apps/web/src/app/AtlasContext';

afterEach(cleanup);

function sourceFor(state: AtlasIdentityState): AtlasIdentitySource {
  return { resolve: async () => state };
}

const readyIdentity: AtlasIdentityState = {
  status: 'ready',
  userId: 'test-user-id',
  organizationId: 'test-organization-id',
  organizationName: 'Test Organization',
  role: 'accountant',
  permissions: ['accounting.read', 'accounting.write', 'audit.read'],
};

function renderAtlas(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AtlasProvider source={sourceFor(readyIdentity)}>
        <App />
      </AtlasProvider>
    </MemoryRouter>,
  );
}

describe('Accounts Payable route', () => {
  it('renders the AP workspace inside the shared ATLAS shell', async () => {
    renderAtlas('/finance/accounting/accounts-payable');
    expect(await screen.findByRole('heading', { name: 'Accounts Payable' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'ATLAS modules' })).toBeInTheDocument();
    expect(screen.getAllByText('Northstar Office Supply').length).toBeGreaterThan(0);
    expect(screen.getByText(/No bank, payment processor/)).toBeInTheDocument();
  });

  it('preserves an intentional degraded Health route instead of breaking', async () => {
    renderAtlas('/health');
    expect(await screen.findByRole('heading', { name: /Health source unavailable/ })).toBeInTheDocument();
  });
});
