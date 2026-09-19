import React from 'react';
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AtlasPortalsPage } from '../../apps/web/src/modules/galaxy/AtlasPortalsPage';

vi.mock('../../apps/web/src/lib/atlasSession', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/lib/atlasSession')>('../../apps/web/src/lib/atlasSession');
  return {
    ...actual,
    getCachedAtlasShellOrganization: () => ({ id: 'org-1', role: 'owner', name: 'ATLAS Test', legalName: null, active: true })
  };
});

const resolverSource = readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx', 'utf8');
const mainSource = readFileSync('apps/web/src/main.tsx', 'utf8');

afterEach(cleanup);

describe('ATLAS Portals routing', () => {
  it('registers the portal route behind the existing identity guard', () => {
    expect(resolverSource).toContain("pathname === '/galaxy/portals'");
    expect(resolverSource).toContain('<RequireAtlasIdentity><AtlasPortalsPage /></RequireAtlasIdentity>');
  });

  it('loads responsive portal styling from the app entrypoint', () => {
    expect(mainSource).toContain("./modules/galaxy/portals.css");
    const css = readFileSync('apps/web/src/modules/galaxy/portals.css', 'utf8');
    expect(css).toContain('@media (max-width: 720px)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain(':focus-visible');
  });

  it('navigates through a real registered portal destination', () => {
    render(
      <MemoryRouter initialEntries={['/galaxy/portals']}>
        <Routes>
          <Route path="/galaxy/portals" element={<AtlasPortalsPage />} />
          <Route path="/health" element={<h1>Health destination</h1>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Health Health Partial/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Enter Health' }));
    expect(screen.getByRole('heading', { name: 'Health destination' })).toBeInTheDocument();
  });
});
