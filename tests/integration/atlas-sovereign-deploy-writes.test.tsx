import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const backend = vi.hoisted(() => ({
  getActiveAtlasOrganization: vi.fn(async () => ({ id: 'tenant-A', role: 'owner' })),
  atlasAuthorizedJson: vi.fn(async (path: string) => {
    if (path.endsWith('/rpc/has_identity_permission')) return true;
    if (path.includes('api=release-create')) return {
      ok: true, release_id: '11111111-1111-4111-8111-111111111111'
    };
    throw new Error('unexpected_backend_path');
  })
}));
vi.mock('../../apps/web/src/lib/atlasSession', () => backend);

import { AtlasDeployDraftComposer } from '../../apps/web/src/modules/cloud/AtlasDeployDraftComposer';

const now = Date.now();
const infra = () => ({
  scope: { organization_id: 'tenant-A' },
  canonical_repository: 'atlasenterprisesuite/atlasenterprisesuite',
  evidence: { generated_at: new Date(now - 60_000).toISOString() }
});
const props = () => ({
  organizationId: 'tenant-A',
  infra: infra(),
  now,
  onCreated: vi.fn()
});

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Release key'), { target: { value: 'atlas-deploy-777-rc1' } });
  fireEvent.change(screen.getByLabelText('Version'), { target: { value: '2026.11.26-rc1' } });
  fireEvent.change(screen.getByLabelText('Git commit SHA (40 hex)'), { target: { value: 'a'.repeat(40) } });
  fireEvent.change(screen.getByLabelText('Artifact SHA-256 (64 hex)'), { target: { value: 'b'.repeat(64) } });
}

beforeEach(() => {
  backend.getActiveAtlasOrganization.mockReset().mockImplementation(async () => ({ id: 'tenant-A', role: 'owner' }));
  backend.atlasAuthorizedJson.mockReset().mockImplementation(async (path: string) => {
    if (path.endsWith('/rpc/has_identity_permission')) return true;
    if (path.includes('api=release-create')) return {
      ok: true, release_id: '11111111-1111-4111-8111-111111111111'
    };
    throw new Error('unexpected_backend_path');
  });
});
afterEach(() => { vi.clearAllMocks(); });

describe('ATLAS Deploy permissions and authenticated draft writes', () => {
  it('checks the server-side permission and writes exactly one Cloudflare draft after explicit submit', async () => {
    const options = props();
    render(<AtlasDeployDraftComposer {...options} />);
    expect(await screen.findByRole('button', { name: 'Create release draft' })).toBeInTheDocument();
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create release draft' }));
    await waitFor(() => expect(options.onCreated).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111'));
    const writes = backend.atlasAuthorizedJson.mock.calls.filter(([path]) => path.includes('api=release-create'));
    expect(writes).toHaveLength(1);
    expect(writes[0][1]).toMatchObject({ method: 'POST', cache: 'no-store' });
    const payload = JSON.parse(writes[0][1].body);
    expect(payload.source_ref).toBe('a'.repeat(40));
    expect(payload.components[0].artifact_sha256).toBe('b'.repeat(64));
    expect(payload.components[0].provider).toBe('cloudflare');
    expect(payload.components).toHaveLength(1);
    expect(JSON.stringify(payload)).not.toContain('tenant-A');
    expect(backend.getActiveAtlasOrganization).toHaveBeenCalled();
    expect(backend.atlasAuthorizedJson.mock.calls.filter(([path]) => path.endsWith('/rpc/has_identity_permission'))).toHaveLength(2);
    expect(backend.atlasAuthorizedJson.mock.calls.every(([path]) => !/deployment-(create|promote)|release-freeze/.test(path))).toBe(true);
  });

  it('shows read-only state when organization permission is absent', async () => {
    backend.atlasAuthorizedJson.mockImplementation(async (path: string) => {
      if (path.endsWith('/rpc/has_identity_permission')) return false;
      throw new Error('write_must_not_run');
    });
    render(<AtlasDeployDraftComposer {...props()} />);
    expect(await screen.findByText(/read-only/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create release draft' })).not.toBeInTheDocument();
  });

  it('fails closed if permission is revoked between page load and submit', async () => {
    let checks = 0;
    backend.atlasAuthorizedJson.mockImplementation(async (path: string) => {
      if (path.endsWith('/rpc/has_identity_permission')) return ++checks === 1;
      throw new Error('write_must_not_run');
    });
    render(<AtlasDeployDraftComposer {...props()} />);
    await screen.findByRole('button', { name: 'Create release draft' });
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create release draft' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('permission_denied');
    expect(backend.atlasAuthorizedJson.mock.calls.filter(([path]) => path.includes('api=release-create'))).toHaveLength(0);
  });

  it('never allows writes across organizations or from stale manager snapshots', async () => {
    render(<AtlasDeployDraftComposer {...{ ...props(), organizationId: 'tenant-B' }} />);
    expect(await screen.findByText(/Scope or evidence is not current/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create release draft' })).not.toBeInTheDocument();
  });

  it('rejects invalid or placeholder checksums without calling the backend', async () => {
    render(<AtlasDeployDraftComposer {...props()} />);
    await screen.findByRole('button', { name: 'Create release draft' });
    fillValidForm();
    fireEvent.change(screen.getByLabelText('Artifact SHA-256 (64 hex)'), { target: { value: '0'.repeat(64) } });
    fireEvent.click(screen.getByRole('button', { name: 'Create release draft' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid_artifact_sha256');
    expect(backend.atlasAuthorizedJson.mock.calls.some(([path]) => path.includes('api=release-create'))).toBe(false);
  });
});
