import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exportCreatorPrompt,
  listCreativeEngines,
  listCreativePlans,
  saveCreativePlan,
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

  it('lists CreativePlans through the authenticated creator edge route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      creative_plans: [{
        id: '11111111-1111-4111-8111-111111111111',
        organization_id: 'org-1',
        created_by: 'user-1',
        version: 2,
        created_at: '2026-09-18T17:00:00.000Z',
        updated_at: '2026-09-18T18:00:00.000Z',
        plan_json: {
          id: '11111111-1111-4111-8111-111111111111',
          organizationId: 'org-1',
          createdByUserId: 'user-1',
          title: 'Launch',
          sourceBrief: 'Launch ATLAS finance campaign',
          normalizedObjective: 'Launch ATLAS finance campaign',
          mediaKinds: ['image'],
          targetDestinations: ['Web'],
          audience: 'Finance leaders',
          aspectRatio: '16:9',
          language: 'English',
          brandProfileId: null,
          referenceAssetIds: [],
          deliverables: [],
          promptSet: [],
          audioPlan: { voiceScript: '', musicBrief: '', soundEffectCues: [] },
          accessibilityPlan: { captions: false, transcript: false, altText: true, audioDescription: false },
          negativeConstraints: [],
          enginePreference: { image: 'prompt-export' },
          createdAt: '2026-09-18T17:00:00.000Z',
          updatedAt: '2026-09-18T17:00:00.000Z',
          version: 1
        }
      }]
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const plans = await listCreativePlans();

    expect(String(fetchMock.mock.calls[0][0])).toContain('/functions/v1/atlas-creator?api=creative-plans');
    expect(plans[0].version).toBe(2);
    expect(plans[0].organizationId).toBe('org-1');
  });

  it('saves CreativePlan with optimistic versioning through the creator edge route', async () => {
    const plan = {
      id: '11111111-1111-4111-8111-111111111111',
      organizationId: 'org-1',
      createdByUserId: 'user-1',
      title: 'Launch',
      sourceBrief: 'Launch ATLAS finance campaign',
      normalizedObjective: 'Launch ATLAS finance campaign',
      mediaKinds: ['image'] as const,
      targetDestinations: ['Web'],
      audience: 'Finance leaders',
      aspectRatio: '16:9',
      language: 'English',
      brandProfileId: null,
      referenceAssetIds: [],
      deliverables: [],
      promptSet: [],
      audioPlan: { voiceScript: '', musicBrief: '', soundEffectCues: [] },
      accessibilityPlan: { captions: false, transcript: false, altText: true, audioDescription: false },
      negativeConstraints: [],
      enginePreference: { image: 'prompt-export' },
      createdAt: '2026-09-18T17:00:00.000Z',
      updatedAt: '2026-09-18T17:00:00.000Z',
      version: 1
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      creative_plan: {
        id: plan.id,
        organization_id: 'org-1',
        created_by: 'user-1',
        version: 1,
        created_at: plan.createdAt,
        updated_at: plan.updatedAt,
        plan_json: plan
      }
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const saved = await saveCreativePlan(plan, 0);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/functions/v1/atlas-creator?api=creative-plan-save');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body)).expected_version).toBe(0);
    expect(saved.id).toBe(plan.id);
  });

});
