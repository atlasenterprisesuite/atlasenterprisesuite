// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test } from 'vitest';
import { AtlasProvider, type AtlasIdentitySource } from '../../apps/web/src/app/AtlasContext';
import { IdentityPage } from '../../apps/web/src/identity/IdentityPage';

afterEach(cleanup);

test('uses the governed identity action and returns to a safe app route', async () => {
  let authenticated = false;
  let signInCalls = 0;
  const source: AtlasIdentitySource = {
    resolve: async () => authenticated
      ? {
          status: 'ready',
          userId: 'owner-1',
          userEmail: 'owner@example.com',
          tenantId: 'tenant-1',
          tenantName: 'ATLAS',
          organizationId: 'org-1',
          organizationName: 'Enterprise',
          role: 'owner',
          permissions: [],
        }
      : { status: 'authentication_required' },
    signIn: async (email, password) => {
      if (email !== 'owner@example.com' || password.length === 0) throw new Error('invalid_test_credentials');
      signInCalls += 1;
      authenticated = true;
    },
    signOut: async () => undefined,
  };

  render(
    <MemoryRouter initialEntries={['/identity?app=%2Fapp%2Ffinance']}>
      <AtlasProvider source={source}>
        <Routes>
          <Route path="/identity" element={<IdentityPage />} />
          <Route path="/app/finance" element={<h1>Finance target</h1>} />
        </Routes>
      </AtlasProvider>
    </MemoryRouter>,
  );

  expect(await screen.findByRole('heading', { name: 'Sign in to ATLAS' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password-value' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByRole('heading', { name: 'Finance target' })).toBeInTheDocument();
  expect(signInCalls).toBe(1);
  expect(screen.queryByDisplayValue('test-password-value')).not.toBeInTheDocument();
});

test('does not surface an external return target', async () => {
  const source: AtlasIdentitySource = {
    resolve: async () => ({ status: 'authentication_required' }),
  };

  render(
    <MemoryRouter initialEntries={['/identity?app=https%3A%2F%2Fexample.org']}>
      <AtlasProvider source={source}>
        <Routes>
          <Route path="/identity" element={<IdentityPage />} />
          <Route path="/app" element={<h1>Safe app target</h1>} />
        </Routes>
      </AtlasProvider>
    </MemoryRouter>,
  );

  expect(await screen.findByRole('heading', { name: 'Sign in to ATLAS' })).toBeInTheDocument();
  expect(screen.queryByText('example.org')).not.toBeInTheDocument();
});
