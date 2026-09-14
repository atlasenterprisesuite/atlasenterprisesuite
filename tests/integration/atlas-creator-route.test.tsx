import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as creatorApi from '../../apps/web/src/lib/creatorApi';
import { CreatorHome, CreatorProviders, CreatorWorkspace } from '../../apps/web/src/modules/creator/CreatorStudioPage';

describe('ATLAS Creator', () => {
  afterEach(() => vi.restoreAllMocks());
  it('exposes working creator destinations', () => {
    render(<MemoryRouter><CreatorHome /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Create beyond the prompt.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Image Lab/ })).toHaveAttribute('href', '/studio/create?type=image');
    expect(screen.getByRole('link', { name: /Voice & Agents/ })).toHaveAttribute('href', '/studio/voice');
  });
  it('opens ATLAS Director for the video Creator route', () => {
    render(
      <MemoryRouter initialEntries={['/studio/create?type=video']}>
        <CreatorWorkspace />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: 'ATLAS Director' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Production steps' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Review & Generate$/ })).toBeInTheDocument();
  });
  it('exposes accessible Director navigation and creative brief controls', () => {
    render(<MemoryRouter initialEntries={['/studio/create?type=video']}><CreatorWorkspace /></MemoryRouter>);
    expect(screen.getByRole('navigation', { name: 'Production steps' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    expect(screen.getByLabelText('Creative brief')).toHaveAccessibleName('Creative brief');
  });

  it('keeps the creative brief while moving between steps', () => {
    render(<MemoryRouter initialEntries={['/studio/create?type=video']}><CreatorWorkspace /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Creative brief'), {
      target: { value: 'ATLAS payroll cinematic launch' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Creative brief')).toHaveValue('ATLAS payroll cinematic launch');
  });

  it('adds and reorders shots with accessible controls', () => {
    render(<MemoryRouter initialEntries={['/studio/create?type=video']}><CreatorWorkspace /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Stages & Shots$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add scene' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add shot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add shot' }));
    const cardsBefore = screen.getAllByTestId('director-shot-card');
    expect(within(cardsBefore[0]).getByText('Shot 1')).toBeInTheDocument();
    expect(within(cardsBefore[1]).getByText('Shot 2')).toBeInTheDocument();
    fireEvent.click(within(cardsBefore[1]).getByRole('button', { name: 'Move shot up' }));
    const cardsAfter = screen.getAllByTestId('director-shot-card');
    expect(within(cardsAfter[0]).getByText('Shot 1')).toBeInTheDocument();
    expect(cardsAfter[0]).not.toBe(cardsBefore[0]);
  });

  it('shows an unconfigured provider without inventing cost or readiness', async () => {
    vi.spyOn(creatorApi, 'listCreatorProviders').mockResolvedValue([
      {
        providerId: 'seedance', displayName: 'Seedance',
        connectionState: 'unconfigured', capability: null,
        estimatedCost: null, lastVerifiedAt: null
      }
    ]);
    render(<MemoryRouter initialEntries={['/studio/create?type=video']}><CreatorWorkspace /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Provider & Cost$/ }));
    expect(await screen.findByText('unconfigured')).toBeInTheDocument();
    expect(screen.getByText('Cost estimate unavailable until provider configuration is verified.')).toBeInTheDocument();
  });

  it('keeps external generation disabled in review for an unconfigured provider', async () => {
    vi.spyOn(creatorApi, 'listCreatorProviders').mockResolvedValue([
      {
        providerId: 'seedance', displayName: 'Seedance',
        connectionState: 'unconfigured', capability: null,
        estimatedCost: null, lastVerifiedAt: null
      }
    ]);
    render(<MemoryRouter initialEntries={['/studio/create?type=video']}><CreatorWorkspace /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Provider & Cost$/ }));
    await screen.findByText('unconfigured');
    fireEvent.click(screen.getByRole('button', { name: 'Seedance' }));
    fireEvent.click(screen.getByRole('button', { name: /Review & Generate$/ }));
    expect(screen.getByRole('button', { name: 'Generate with verified external provider' })).toBeDisabled();
  });

  it('does not present generation as live without provider configuration', () => {
    render(<MemoryRouter><CreatorWorkspace /></MemoryRouter>);
    expect(screen.getByText('Not configured')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate image' })).toBeDisabled();
  });
  it('reports truthful provider readiness and privacy boundaries', async () => {
    vi.spyOn(creatorApi, 'listCreatorProviders').mockResolvedValue([
      {
        providerId: 'seedance', displayName: 'Seedance', connectionState: 'unconfigured',
        capability: null, estimatedCost: null, lastVerifiedAt: null
      }
    ]);
    render(<MemoryRouter><CreatorProviders /></MemoryRouter>);
    expect(await screen.findByText('unconfigured')).toBeInTheDocument();
    expect(screen.getByText(/Never verified/)).toBeInTheDocument();
    expect(screen.getByText(/must never be used as silent tracking/i)).toBeInTheDocument();
  });
});
