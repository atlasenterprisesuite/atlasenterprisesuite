import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addDecisionEvidence,
  clearAtlasSession,
  createDecisionCompassRecord,
  listDecisionCompassRecords,
  transitionDecisionCompassRecord
} from '../../apps/web/src/lib/atlasSession';

afterEach(() => {
  clearAtlasSession();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function authenticate() {
  window.localStorage.setItem('atlas_access_token', 'decision-token');
}

const databaseRecord = {
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
  proposed_action: null,
  verification_gate: [],
  truth_state: 'reflection',
  verified_by: null,
  verified_at: null,
  decision_compass_evidence_refs: []
};

describe('Decision Compass Supabase client', () => {
  it('lists records only for the active organization', async () => {
    authenticate();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ org_id: 'org-1', role: 'owner', status: 'active' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([databaseRecord]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await listDecisionCompassRecords();

    expect(result).toHaveLength(1);
    expect(result[0].organizationId).toBe('org-1');
    expect(result[0].truthState).toBe('reflection');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/rest/v1/decision_compass_records?org_id=eq.org-1');
  });

  it('forces newly created records to start as reflection', async () => {
    authenticate();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ org_id: 'org-1', role: 'owner', status: 'active' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([databaseRecord]), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    await createDecisionCompassRecord({
      signalKind: 'symbolic',
      signalLabel: 'The Moon',
      signalText: 'Check uncertainty',
      interpretation: 'Review incomplete information before acting.',
      targetModule: 'governance',
      risk: 'medium',
      proposedAction: null,
      verificationGate: []
    });

    const request = fetchMock.mock.calls[1][1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.org_id).toBe('org-1');
    expect(body.truth_state).toBe('reflection');
    expect(body.verified_by).toBeUndefined();
    expect(body.verified_at).toBeUndefined();
  });

  it('adds evidence inside the active organization boundary', async () => {
    authenticate();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ org_id: 'org-1', role: 'owner', status: 'active' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'e-1' }]), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    await addDecisionEvidence('d-1', {
      kind: 'workflow',
      sourceModule: 'github',
      sourceId: 'run-1',
      label: 'CI run'
    });

    const body = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(body.record_id).toBe('d-1');
    expect(body.org_id).toBe('org-1');
    expect(body.source_module).toBe('github');
  });

  it('uses the governed transition RPC instead of directly patching truth_state', async () => {
    authenticate();
    const transitioned = { ...databaseRecord, truth_state: 'needs_evidence' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ org_id: 'org-1', role: 'owner', status: 'active' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(transitioned), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await transitionDecisionCompassRecord('d-1', 'needs_evidence', 'Review supporting evidence');

    expect(result.truthState).toBe('needs_evidence');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/rest/v1/rpc/decision_compass_transition');
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe('POST');
    expect(JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body))).toEqual({
      p_record_id: 'd-1',
      p_next_state: 'needs_evidence',
      p_reason: 'Review supporting evidence'
    });
  });
});
