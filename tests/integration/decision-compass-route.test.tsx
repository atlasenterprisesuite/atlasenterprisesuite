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

const membership = [{ org_id: 'org-1', role: 'owner', status: 'active' }];
const reflectionRecord = {
  id: 'd-1',
  org_id: 'org-1',
  created_by: 'user-1',
  created_at: '2026-09-08T00:00:00Z',
  signal_kind: 'symbolic',
  signal_label: 'The Moon',
  signal_text: 'Check uncertainty',
  interpretation: 'Review incomplete information before acting.',
  target_module: 'governance',
  risk: 'medium',
  proposed_action: 'Inspect contradictory evidence',
  verification_gate: [{ id: 'gate-1', label: 'Independent evidence reviewed', passed: false }],
  truth_state: 'reflection',
  verified_by: null,
  verified_at: null,
  decision_compass_evidence_refs: []
};

function authenticate() {
  window.localStorage.setItem('atlas_access_token', 'decision-token');
}

describe('ATLAS Decision Compass route', () => {
  it('routes unauthenticated access through ATLAS Identity', () => {
    render(
      <MemoryRouter initialEntries={['/governance/decision-compass']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'ATLAS Identity' })).toBeInTheDocument();
    expect(screen.getByText('/governance/decision-compass')).toBeInTheDocument();
  });

  it('renders the protected workspace with an explicit reflection boundary', async () => {
    authenticate();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(membership), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(membership), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/governance/decision-compass']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Decision Compass' })).toBeInTheDocument());
    expect(screen.getByText('Reflection, not evidence')).toBeInTheDocument();
    expect(screen.getByLabelText('Signal kind')).toBeInTheDocument();
    expect(screen.getByLabelText('Signal label')).toBeInTheDocument();
    expect(screen.getByLabelText('Original signal')).toBeInTheDocument();
    expect(screen.getByLabelText('Interpretation')).toBeInTheDocument();
    expect(screen.getByLabelText('Target module')).toBeInTheDocument();
    expect(screen.getByLabelText('Risk')).toBeInTheDocument();
    expect(screen.getByText('No Decision Compass records yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Governance' })).toBeInTheDocument();
  });

  it('shows evidence absence and verification gates without inventing verified state', async () => {
    authenticate();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(membership), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(membership), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([reflectionRecord]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/governance/decision-compass']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Decision Compass' })).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'The Moon' })).toBeInTheDocument();
    expect(screen.getByText('No evidence attached')).toBeInTheDocument();
    expect(screen.getByText('Independent evidence reviewed')).toBeInTheDocument();
    expect(screen.getByText('reflection')).toBeInTheDocument();
    expect(screen.queryByText('verified', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start evidence review' })).toBeInTheDocument();
  });

  it('creates a reflection rather than a verified operational fact', async () => {
    authenticate();
    const created = {
      ...reflectionRecord,
      id: 'd-new',
      signal_kind: 'observation',
      signal_label: 'Release pressure',
      signal_text: 'Too many open workstreams',
      interpretation: 'Prioritize a small number of execution-critical items.'
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(membership), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(membership), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(membership), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([created]), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/governance/decision-compass']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Decision Compass' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Signal kind'), { target: { value: 'observation' } });
    fireEvent.change(screen.getByLabelText('Signal label'), { target: { value: 'Release pressure' } });
    fireEvent.change(screen.getByLabelText('Original signal'), { target: { value: 'Too many open workstreams' } });
    fireEvent.change(screen.getByLabelText('Interpretation'), { target: { value: 'Prioritize a small number of execution-critical items.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create reflection' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Release pressure' })).toBeInTheDocument());
    const createBody = JSON.parse(String((fetchMock.mock.calls[4][1] as RequestInit).body));
    expect(createBody.truth_state).toBe('reflection');
    expect(createBody.verified_by).toBeUndefined();
  });

  it('surfaces Supabase failure instead of showing a fabricated empty success state', async () => {
    authenticate();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(membership), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(membership), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'decision_compass_unavailable' }), { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/governance/decision-compass']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('decision compass unavailable'));
    expect(screen.queryByText('No Decision Compass records yet')).not.toBeInTheDocument();
  });
});
