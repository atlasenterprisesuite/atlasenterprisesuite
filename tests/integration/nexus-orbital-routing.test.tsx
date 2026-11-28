import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NexusOrbitalRuntime } from '../../apps/web/src/modules/galaxy/NexusOrbitalRuntime';
import { buildGalaxyNodes } from '../../apps/web/src/modules/galaxy/galaxyModel';

function Workspace() {
  const navigate = useNavigate();
  return <NexusOrbitalRuntime nodes={buildGalaxyNodes({ hasIdentity: true })} onOpen={node => {
    if (node.navigable && node.route) navigate(node.route);
  }} />;
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('NEXUS orbital navigation when rendering is unavailable', () => {
  it('preserves navigable module actions and opens the registered CRM route', () => {
    render(<MemoryRouter initialEntries={['/galaxy']}><Routes>
      <Route path="/galaxy" element={<Workspace />} />
      <Route path="/crm" element={<h1>CRM destination</h1>} />
    </Routes></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('Orbital rendering unavailable');
    expect(screen.getByRole('button', { name: 'Play orbit' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Select orbit crm' }));
    expect(screen.getByRole('button', { name: 'Select orbit crm' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Open selected module' }));
    expect(screen.getByRole('heading', { name: 'CRM destination' })).toBeInTheDocument();
  });

  it('does not invoke navigation for a blocked module', () => {
    const open = vi.fn();
    render(<NexusOrbitalRuntime nodes={buildGalaxyNodes({ hasIdentity: false })} onOpen={open} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select orbit crm' }));
    const button = screen.getByRole('button', { name: 'Open selected module' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(open).not.toHaveBeenCalled();
  });
});
