import React from 'react';
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AtlasShell } from '../../apps/web/src/components/AtlasShell';
import { resolveAtlasIdentityTarget } from '../../apps/web/src/identity/IdentityPage';
import { AtlasGalaxyPage } from '../../apps/web/src/modules/galaxy/AtlasGalaxyPage';

vi.mock('../../apps/web/src/lib/atlasSession', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/lib/atlasSession')>('../../apps/web/src/lib/atlasSession');
  return {
    ...actual,
    getCachedAtlasShellOrganization: () => ({ id: 'org-1', role: 'owner', name: 'ATLAS Test', legalName: null, active: true })
  };
});

const resolverSource = readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx', 'utf8');

afterEach(cleanup);

describe('ATLAS Galaxy routing', () => {
  it('adds Galaxy to canonical shell navigation', () => {
    render(<MemoryRouter initialEntries={['/galaxy']}><AtlasShell><div>Galaxy body</div></AtlasShell></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Galaxy' })).toHaveAttribute('href', '/galaxy');
  });

  it('mounts /galaxy behind the existing identity guard', () => {
    expect(resolverSource).toContain("pathname === '/galaxy'");
    expect(resolverSource).toContain('<RequireAtlasIdentity>');
    expect(resolverSource).toContain('<AtlasGalaxyPage />');
  });

  it('uses Galaxy as the default authenticated landing target without taking over the public root', () => {
    expect(resolveAtlasIdentityTarget(null)).toBe('/galaxy');
    expect(resolveAtlasIdentityTarget('/')).toBe('/');
    expect(resolveAtlasIdentityTarget('/galaxy')).toBe('/galaxy');
    expect(resolveAtlasIdentityTarget('/galaxy/portals')).toBe('/galaxy/portals');
    expect(resolveAtlasIdentityTarget('/crm')).toBe('/crm');
    expect(resolveAtlasIdentityTarget('//example.com/galaxy')).toBe('/galaxy');
  });

  it('navigates the CRM constellation node to the canonical protected CRM route', () => {
    render(
      <MemoryRouter initialEntries={['/galaxy']}>
        <Routes>
          <Route path="/galaxy" element={<AtlasGalaxyPage />} />
          <Route path="/crm" element={<h1>CRM destination</h1>} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /Relationship Constellation/ }));
    expect(screen.getByRole('heading', { name: 'CRM destination' })).toBeInTheDocument();
  });

  it('does not alter the CRM protected resolver branch', () => {
    expect(resolverSource).toContain("pathname === '/crm'");
    expect(resolverSource).toContain("pathname.startsWith('/crm/')");
    expect(resolverSource).toContain('<CrmRoutes />');
  });
});
