import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exportCreatorPrompt,
  listCreativeEngines,
  listCreatorProviders
} from '../../apps/web/src/lib/creatorApi';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('atlas_access_token', 'test-token');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ATLAS Creator browser API', () => {
  it('calls atlas-creator with bearer authentication', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, providers: [] }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    await listCreatorProviders();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/functions/v1/atlas-creator?api=providers');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer test-token');
  });

  it('loads the generalized engine registry and omits an unavailable native runtime', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        engines: [{
          engineId: 'prompt-export',
          displayName: 'Prompt Export',
          executionClass: 'prompt-export-only',
          connectionState: 'ready',
          ready: true,
          mediaKinds: ['image'],
          capabilityNotes: ['planning-only'],
          lastVerifiedAt: null
        }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ error: 'native_composer_not_configured' }),
        { status: 503 }
      ));
    vi.stubGlobal('fetch', fetchMock);

    const engines = await listCreativeEngines();

    expect(String(fetchMock.mock.calls[0][0])).toContain('/functions/v1/atlas-creator?api=engines');
    expect(engines.map(engine => engine.engineId)).toEqual(['prompt-export']);
  });

  it('adds atlas-native only after its readiness endpoint succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, engines: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        renderer: 'atlas-native',
        billing_class: 'zero-cost',
        execution: 'self-hosted',
        native: { state: 'ready', capabilities: ['motion-composition-v1'] }
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const engines = await listCreativeEngines();

    expect(String(fetchMock.mock.calls[1][0])).toContain('/functions/v1/atlas-creator-native?api=readiness');
    expect(engines.find(engine => engine.engineId === 'atlas-native')?.ready).toBe(true);
  });

  it('exports a prompt package without calling a generation endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      prompt_package: {
        status: 'prompt-ready',
        engineId: 'prompt-export',
        mediaKind: 'image',
        prompt: 'MEDIA: image\nOBJECTIVE: ATLAS launch visual',
        parameters: { language: 'English', negativeConstraints: [] },
        adaptationNotes: ['No media was generated.']
      }
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await exportCreatorPrompt({
      mediaKind: 'image',
      brief: 'ATLAS launch visual'
    });

    expect(result.status).toBe('prompt-ready');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/functions/v1/atlas-creator?api=prompt-export');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('submit');
  });
});
