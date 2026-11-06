import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('../../apps/web/src/lib/atlasSession', () => ({
  getAtlasAccessToken: vi.fn(() => ''),
  getActiveAtlasOrganization: vi.fn(),
  clearAtlasSession: vi.fn()
}));

import {
  clearAtlasSession,
  getActiveAtlasOrganization,
  getAtlasAccessToken
} from '../../apps/web/src/lib/atlasSession';
import { RequireAtlasIdentity } from '../../apps/web/src/identity/RequireAtlasIdentity';

const token = vi.mocked(getAtlasAccessToken);
const organization = vi.mocked(getActiveAtlasOrganization);
const clear = vi.mocked(clearAtlasSession);

function RestrictedGpsHarness() {
  return (
    <MemoryRouter initialEntries={['/gps?lat=48.8566&lon=2.3522']}>
      <Routes>
        <Route
          path="/gps"
          element={<RequireAtlasIdentity><div data-testid="protected-gps">GPS workspace</div></RequireAtlasIdentity>}
        />
        <Route path="/identity" element={<div data-testid="identity">Sign in required</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  token.mockReturnValue('');
  organization.mockReset();
  clear.mockReset();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ATLAS Earth GPS identity boundary — isolated contract, not production auth E2E', () => {
  it('preserves the existing identity gate on the real application route', () => {
    const app = readFileSync('apps/web/src/App.tsx', 'utf8');
    expect(app).toContain('<Route path="/gps" element={<RequireAtlasIdentity><Gps4DPage /></RequireAtlasIdentity>} />');
  });

  it('rejects an unauthenticated shared map URL before opening the GPS workspace', async () => {
    render(<RestrictedGpsHarness />);
    expect(await screen.findByTestId('identity')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-gps')).toBeNull();
    expect(organization).not.toHaveBeenCalled();
  });

  it('allows a synthetically authorized organization only after the guard resolves', async () => {
    token.mockReturnValue('synthetic-unit-test-token');
    organization.mockResolvedValue({ id: 'test-org', role: 'member' });
    render(<RestrictedGpsHarness />);
    expect(await screen.findByTestId('protected-gps')).toBeInTheDocument();
    expect(organization).toHaveBeenCalledTimes(1);
  });

  it('rejects an authenticated token without active organization access', async () => {
    token.mockReturnValue('synthetic-unit-test-token');
    organization.mockRejectedValue(new Error('no_active_organization'));
    render(<RestrictedGpsHarness />);
    expect(await screen.findByTestId('identity')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-gps')).toBeNull();
    expect(clear).toHaveBeenCalledTimes(1);
  });
});
