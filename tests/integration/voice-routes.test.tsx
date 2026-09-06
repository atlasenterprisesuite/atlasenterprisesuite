// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';
import { AtlasProvider, type AtlasIdentitySource } from '../../apps/web/src/app/AtlasContext';

const source: AtlasIdentitySource = {
  resolve: async () => ({
    status: 'ready',
    userId: 'voice-owner-a',
    organizationId: 'org-a',
    organizationName: 'Test Organization',
    role: 'staff',
    permissions: ['voice.personal.read', 'voice.personal.create', 'voice.personal.record', 'voice.personal.use'],
  }),
};

function renderRoute(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AtlasProvider source={source}>
        <App />
      </AtlasProvider>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

it('renders ATLAS Voice from the canonical shell', async () => {
  renderRoute('/voice');
  expect(await screen.findByRole('heading', { name: 'ATLAS Voice' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Personal Voice/ })).toHaveAttribute('href', '/voice/personal-voice');
});

it('keeps Personal Voice generation truthfully unavailable without a provider', async () => {
  renderRoute('/voice/personal-voice');
  expect(await screen.findByRole('heading', { name: 'Personal Voice' })).toBeInTheDocument();
  expect(screen.getByText('Voice generation provider: Not configured')).toBeInTheDocument();
  expect(screen.queryByText(/^Ready$/)).not.toBeInTheDocument();
});

it('is truthful about Apple Personal Voice capability on web', async () => {
  renderRoute('/voice/personal-voice/apple');
  expect(await screen.findByRole('heading', { name: 'Apple Personal Voice' })).toBeInTheDocument();
  expect(screen.getByText(/Requires ATLAS iOS app/i)).toBeInTheDocument();
  expect(screen.getByText(/Audio export: Unavailable/i)).toBeInTheDocument();
  expect(screen.getByText(/Telephony: Unavailable/i)).toBeInTheDocument();
});
