import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SpatialForgeWorkspace } from '../../apps/web/src/modules/creator/SpatialForgeWorkspace';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('atlas_access_token', 'test-token');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ATLAS Spatial Forge authentic Creator UI', () => {
  it('explains the limited geometry mode before any generation', () => {
    render(<MemoryRouter><SpatialForgeWorkspace /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: '3D procedural workshop' })).toBeTruthy();
    expect(screen.getByText(/Image-to-3D, AI prompt-to-3D/)).toBeTruthy();
    expect(screen.getByRole('combobox', { name: '3D shape' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Download/ })).toBeNull();
  });

  it('requests an authenticated procedural mesh and exposes only returned OBJ', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true, file_name: 'atlas_cube.obj', mime_type: 'model/obj',
      provenance: 'atlas-procedural-preview',
      primitive: 'cube', vertex_count: 8, triangle_count: 12,
      obj_content: 'v 0 0 0\n', persisted: false, billable: false
    }), {status: 200}));
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter><SpatialForgeWorkspace /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Create OBJ preview' }));
    expect(await screen.findByRole('button', { name: 'Download atlas_cube.obj' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Not saved to Creator Library');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejects a forged neural/persisted response instead of offering a download', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true, file_name: 'unknown.obj', mime_type: 'model/obj',
      provenance: 'atlas-procedural-preview', primitive: 'cube',
      vertex_count: 8, triangle_count: 12, obj_content: 'v 0 0 0\n',
      persisted: true, billable: false
    }), {status: 200}));
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter><SpatialForgeWorkspace /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Create OBJ preview' }));
    expect(await screen.findByText(/spatial_preview_provenance_invalid/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Download/ })).toBeNull();
  });
});
