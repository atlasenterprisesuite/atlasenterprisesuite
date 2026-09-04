// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, test } from 'vitest';
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

function renderAtlas(path: string, state: AtlasIdentityState = readyIdentity) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AtlasProvider source={sourceFor(state)}>
        <App />
      </AtlasProvider>
    </MemoryRouter>,
  );
}

test('renders the ATLAS application root for a resolved real identity', async () => {
  renderAtlas('/');
  expect(await screen.findByRole('heading', { name: 'ATLAS Enterprise Suite' })).toBeInTheDocument();
  expect(screen.queryByText('Demo environment')).not.toBeInTheDocument();
});

test('renders intentional not found state', async () => {
  renderAtlas('/missing');
  expect(await screen.findByRole('heading', { name: 'Route not found' })).toBeInTheDocument();
});

it.each([
  ['/finance', 'Finance'],
  ['/finance/accounting', 'Accounting'],
  ['/finance/accounting/general-ledger', 'General Ledger'],
  ['/finance/accounting/chart-of-accounts', 'Chart of Accounts'],
  ['/finance/accounting/journal-entries', 'Journal Entries'],
  ['/finance/accounting/accounts-receivable', 'Accounts Receivable'],
  ['/finance/accounting/accounts-payable', 'Accounts Payable'],
  ['/health', 'ATLAS Health'],
])('renders %s in the ATLAS shell for a ready organization identity', async (path, heading) => {
  renderAtlas(path);

  expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'ATLAS modules' })).toBeInTheDocument();
  expect(screen.getByText('Test Organization')).toBeInTheDocument();
  expect(screen.queryByText('Demo environment')).not.toBeInTheDocument();
});

it.each([
  [{ status: 'configuration_required' } as AtlasIdentityState, 'ATLAS configuration required'],
  [{ status: 'authentication_required' } as AtlasIdentityState, 'Authentication required'],
  [{ status: 'organization_required', userId: 'test-user-id' } as AtlasIdentityState, 'Organization required'],
])('renders truthful access state %# instead of business navigation', async (state, heading) => {
  renderAtlas('/finance', state);

  expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'ATLAS modules' })).not.toBeInTheDocument();
});

it.each([
  '/health/research',
  '/health/research/frontiers',
  '/health/research/frontiers/disease-reconstruction',
  '/health/research/frontiers/disease-reconstruction/diseases/test-disease',
  '/health/research/frontiers/disease-reconstruction/neural-graph',
  '/health/research/frontiers/disease-reconstruction/evidence',
  '/health/research/frontiers/disease-reconstruction/falsification',
  '/health/research/frontiers/disease-reconstruction/vulnerability',
  '/health/research/frontiers/disease-reconstruction/curability',
  '/health/research/frontiers/disease-reconstruction/updates',
  '/health/research/frontiers/disease-reconstruction/settings',
])('preserves known historical Health route %s as an explicit degraded state', async (path) => {
  renderAtlas(path);

  expect(await screen.findByRole('heading', { name: 'ATLAS Health' })).toBeInTheDocument();
  expect(screen.getByText('Historical Health source unavailable in this baseline')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Route not found' })).not.toBeInTheDocument();
});
