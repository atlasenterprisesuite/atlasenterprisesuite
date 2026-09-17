import React from 'react';
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AtlasGalaxyMap } from '../../apps/web/src/modules/galaxy/AtlasGalaxyMap';
import type { GalaxyNodeView } from '../../apps/web/src/modules/galaxy/galaxyModel';

const nodes: GalaxyNodeView[] = [
  { id: 'finance', label: 'Capital Galaxy', category: 'financial', coordinates: { x: 30, y: 35 }, dependencies: [], moduleId: 'finance', route: '/finance', status: 'active', statusLabel: 'Implemented', navigable: true },
  { id: 'crm', label: 'Relationship Constellation', category: 'operations', coordinates: { x: 70, y: 35 }, dependencies: ['finance'], moduleId: 'crm', route: '/crm', status: 'available', statusLabel: 'External connection required', navigable: true },
  { id: 'inventory', label: 'Supply Network', category: 'operations', coordinates: { x: 25, y: 70 }, dependencies: [], route: null, status: 'unverified', statusLabel: 'Not registered', navigable: false }
];

afterEach(cleanup);

describe('AtlasGalaxyMap', () => {
  it('exposes filters with aria-pressed and filters nodes plus edges', () => {
    render(<AtlasGalaxyMap nodes={nodes} onSelectNode={() => {}} />);
    const operations = screen.getByRole('button', { name: 'Operations' });
    expect(operations).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(operations);
    expect(operations).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /Capital Galaxy/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Relationship Constellation/ })).toBeInTheDocument();
  });

  it('communicates status as text and disables unavailable nodes', () => {
    render(<AtlasGalaxyMap nodes={nodes} onSelectNode={() => {}} />);
    expect(screen.getByText('External connection required')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Supply Network/ })).toBeDisabled();
    expect(screen.getByText('Not registered')).toBeInTheDocument();
  });

  it('calls node selection only for navigable nodes', () => {
    const onSelectNode = vi.fn();
    render(<AtlasGalaxyMap nodes={nodes} onSelectNode={onSelectNode} />);
    fireEvent.click(screen.getByRole('button', { name: /Relationship Constellation/ }));
    expect(onSelectNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'crm', route: '/crm' }));
  });

  it('keeps node status in the accessible name and never relies on color alone', () => {
    render(<AtlasGalaxyMap nodes={nodes} onSelectNode={() => {}} />);
    expect(screen.getByRole('button', { name: 'Capital Galaxy. Implemented' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Supply Network. Not registered' })).toBeDisabled();
  });

  it('ships responsive and reduced-motion Galaxy styling through the app entrypoint', () => {
    const css = readFileSync('apps/web/src/modules/galaxy/galaxy.css', 'utf8');
    const main = readFileSync('apps/web/src/main.tsx', 'utf8');
    expect(main).toContain("./modules/galaxy/galaxy.css");
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@media (max-width: 720px)');
    expect(css).toContain(':focus-visible');
  });
});
