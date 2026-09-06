// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { App } from '../../apps/web/src/App';
import {
  AtlasProvider,
  type AtlasIdentitySource,
  type AtlasIdentityState,
} from '../../apps/web/src/app/AtlasContext';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const readyIdentity: AtlasIdentityState = {
  status: 'ready',
  userId: 'spatial-test-user',
  organizationId: 'spatial-test-org',
  organizationName: 'Spatial Test Organization',
  role: 'admin',
  permissions: ['audit.read'],
};

const source: AtlasIdentitySource = { resolve: async () => readyIdentity };

test('spatial route renders inside the governed A-Z shell and links to Health', async () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  render(
    <MemoryRouter initialEntries={['/spatial']}>
      <AtlasProvider source={source}>
        <App />
      </AtlasProvider>
    </MemoryRouter>,
  );

  expect(await screen.findByRole('heading', { name: /ATLAS Enterprise Suite/i })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'ATLAS modules' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Enter ATLAS Health/i })).toHaveAttribute('href', '/health');
  expect(screen.getByText(/No fabricated live connections/i)).toBeInTheDocument();
});
