import React from 'react';
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AutomotiveRoutes } from '../../apps/web/src/modules/automotive/AutomotiveRoutes';

const registry = readFileSync('apps/web/src/modules/registry.ts', 'utf8');
const resolver = readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx', 'utf8');

afterEach(cleanup);

describe('ATLAS Automotive Intelligence — canonical protected route', () => {
  it('is registered once as an external-gated authenticated Mobility module', () => {
    expect((registry.match(/id: 'automotive-intelligence'/g) || []).length).toBe(1);
    expect(registry).toContain("route: '/mobility/automotive'");
    expect(registry).toContain("readiness: 'external-gated'");
    expect(resolver).toContain("import { AutomotiveRoutes } from '../modules/automotive/AutomotiveRoutes';");
    expect(resolver).toContain("<RequireAtlasIdentity><AutomotiveRoutes /></RequireAtlasIdentity>");
  });

  it('starts without claiming photo identification, price feeds or a VIN', () => {
    render(<MemoryRouter initialEntries={['/mobility/automotive']}><AutomotiveRoutes /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Automotive Intelligence' })).toBeTruthy();
    expect(screen.getByText(/Visual recognition:/)).toBeTruthy();
    expect(screen.getByText(/No model identified/)).toBeTruthy();
    expect(screen.getByText(/Market pricing:/)).toBeTruthy();
    expect(screen.getByText(/No local image selected/)).toBeTruthy();
  });

  it('shows a documented manufacturer discrepancy after manual model selection', () => {
    render(<MemoryRouter initialEntries={['/mobility/automotive']}><AutomotiveRoutes /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Reference model'), { target: { value: 'mclaren-720s-spider' } });
    expect(screen.getByText('2.8 / 2.9 s')).toBeTruthy();
    expect(screen.getByText('Source conflict')).toBeTruthy();
    expect(screen.getByText(/No automated confidence score exists/)).toBeTruthy();
  });
});

describe('Automotive dossier and existing navigation handoff', () => {
  it('exports only model evidence, keeps conflicts and links to the existing GPS module', () => {
    render(<MemoryRouter initialEntries={['/mobility/automotive']}><AutomotiveRoutes /></MemoryRouter>);
    expect(screen.queryByRole('link', {name:/Download model dossier/})).toBeNull();
    expect(screen.getByRole('link', {name:'Open ATLAS GPS 4D'}).getAttribute('href')).toBe('/gps');
    fireEvent.change(screen.getByLabelText('Reference model'), { target: { value: 'mclaren-720s-spider' } });
    const link = screen.getByRole('link', {name:/Download model dossier/});
    const href = link.getAttribute('href')!;
    const d = JSON.parse(decodeURIComponent(href.slice(href.indexOf(',') + 1)));
    expect(d.photoIncluded).toBe(false);
    expect(d.claims.find((x: {key: string}) => x.key === 'zero_to_100_seconds').values).toEqual([2.8, 2.9]);
  });
});
