import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';
import { clearAtlasSession } from '../../apps/web/src/lib/atlasSession';
import { challengeAndVerifyAtlasTotp } from '../../apps/web/src/lib/atlasMfa';

const FACTOR = '22222222-2222-4222-8222-222222222222';
const newAal2Token = () => ['test-header', btoa(JSON.stringify({ sub: 'test-user', aal: 'aal2' })), 'test-sig'].join('.');
const oldAal1Token = () => ['test-header', btoa(JSON.stringify({ sub: 'test-user', aal: 'aal1' })), 'test-sig'].join('.');

afterEach(() => {
  clearAtlasSession();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ATLAS Identity account-owned MFA', () => {
  it('allows an authenticated account owner to enroll a TOTP factor and obtains an AAL2 session', async () => {
    localStorage.setItem('atlas_access_token', 'test-initial-session');
    localStorage.setItem('atlas_refresh_token', 'test-initial-refresh');
    const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method || 'GET';
      if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'user-one' });
      if (url.endsWith('/auth/v1/factors') && method === 'GET') return Response.json({ all: [] });
      if (url.endsWith('/auth/v1/factors') && method === 'POST') return Response.json({
        id: FACTOR,
        totp: { qr_code: '<svg xmlns="http://www.w3.org/2000/svg"></svg>', secret: 'TEST-ONLY-TOTP-KEY' }
      });
      if (url.endsWith(`/auth/v1/factors/${FACTOR}/challenge`)) return Response.json({ id: 'challenge-test' });
      if (url.endsWith(`/auth/v1/factors/${FACTOR}/verify`)) return Response.json({
        access_token: newAal2Token(), refresh_token: 'test-aal2-refresh'
      });
      throw new Error(`Unexpected request: ${url} (${method})`);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter initialEntries={['/identity?security=mfa']}><App /></MemoryRouter>);

    await screen.findByRole('button', { name: 'Add an authenticator' });
    fireEvent.click(screen.getByRole('button', { name: 'Add an authenticator' }));
    await screen.findByText('TEST-ONLY-TOTP-KEY');
    fireEvent.change(screen.getByLabelText('Six-digit authenticator code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify MFA with Supabase' }));
    await screen.findByRole('heading', { name: 'MFA verified' });

    expect(localStorage.getItem('atlas_access_token')).toBe(newAal2Token());
    expect(localStorage.getItem('atlas_refresh_token')).toBe('test-aal2-refresh');
    expect(JSON.stringify(Object.fromEntries(Object.entries(localStorage)))).not.toContain('TEST-ONLY-TOTP-KEY');
    const verifierCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith(`/auth/v1/factors/${FACTOR}/verify`));
    expect(verifierCall).toBeDefined();
    expect(verifierCall?.[1]?.body).toContain('"challenge_id":"challenge-test"');
  });

  it('allows a signed-out owner to sign in directly to MFA without an organization dependency', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/auth/v1/token?grant_type=password')) return Response.json({
        access_token: 'first-factor-token', refresh_token: 'first-factor-refresh'
      });
      if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'user-one' });
      if (url.endsWith('/auth/v1/factors')) return Response.json({ all: [] });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter initialEntries={['/identity?security=mfa']}><App /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'local-test-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to ATLAS' }));
    await screen.findByRole('heading', { name: 'Multi-factor authentication' });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/organization_members'))).toBe(false);
    expect(screen.getByRole('button', { name: 'Add an authenticator' })).toBeInTheDocument();
  });

  it('steps up an existing verified authenticator to AAL2 without enrolling a new factor', async () => {
    localStorage.setItem('atlas_access_token', 'test-existing-aal1');
    localStorage.setItem('atlas_refresh_token', 'test-existing-refresh');
    const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
      if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'user-one' });
      if (url.endsWith('/auth/v1/factors') && (!init.method || init.method === 'GET')) {
        return Response.json({
          all: [{ id: FACTOR, factor_type: 'totp', status: 'verified', friendly_name: 'Existing TOTP' }]
        });
      }
      if (url.endsWith(`/auth/v1/factors/${FACTOR}/challenge`)) return Response.json({ id: 'existing-challenge' });
      if (url.endsWith(`/auth/v1/factors/${FACTOR}/verify`)) return Response.json({
        access_token: newAal2Token(), refresh_token: 'existing-step-up-refresh'
      });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter initialEntries={['/identity?security=mfa']}><App /></MemoryRouter>);

    await screen.findByRole('option', { name: 'Existing TOTP' });
    expect(screen.getByRole('button', { name: 'Verify MFA with Supabase' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Six-digit authenticator code'), { target: { value: '234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify MFA with Supabase' }));
    await screen.findByRole('heading', { name: 'MFA verified' });

    expect(fetchMock.mock.calls.some(([url, init]) =>
      String(url).endsWith('/auth/v1/factors') && init?.method === 'POST'
    )).toBe(false);
    expect(localStorage.getItem('atlas_access_token')).toBe(newAal2Token());
    expect(localStorage.getItem('atlas_refresh_token')).toBe('existing-step-up-refresh');
  });

  it('fails closed when Supabase does not issue AAL2 after verifying the code', async () => {
    localStorage.setItem('atlas_access_token', 'test-initial-session');
    localStorage.setItem('atlas_refresh_token', 'test-initial-refresh');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/challenge')) return Response.json({ id: 'challenge-test' });
      if (url.endsWith('/verify')) return Response.json({ access_token: oldAal1Token(), refresh_token: 'test-rejected-refresh' });
      throw new Error('Unexpected request');
    }));
    await expect(challengeAndVerifyAtlasTotp(FACTOR, '123456')).rejects.toThrow('mfa_aal2_session_not_proven');
    expect(localStorage.getItem('atlas_access_token')).toBe('test-initial-session');
    expect(localStorage.getItem('atlas_refresh_token')).toBe('test-initial-refresh');
  });
});
