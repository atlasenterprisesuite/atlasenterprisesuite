import React from 'react';
import { render, screen } from '@testing-library/react';
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
    ['/', 'One governed enterprise ecosystem'],
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
});
