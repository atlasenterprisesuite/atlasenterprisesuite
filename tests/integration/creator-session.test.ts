import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as session from '../../apps/web/src/lib/atlasSession';

describe('ATLAS Creator authenticated generation client', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('submits a zero-cost generation request with organization context', async () => {
    const generateCreatorAsset = (session as any).generateCreatorAsset;
    expect(typeof generateCreatorAsset).toBe('function');
    if (typeof generateCreatorAsset !== 'function') return;

    window.localStorage.setItem('atlas_access_token', 'creator-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([{ org_id: '11111111-1111-4111-8111-111111111111', role: 'admin', status: 'active' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, providerId: 'flux-schnell-local', state: 'configuration-required', message: 'Local runtime missing' }), { status: 503 }));

    await expect(generateCreatorAsset({
      kind: 'image', prompt: 'Create an ATLAS payroll campaign visual', format: 'Square 1:1', visibility: 'Private'
    })).resolves.toMatchObject({ providerId: 'flux-schnell-local', state: 'configuration-required' });

    const generationCall = fetchMock.mock.calls[1];
    expect(String(generationCall[0])).toContain('/functions/v1/atlas-creator-generate');
    expect((generationCall[1]?.headers as Record<string, string>)['x-atlas-org-id']).toBe('11111111-1111-4111-8111-111111111111');
    expect(JSON.parse(String(generationCall[1]?.body))).toMatchObject({ zeroCostMode: true, kind: 'image' });
  });
});
