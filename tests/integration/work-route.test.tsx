import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';
import { listWorkflows } from '../../apps/web/src/work/api';
import { workWorkflowFixtures } from '../fixtures/workSovereign';

vi.mock('../../apps/web/src/work/api', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/work/api')>('../../apps/web/src/work/api');
  return { ...actual, listWorkflows: vi.fn(), createWorkWorkflow: vi.fn() };
});

vi.mock('../../apps/web/src/lib/atlasSession', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/lib/atlasSession')>('../../apps/web/src/lib/atlasSession');
  return { ...actual, getActiveAtlasOrganization: vi.fn(async () => ({ id: 'org-1', role: 'owner' })) };
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(listWorkflows).mockResolvedValue([...workWorkflowFixtures] as any);
});

describe('ATLAS Work routes', () => {
  it('exposes first-level Work navigation and the authenticated command center', async () => {
    localStorage.setItem('atlas_access_token', 'test-token');
    render(<MemoryRouter initialEntries={['/work']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Work Command Center' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Work' })).toHaveAttribute('href', '/work');
    expect(await screen.findByText('Awaiting approval')).toBeInTheDocument();
  });

  it.each([
    ['/work/active', 'Active Work', 'Now'],
    ['/work/approvals', 'Approvals', 'Awaiting Approval'],
    ['/work/history', 'History', 'Completed']
  ])('renders the canonical filtered view at %s', async (path, heading, visibleStatus) => {
    localStorage.setItem('atlas_access_token', 'test-token');
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect((await screen.findAllByText(visibleStatus)).length).toBeGreaterThan(0);
  });

  it('redirects unauthenticated Work access through the existing identity boundary', async () => {
    render(<MemoryRouter initialEntries={['/work']}><App /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'ATLAS Identity' })).toBeInTheDocument());
  });
});
