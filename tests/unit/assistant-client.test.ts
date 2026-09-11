import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../apps/web/src/lib/atlasSession', () => ({
  getActiveAtlasOrganization: vi.fn(async () => ({ id: 'org-1', role: 'owner' })),
  getAtlasAccessToken: vi.fn(() => 'live-token')
}));

import { getAssistantStatus, sendAssistantMessage } from '../../apps/web/src/assistant/client';

describe('ATLAS Assistant copilot client', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('calls atlas-copilot status with bearer and organization context', async () => {
    (fetch as any).mockResolvedValueOnce(new Response(JSON.stringify({
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

    await getAssistantStatus();

    const [url, init] = (fetch as any).mock.calls[0];
    expect(String(url)).toContain('/functions/v1/atlas-copilot?api=status');
    expect(init.headers.authorization).toBe('Bearer live-token');
    expect(init.headers['x-atlas-org-id']).toBe('org-1');
  });

  it('sends module-aware chat payload through atlas-copilot', async () => {
    (fetch as any).mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      text: 'Accounts payable is open.',
      conversation_id: 'conv-1'
    }), { status: 200 }));

    await sendAssistantMessage({
      message: ' summarize AP ',
      pathname: '/finance/accounting/accounts-payable',
      modality: 'text'
    });

    const [url, init] = (fetch as any).mock.calls[0];
    expect(String(url)).toContain('/functions/v1/atlas-copilot?api=chat');
    expect(JSON.parse(String(init.body))).toMatchObject({
      organization_id: 'org-1',
      module: 'finance.accounting.accounts-payable',
      message: 'summarize AP',
      capabilities_requested: ['generation'],
      client_metadata: { modality: 'text', surface: 'atlas-assistant' }
    });
  });

  it('throws provider errors instead of rendering them as replies', async () => {
    (fetch as any).mockResolvedValueOnce(new Response(JSON.stringify({
      ok: false,
      error: 'provider_not_configured'
    }), { status: 503 }));

    await expect(sendAssistantMessage({
      message: 'hello',
      pathname: '/',
      modality: 'text'
    })).rejects.toThrow('provider_not_configured');
  });
});
