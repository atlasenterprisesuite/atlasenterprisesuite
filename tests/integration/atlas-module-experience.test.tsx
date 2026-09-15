import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';
import { ModuleExperiencePage } from '../../apps/web/src/components/ModuleExperiencePage';

vi.mock('../../apps/web/src/lib/atlasSession', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/lib/atlasSession')>('../../apps/web/src/lib/atlasSession');
  return {
    ...actual,
    getActiveAtlasOrganization: vi.fn(async () => ({ id: 'org-1', role: 'owner' })),
    getCachedAtlasShellOrganization: vi.fn(() => ({ id: 'org-1', name: 'ATLAS Test Org', legalName: 'ATLAS Test Org LLC', role: 'owner' }))
  };
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('atlas_access_token', 'test-token');
});

describe('ATLAS ASTRA-derived module experience', () => {
  it('renders active destinations as links and gated capabilities as disabled cards', () => {
    render(
      <MemoryRouter>
        <ModuleExperiencePage
          eyebrow="ATLAS Test"
          title="Sovereign Test Module"
          description="A governed test surface."
          sections={[
            {
              eyebrow: 'Architecture',
              title: 'Core capabilities',
              description: 'Truthful capability presentation.',
              cards: [
                { label: 'Live route', title: 'Working capability', description: 'Available now.', to: '/working' },
                { label: 'Gated', title: 'Provider required', description: 'Requires authorization.', status: 'External authorization required' }
              ]
            }
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Sovereign Test Module' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /working capability/i })).toHaveAttribute('href', '/working');
    expect(screen.queryByRole('link', { name: /provider required/i })).not.toBeInTheDocument();
    expect(screen.getByText('Provider required').closest('[aria-disabled="true"]')).toBeTruthy();
  });

  it.each([
    ['/', 'ATLAS Enterprise Suite', 'One governed enterprise ecosystem'],
    ['/finance', 'ATLAS Finance', 'Finance intelligence, execution and control'],
    ['/finance/accounting', 'ATLAS Accounting', 'Accounting intelligence with governed execution']
  ])('applies the module experience at %s while preserving implemented destinations', (path, eyebrow, heading) => {
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
    const main = screen.getByRole('main');
    expect(within(main).getByText(eyebrow)).toBeInTheDocument();
    expect(within(main).getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('keeps Finance operational routes reachable from the new experience', () => {
    render(<MemoryRouter initialEntries={['/finance']}><App /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /accounts payable/i })).toHaveAttribute('href', '/finance/accounting/accounts-payable');
    expect(screen.getByRole('link', { name: /automotive sales/i })).toHaveAttribute('href', '/finance/accounting/reports/automotive-sales');
  });
});
