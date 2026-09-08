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
