import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const backend = vi.hoisted(() => ({
  getActiveAtlasOrganization: vi.fn(async () => ({ id: 'tenant-A', role: 'owner' })),
  atlasAuthorizedJson: vi.fn(async (path: string) => {
    if (path.includes('api=deployments')) return {
      ok: true, deployments: [{ id: 'deploy-1', status: 'awaiting_gates', environment: 'production' }]
    };
    if (path.includes('api=deployment&')) return {
      ok: true, deployment: { id: 'deploy-1', status: 'awaiting_gates', environment: 'production' },
      gates: [{ id: 'gate-1', gate_key: 'exact-sha-runtime', status: 'pending', required: true }]
    };
    if (path.includes('atlas-infra-status')) return {
      scope: { organization_id: 'tenant-A' },
      canonical_repository: 'atlasenterprisesuite/atlasenterprisesuite',
      production_readiness: 'ready',
      provider_requirements: { github: false, supabase: true, cloudflare: true, production: true, vercel: false },
      provider_status: {
        github: { state: 'ready', required: false },
        supabase: { state: 'ready', required: true },
        cloudflare: { state: 'ready', required: true },
        production: { state: 'ready', required: true },
        vercel: { state: 'failed', required: false }
      },
      blockers: [],
      evidence: { generated_at: new Date().toISOString() }
    };
    return { ok: true, releases: [{ id: 'release-1', release_key: 'atlas-web', status: 'promoted',
      channel: 'production', version: 'v1', source_ref: 'a'.repeat(40), updated_at: '2026-11-26T12:00:00Z' }] };
  })
}));
vi.mock('../../apps/web/src/lib/atlasSession', () => backend);

import { AtlasSovereignDeployPage } from '../../apps/web/src/modules/cloud/AtlasSovereignDeployPage';

afterEach(() => { vi.clearAllMocks(); });

describe('ATLAS Deploy native cloud console', () => {
  it('loads existing organization-scoped ATLAS infrastructure and release authorities without Vercel or deploy writes', async () => {
    render(<MemoryRouter><AtlasSovereignDeployPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'ATLAS Deploy' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Review required — not production verified/i)).toBeInTheDocument());
    expect(screen.getByText(/Vercel is not required/i)).toBeInTheDocument();
    expect(screen.getByText('atlas-web')).toBeInTheDocument();
    expect(backend.atlasAuthorizedJson).toHaveBeenCalledTimes(2);
    for (const call of backend.atlasAuthorizedJson.mock.calls) {
      expect(call[0]).toMatch(/^\/functions\/v1\/atlas-(infra-status|release-control)/);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Synchronize evidence' }));
    await waitFor(() => expect(backend.atlasAuthorizedJson).toHaveBeenCalledTimes(4));
    fireEvent.click(screen.getByRole('button', { name: 'Inspect deployment gates' }));
    expect(await screen.findByText('exact-sha-runtime')).toBeInTheDocument();
    expect(screen.getByText(/awaiting_gates/)).toBeInTheDocument();
    expect(backend.atlasAuthorizedJson).toHaveBeenCalledTimes(6);

  });

  it('blocks when identity cannot be established; cannot present synthetic data', async () => {
    backend.getActiveAtlasOrganization.mockRejectedValueOnce(new Error('authentication_required'));
    render(<MemoryRouter><AtlasSovereignDeployPage /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('authentication_required');
    expect(screen.queryByText(/Review required — not production verified/i)).not.toBeInTheDocument();
  });
});
