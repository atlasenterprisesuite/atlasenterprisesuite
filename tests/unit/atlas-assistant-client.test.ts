import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorizedAtlasFetch: vi.fn(),
  getActiveAtlasOrganization: vi.fn()
}));

vi.mock('../../apps/web/src/lib/atlasSession', () => ({
  authorizedAtlasFetch: mocks.authorizedAtlasFetch,
  getActiveAtlasOrganization: mocks.getActiveAtlasOrganization
}));

import { getAssistantStatus, sendAssistantMessage } from '../../apps/web/src/assistant/client';

describe('ATLAS Assistant governed copilot client', () => {
  beforeEach(() => {
    mocks.authorizedAtlasFetch.mockReset();
    mocks.getActiveAtlasOrganization.mockReset().mockResolvedValue({ id: 'org-1', role: 'owner' });
  });

  it('uses the authenticated ATLAS fetch path for provider status', async () => {
    mocks.authorizedAtlasFetch.mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      authenticated: true,
      provider: 'openai',
      provider_state: 'verified_for_request',
      model: 'model',
      storage_state: 'configured',
      organization: 'org-1',
      role: 'owner',
      capabilities: ['generation']
    }), { status: 200 }));

    await getAssistantStatus();

    expect(mocks.authorizedAtlasFetch).toHaveBeenCalledWith('/functions/v1/atlas-copilot?api=status', {
      method: 'GET',
      headers: { 'x-atlas-org-id': 'org-1' }
    });
  });

  it('sends route context through the auto provider router without browser provider keys', async () => {
    mocks.authorizedAtlasFetch.mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      text: 'Ready',
      conversation_id: 'conv-1'
    }), { status: 200 }));

    await sendAssistantMessage({
      message: 'Review hospitality operations',
      pathname: '/hospitality/hotels',
      modality: 'text'
    });

    const [, init] = mocks.authorizedAtlasFetch.mock.calls[0];
    expect(JSON.parse(String(init.body))).toMatchObject({
      organization_id: 'org-1',
      module: 'hospitality',
      intent: 'balanced',
      mode: 'auto',
      message: 'Review hospitality operations',
      capabilities_requested: ['generation'],
      client_metadata: { modality: 'text', surface: 'atlas-assistant' }
    });
  });
});
