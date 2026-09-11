import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAtlasSession } from '../../apps/web/src/lib/atlasSession';
import { getAssistantStatus, sendAssistantMessage } from '../../apps/web/src/assistant/client';

afterEach(() => {
  clearAtlasSession();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ATLAS Assistant session bridge', () => {
  it('rejects assistant requests without an ATLAS session', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendAssistantMessage({
      message: 'hello',
      pathname: '/',
      modality: 'text'
    })).rejects.toThrow('authentication_required');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves active organization before calling copilot status', async () => {
    localStorage.setItem('atlas_access_token', 'live-token');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { org_id: 'org-1', role: 'owner', status: 'active' }
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        authenticated: true,
        provider: 'openai',
        provider_state: 'verified_for_request',
        model: 'gpt-6-astra',
        storage_state: 'configured',
        organization: 'org-1',
        role: 'owner',
        capabilities: ['generation', 'reasoning']
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getAssistantStatus();

    expect(result.organization).toBe('org-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/rest/v1/organization_members');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/functions/v1/atlas-copilot?api=status');
    const headers = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer live-token');
    expect(headers['x-atlas-org-id']).toBe('org-1');
  });

  it('keeps chat requests scoped to the resolved active organization', async () => {
    localStorage.setItem('atlas_access_token', 'live-token');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { org_id: 'org-1', role: 'member', status: 'active' }
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        text: 'Ready.',
        conversation_id: 'conv-1'
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await sendAssistantMessage({
      message: 'What module am I in?',
      pathname: '/studio/voice',
      modality: 'text'
    });

    const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(body.organization_id).toBe('org-1');
    expect(body.module).toBe('studio.voice');
  });
});
