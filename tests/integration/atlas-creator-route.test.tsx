import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as creatorApi from '../../apps/web/src/lib/creatorApi';
import { CreatorHome, CreatorProviders, CreatorWorkspace } from '../../apps/web/src/modules/creator/CreatorStudioPage';

describe('ATLAS Creator', () => {
  beforeEach(() => {
    // Synchronous interaction contracts do not depend on server readiness.
    // Keep mount-time requests pending unless a test explicitly supplies data,
    // preventing background React updates from escaping the test lifecycle.
    vi.spyOn(creatorApi, 'getCreatorReadiness').mockImplementation(() => new Promise(() => {}));
    vi.spyOn(creatorApi, 'getNativeCreatorReadiness').mockImplementation(() => new Promise(() => {}));
    vi.spyOn(creatorApi, 'listCreatorProviders').mockImplementation(() => new Promise(() => {}));
    vi.spyOn(creatorApi, 'listCreativeEngines').mockImplementation(() => new Promise(() => {}));
  });

  afterEach(() => vi.restoreAllMocks());

  it('exposes a shared ASTRA-derived Studio home without replacing working creator routes', () => {
    render(<MemoryRouter><CreatorHome /></MemoryRouter>);
    expect(document.querySelector('.module-experience-page')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Create beyond the prompt.' })).toBeInTheDocument();
    expect(screen.getByText('One governed creative operating system for content, media, voice and provider-aware execution.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Image Lab/ })).toHaveAttribute('href', '/studio/create?type=image');
    expect(screen.getByRole('link', { name: /Voice & Agents/ })).toHaveAttribute('href', '/studio/voice');
    expect(screen.getByRole('link', { name: /Creator Library/ })).toHaveAttribute('href', '/studio/library');
    expect(screen.getByRole('link', { name: /Provider readiness/ })).toHaveAttribute('href', '/studio/providers');
    expect(screen.getByText(/external generation remains unavailable until verified provider readiness/i)).toBeInTheDocument();
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
    vi.mocked(creatorApi.listCreatorProviders).mockResolvedValue([
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
    vi.mocked(creatorApi.listCreatorProviders).mockResolvedValue([
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

  it('offers prompt export without pretending that image generation is live', async () => {
    vi.mocked(creatorApi.listCreativeEngines).mockResolvedValue([{
      engineId: 'prompt-export',
      displayName: 'Prompt Export',
      executionClass: 'prompt-export-only',
      connectionState: 'ready',
      ready: true,
      mediaKinds: ['image', 'video', 'music', 'voice', 'sfx', 'graphic', 'template'],
      capabilityNotes: ['planning-only', 'no-media-generation'],
      lastVerifiedAt: null
    }]);
    vi.spyOn(creatorApi, 'exportCreatorPrompt').mockResolvedValue({
      status: 'prompt-ready',
      engineId: 'prompt-export',
      mediaKind: 'image',
      prompt: 'MEDIA: image\nOBJECTIVE: Futuristic ATLAS finance hero image',
      parameters: { language: 'English', negativeConstraints: [] },
      adaptationNotes: ['No media was generated.']
    });

    render(<MemoryRouter initialEntries={['/studio/create?type=image']}><CreatorWorkspace /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Creative brief'), {
      target: { value: 'Futuristic ATLAS finance hero image' }
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Export prompt package' }));

    expect(await screen.findByText(/MEDIA: image/)).toBeInTheDocument();
    expect(screen.getByText(/No media was generated/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate image' })).toBeDisabled();
  });

  it('shows prompt export and verified native readiness as distinct engine classes', async () => {
    vi.mocked(creatorApi.listCreativeEngines).mockResolvedValue([
      {
        engineId: 'prompt-export',
        displayName: 'Prompt Export',
        executionClass: 'prompt-export-only',
        connectionState: 'ready',
        ready: true,
        mediaKinds: ['image'],
        capabilityNotes: ['planning-only'],
        lastVerifiedAt: null
      },
      {
        engineId: 'atlas-native',
        displayName: 'ATLAS Native',
        executionClass: 'self-hosted',
        connectionState: 'ready',
        ready: true,
        mediaKinds: ['video'],
        capabilityNotes: ['motion-composition-v1'],
        lastVerifiedAt: '2026-09-15T12:00:00Z'
      }
    ]);

    render(<MemoryRouter><CreatorProviders /></MemoryRouter>);
    expect(await screen.findByText('Prompt Export')).toBeInTheDocument();
    expect(screen.getByText('prompt-export-only')).toBeInTheDocument();
    expect(screen.getByText('ATLAS Native')).toBeInTheDocument();
    expect(screen.getByText('self-hosted')).toBeInTheDocument();
  });

  it('reports an unconfigured external engine without inventing readiness', async () => {
    vi.mocked(creatorApi.listCreativeEngines).mockResolvedValue([{
      engineId: 'provider:seedance',
      displayName: 'Seedance',
      executionClass: 'byo-provider',
      connectionState: 'unconfigured',
      ready: false,
      mediaKinds: ['video'],
      capabilityNotes: [],
      lastVerifiedAt: null
    }]);

    render(<MemoryRouter><CreatorProviders /></MemoryRouter>);
    expect(await screen.findByText('unconfigured')).toBeInTheDocument();
    expect(screen.getByText(/Never verified/)).toBeInTheDocument();
    expect(screen.getByText(/Local, self-hosted and external engines are shown ready only after their real readiness checks succeed/i)).toBeInTheDocument();
  });

  it('exposes the seven unified creative media modes', async () => {
    vi.mocked(creatorApi.listCreativeEngines).mockResolvedValue([]);
    render(<MemoryRouter initialEntries={['/studio/create?type=image']}><CreatorWorkspace /></MemoryRouter>);
    for (const label of ['image', 'video', 'music', 'voice', 'sfx', 'graphic', 'template']) {
      expect(await screen.findByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  it('builds a provider-neutral SFX CreativePlan with accessibility metadata', async () => {
    vi.mocked(creatorApi.listCreativeEngines).mockResolvedValue([{
      engineId: 'prompt-export',
      displayName: 'Prompt Export',
      executionClass: 'prompt-export-only',
      connectionState: 'ready',
      ready: true,
      mediaKinds: ['image', 'video', 'music', 'voice', 'sfx', 'graphic', 'template'],
      capabilityNotes: ['planning-only'],
      lastVerifiedAt: null
    }]);

    render(<MemoryRouter initialEntries={['/studio/create?type=sfx']}><CreatorWorkspace /></MemoryRouter>);

    expect(await screen.findByRole('tab', { name: 'sfx' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Require captions')).toBeInTheDocument();
    expect(screen.getByLabelText('Require transcript')).toBeInTheDocument();
    expect(screen.getByLabelText('Require alt text')).toBeInTheDocument();
    expect(screen.getByLabelText('Require audio description')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Creative brief'), {
      target: { value: 'Create a precise futuristic interface confirmation sound for ATLAS.' }
    });
    fireEvent.change(screen.getByLabelText('Audience'), { target: { value: 'ATLAS users' } });
    fireEvent.change(screen.getByLabelText('Destination'), { target: { value: 'Product UI' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create plan' }));

    expect(await screen.findByRole('heading', { name: 'Creative plan' })).toBeInTheDocument();
    expect(screen.getByText('SFX deliverable')).toBeInTheDocument();
    expect(screen.getByText(/SOUND EFFECT/)).toBeInTheDocument();
    expect(screen.getAllByText(/Prompt Export/).length).toBeGreaterThan(0);
  });

  it('persists a CreativePlan with optimistic versioning', async () => {
    vi.mocked(creatorApi.listCreativeEngines).mockResolvedValue([{
      engineId: 'prompt-export',
      displayName: 'Prompt Export',
      executionClass: 'prompt-export-only',
      connectionState: 'ready',
      ready: true,
      mediaKinds: ['image', 'video', 'music', 'voice', 'sfx', 'graphic', 'template'],
      capabilityNotes: ['planning-only'],
      lastVerifiedAt: null
    }]);
    const saveSpy = vi.spyOn(creatorApi, 'saveCreativePlan').mockImplementation(async (plan, expectedVersion) => ({
      ...plan,
      organizationId: 'org-1',
      createdByUserId: 'user-1',
      version: expectedVersion + 1
    }));

    render(<MemoryRouter initialEntries={['/studio/create?type=graphic']}><CreatorWorkspace /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Creative brief'), {
      target: { value: 'Create a reusable ATLAS finance announcement graphic for social channels.' }
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Create plan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }));

    expect(await screen.findByText('Plan saved · version 1')).toBeInTheDocument();
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0][1]).toBe(0);
  });

});
