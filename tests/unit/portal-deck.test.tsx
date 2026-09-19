import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AtlasPortalDeck } from '../../apps/web/src/modules/galaxy/AtlasPortalDeck';
import type { PortalDestination } from '../../apps/web/src/modules/galaxy/portalModel';

const destinations: PortalDestination[] = [
  {
    id: 'finance',
    label: 'Finance',
    title: 'Finance',
    area: 'Finance',
    route: '/finance',
    readiness: 'implemented',
    status: 'active',
    statusLabel: 'Implemented',
    description: 'Governed finance operations.',
    navigable: true
  },
  {
    id: 'health',
    label: 'Health',
    title: 'ATLAS Health',
    area: 'Health',
    route: '/health',
    readiness: 'partial',
    status: 'partial',
    statusLabel: 'Partial',
    description: 'Research and wellbeing tooling.',
    navigable: true
  },
  {
    id: 'crm',
    label: 'CRM',
    title: 'CRM',
    area: 'Business',
    route: '/crm',
    readiness: 'external-gated',
    status: 'blocked',
    statusLabel: 'Identity required',
    description: 'Organization-scoped CRM.',
    navigable: false
  }
];

afterEach(cleanup);

describe('AtlasPortalDeck', () => {
  it('filters portals by area and keeps aria-pressed state visible', () => {
    render(<AtlasPortalDeck destinations={destinations} onEnter={() => {}} />);
    const healthFilter = screen.getByRole('button', { name: 'Health' });
    fireEvent.click(healthFilter);
    expect(healthFilter).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Health Health Partial/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Finance Finance Implemented/ })).not.toBeInTheDocument();
  });

  it('searches portal destinations', () => {
    render(<AtlasPortalDeck destinations={destinations} onEnter={() => {}} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search portals' }), { target: { value: 'research' } });
    expect(screen.getByRole('button', { name: /Health Health Partial/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Finance Finance Implemented/ })).not.toBeInTheDocument();
  });

  it('enters the selected registered destination', () => {
    const onEnter = vi.fn();
    render(<AtlasPortalDeck destinations={destinations} onEnter={onEnter} />);
    fireEvent.click(screen.getByRole('button', { name: /Health Health Partial/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Enter Health' }));
    expect(onEnter).toHaveBeenCalledWith(expect.objectContaining({ id: 'health', route: '/health' }));
  });

  it('keeps blocked destinations disabled', () => {
    render(<AtlasPortalDeck destinations={destinations} onEnter={() => {}} />);
    expect(screen.getByRole('button', { name: /CRM Business Identity required/ })).toBeDisabled();
  });
});
