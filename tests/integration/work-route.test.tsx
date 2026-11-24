import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';
import { listWorkConnections, listWorkRuntimes, listWorkflows } from '../../apps/web/src/work/api';
import { workWorkflowFixtures } from '../fixtures/workSovereign';

vi.mock('../../apps/web/src/work/api', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/work/api')>('../../apps/web/src/work/api');
  return {
    ...actual,
    listWorkflows: vi.fn(),
    listWorkConnections: vi.fn(),
    listWorkRuntimes: vi.fn(),
    createWorkWorkflow: vi.fn()
  };
});

vi.mock('../../apps/web/src/lib/atlasSession', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/lib/atlasSession')>('../../apps/web/src/lib/atlasSession');
  return { ...actual, getActiveAtlasOrganization: vi.fn(async () => ({ id: 'org-1', role: 'owner' })) };
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(listWorkflows).mockResolvedValue([...workWorkflowFixtures] as any);
  vi.mocked(listWorkConnections).mockResolvedValue([{
    id: 'conn-1',
    provider: 'cloudflare',
    mechanism: 'oauth',
    status: 'active',
    capabilities: ['dns.read']
  }]);
  vi.mocked(listWorkRuntimes).mockResolvedValue([{
    id: 'runtime-1',
    kind: 'local',
    label: 'ATLAS Local',
    status: 'online',
    capabilities: ['browser'],
    lastSeenAt: new Date().toISOString()
  }]);
});

describe('ATLAS Work routes', () => {
  it('exposes first-level Work navigation and the authenticated command center', async () => {
    localStorage.setItem('atlas_access_token', 'test-token');
    render(<MemoryRouter initialEntries={['/work']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Work Command Center' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Work' })).toHaveAttribute('href', '/work');
    expect(await screen.findByText('Awaiting approval')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Needs attention' })).toBeInTheDocument();

    const controlPlaneHeading = await screen.findByRole('heading', { name: 'Control plane' });
    const controlPlane = controlPlaneHeading.closest('section');
    expect(controlPlane).not.toBeNull();
    const control = within(controlPlane as HTMLElement);
    expect(control.getByText('1 active of 1')).toBeInTheDocument();
    expect(control.getByText('1 healthy of 1')).toBeInTheDocument();
    expect(control.getByText('1 verified')).toBeInTheDocument();
  });

  it('keeps canonical workflow state visible when a capability snapshot is unavailable', async () => {
    vi.mocked(listWorkConnections).mockRejectedValueOnce(new Error('connections_unavailable'));
    localStorage.setItem('atlas_access_token', 'test-token');
    render(<MemoryRouter initialEntries={['/work']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Work Command Center' })).toBeInTheDocument();
    expect(await screen.findByText(/Live capability snapshot incomplete: connections_unavailable/)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Needs attention' })).toBeInTheDocument();

    const controlPlaneHeading = await screen.findByRole('heading', { name: 'Control plane' });
    const controlPlane = controlPlaneHeading.closest('section');
    expect(controlPlane).not.toBeNull();
    expect(within(controlPlane as HTMLElement).getByText('Unavailable')).toBeInTheDocument();
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


describe('ATLAS enterprise department routes', () => {
  it('shows all ten departments and canonical workflow links', async () => {
    localStorage.setItem('atlas_access_token', 'test-token');
    render(<MemoryRouter initialEntries={['/work/departments']}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Enterprise departments' })).toBeInTheDocument();
    const finance = (await screen.findByRole('heading', { name: 'Finance and accounting' })).closest('section')!;
    expect(within(finance).getByRole('link', { name: 'Create department work' })).toHaveAttribute('href', '/work/new?ownerModule=accounting');
    expect(within(finance).getByRole('link', { name: 'Approval queue' })).toHaveAttribute('href', '/work/approvals');
    expect(finance.querySelector('a[href="/execution/wf-completed"]')).not.toBeNull();
    expect(screen.getAllByRole('link', { name: 'Create department work' })).toHaveLength(10);
    expect(await screen.findByRole('heading', { name: 'Unassigned workflows' })).toBeInTheDocument();
  });

  it('does not expose the department screen without identity', async () => {
    render(<MemoryRouter initialEntries={['/work/departments']}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'ATLAS Identity' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Enterprise departments' })).not.toBeInTheDocument();
    expect(listWorkflows).not.toHaveBeenCalled();
  });

  it('fails closed on workflow retrieval errors rather than rendering false zero activity', async () => {
    vi.mocked(listWorkflows).mockRejectedValueOnce(new Error('access_denied'));
    localStorage.setItem('atlas_access_token', 'test-token');
    render(<MemoryRouter initialEntries={['/work/departments']}><App /></MemoryRouter>);
    expect(await screen.findByText('Department activity unavailable: access_denied')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Finance and accounting' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Create department work' })).not.toBeInTheDocument();
  });
});
