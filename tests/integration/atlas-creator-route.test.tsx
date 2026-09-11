import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../apps/web/src/lib/atlasSession', () => ({
  generateCreatorAsset: vi.fn(async () => ({
    ok: false,
    providerId: 'flux-schnell-local',
    state: 'configuration-required',
    message: 'ATLAS_FLUX_LOCAL_URL is not configured. No paid fallback was attempted.'
  })),
  getCreatorProviderReadiness: vi.fn(async () => ({
    ok: true,
    providerId: 'flux-schnell-local',
    state: 'ready',
    message: 'Self-hosted FLUX runtime verified.',
    zeroCostMode: true
  }))
}));

import { generateCreatorAsset, getCreatorProviderReadiness } from '../../apps/web/src/lib/atlasSession';
import { CreatorHome, CreatorProviders, CreatorWorkspace } from '../../apps/web/src/modules/creator/CreatorStudioPage';

describe('ATLAS Creator', () => {
  it('exposes working creator destinations and zero-cost mode', () => {
    render(<MemoryRouter><CreatorHome /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Create beyond the prompt.' })).toBeInTheDocument();
    expect(screen.getByText('Zero-Cost Mode')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Image Lab/ })).toHaveAttribute('href', '/studio/create?type=image');
    expect(screen.getByRole('link', { name: /Voice & Agents/ })).toHaveAttribute('href', '/studio/voice');
  });

  it('does not present generation as live without provider configuration', () => {
    render(<MemoryRouter><CreatorWorkspace /></MemoryRouter>);
    expect(screen.getByText('Not configured')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate image' })).toBeDisabled();
  });

  it('submits a real zero-cost generation request instead of a static notice', async () => {
    render(<MemoryRouter><CreatorWorkspace /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Creative brief'), { target: { value: 'Create an ATLAS payroll campaign visual' } });
    const button = screen.getByRole('button', { name: 'Generate image' });
    expect(button).toBeEnabled();
    fireEvent.click(button);

    await waitFor(() => expect(generateCreatorAsset).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'image',
      prompt: 'Create an ATLAS payroll campaign visual',
      visibility: 'Private'
    })));
    expect(await screen.findByRole('status')).toHaveTextContent('ATLAS_FLUX_LOCAL_URL is not configured');
  });

  it('loads real zero-cost provider readiness and privacy boundaries', async () => {
    render(<MemoryRouter><CreatorProviders /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'FLUX.1 Schnell (Local)' })).toBeInTheDocument();
    expect(screen.getByText('zero cost')).toBeInTheDocument();
    expect(screen.getByText(/self-hosted image generation/i)).toBeInTheDocument();
    await waitFor(() => expect(getCreatorProviderReadiness).toHaveBeenCalled());
    expect(await screen.findByText('ready')).toBeInTheDocument();
    expect(screen.getByText(/must never be used as silent tracking/i)).toBeInTheDocument();
  });
});
