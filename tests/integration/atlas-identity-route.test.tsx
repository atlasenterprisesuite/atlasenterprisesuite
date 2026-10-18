import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';
import { clearAtlasSession } from '../../apps/web/src/lib/atlasSession';

afterEach(() => {
  clearAtlasSession();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ATLAS Identity route', () => {
  it('renders the central identity sign-in screen instead of the route-not-found page', () => {
    render(
      <MemoryRouter initialEntries={['/identity?app=%2Ffinance%2Faccounting%2Faccounts-payable']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'ATLAS Identity' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in to ATLAS' })).toBeInTheDocument();
    expect(screen.queryByText('Route not found')).not.toBeInTheDocument();
  });

  it('authenticates with Supabase, validates active organization access, and returns to the requested ATLAS app', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'identity-token', refresh_token: 'refresh-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ org_id: 'org-1', role: 'owner', status: 'active' }]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/identity?app=%2Ffinance']}>
        <App />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'operator@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'not-a-real-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to ATLAS' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Finance' })).toBeInTheDocument());
    expect(localStorage.getItem('atlas_access_token')).toBe('identity-token');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/auth/v1/token?grant_type=password');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/rest/v1/organization_members');
  });

  it('routes unauthenticated ATLAS Voice access through Identity', () => {
    render(
      <MemoryRouter initialEntries={['/studio/voice']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'ATLAS Identity' })).toBeInTheDocument();
    expect(screen.getByText('/studio/voice')).toBeInTheDocument();
  });

  it('returns an authenticated member to ATLAS Voice Studio with truthful native capability state', async () => {
    const membership = [{ org_id: 'org-1', role: 'owner', status: 'active' }];
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/auth/v1/token')) return Promise.resolve(Response.json({ access_token: 'identity-token', refresh_token: 'refresh-token' }));
      if (url.includes('/auth/v1/user')) return Promise.resolve(Response.json({ id: 'user-1' }));
      if (url.includes('/organization_members')) return Promise.resolve(Response.json(membership));
      if (url.includes('provider=elevenlabs')) return Promise.resolve(Response.json({ state: 'provider_not_configured', configured: false, synthesis_verified: false }));
      if (url.includes('/atlas-copilot?api=status')) return Promise.resolve(Response.json({
        ok: true, authenticated: true, provider: 'none', provider_state: 'not_configured', model: null,
        storage_state: 'configured', organization: 'org-1', role: 'owner', capabilities: [], providers: []
      }));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/identity?app=%2Fstudio%2Fvoice']}>
        <App />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'operator@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'not-a-real-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to ATLAS' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Voice Studio' })).toBeInTheDocument());
    expect(screen.getByText(/Requires ATLAS iOS app/i)).toBeInTheDocument();
    await screen.findByText('ElevenLabs requires a server API key.');
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/functions/v1/atlas-copilot?api=status'))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('provider=elevenlabs'))).toBe(true);
  });

  it('rejects external return targets and keeps navigation inside ATLAS', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'identity-token', refresh_token: 'refresh-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ org_id: 'org-1', role: 'owner', status: 'active' }]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/identity?app=https%3A%2F%2Fexample.org%2Foutside']}>
        <App />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'operator@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'not-a-real-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to ATLAS' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'One governed enterprise ecosystem' })).toBeInTheDocument());
  });

  it('clears the session when authentication succeeds but no active ATLAS organization is available', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'identity-token', refresh_token: 'refresh-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/identity']}>
        <App />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'operator@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'not-a-real-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to ATLAS' }));

    await waitFor(() => expect(screen.getByText('Your account is authenticated but has no active ATLAS organization access.')).toBeInTheDocument());
    expect(localStorage.getItem('atlas_access_token')).toBeNull();
    expect(localStorage.getItem('atlas_refresh_token')).toBeNull();
  });
});
