import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';

vi.mock('../../apps/web/src/lib/atlasSession', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/lib/atlasSession')>('../../apps/web/src/lib/atlasSession');
  return { ...actual, getActiveAtlasOrganization: vi.fn(async () => ({ id: 'org-1', role: 'owner' })) };
});

beforeEach(() => {
  localStorage.clear();
});

describe('Guided Execution adjacent route regression', () => {
  it.each([
    ['/', 'One intelligent platform. Your world, connected.'],
    ['/platform', 'One governed enterprise ecosystem'],
    ['/finance', 'Finance'],
    ['/finance/accounting/accounts-payable', 'Accounts Payable'],
    ['/health', 'Health']
  ])('preserves %s', (path, heading) => {
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('preserves the protected ATLAS Studio route', async () => {
    localStorage.setItem('atlas_access_token', 'test-token');
    render(<MemoryRouter initialEntries={['/studio']}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Create beyond the prompt.' })).toBeInTheDocument();
  });
  it('links public homepage actions to real platform and identity routes', () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    const main = screen.getByRole('main');
    expect(main).toHaveClass('public-home');
    expect(screen.getByRole('link', { name: 'Explore the platform' })).toHaveAttribute('href', '/platform');
    expect(screen.getByRole('link', { name: 'Enter ATLAS' })).toHaveAttribute('href', '/platform');
    expect(screen.getAllByRole('link', { name: 'Sign in' }).some(link => link.getAttribute('href') === '/identity')).toBe(true);
  });

  it('keeps the existing enterprise shell and live module links at /platform', () => {
    render(<MemoryRouter initialEntries={['/platform']}><App /></MemoryRouter>);
    const main = screen.getByRole('main');
    expect(main).toHaveTextContent('Finance, Payroll and Health share one shell');
    expect(main.querySelector('.public-home')).toBeNull();
    expect(within(main).getByRole('link', { name: /business suite/i })).toHaveAttribute('href', '/business');
  });

});
