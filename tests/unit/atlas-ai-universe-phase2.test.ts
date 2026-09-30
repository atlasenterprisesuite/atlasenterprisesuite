import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ATLAS_AI_UNIVERSE_TEMPLATES,
  buildAIUniverseCatalog,
  recommendAIUniverseEntries
} from '../../packages/creator/ai_universe';

describe('ATLAS AI Universe phase 2', () => {
  const creative = [
    {
      engineId: 'atlas-native',
      displayName: 'ATLAS Native',
      executionClass: 'self-hosted' as const,
      connectionState: 'ready' as const,
      ready: true,
      mediaKinds: ['video'] as const,
      capabilityNotes: ['motion-composition-v1'],
      lastVerifiedAt: '2026-09-30T20:00:00.000Z'
    },
    {
      engineId: 'prompt-export',
      displayName: 'Prompt Export',
      executionClass: 'prompt-export-only' as const,
      connectionState: 'ready' as const,
      ready: true,
      mediaKinds: ['image', 'video'] as const,
      capabilityNotes: ['planning-only'],
      lastVerifiedAt: null
    }
  ];

  const assistants = [
    {
      id: 'atlas-local',
      state: 'verified',
      configured: true,
      verified: true,
      model: 'local-model',
      capabilities: ['generation', 'reasoning'],
      profiles: ['fast', 'balanced', 'deep']
    },
    {
      id: 'openai',
      state: 'configured-unverified',
      configured: true,
      verified: false,
      model: 'configured-model',
      capabilities: ['generation', 'reasoning'],
      profiles: ['balanced']
    }
  ];

  it('builds the catalog only from reported assistant providers and creative engines', () => {
    const catalog = buildAIUniverseCatalog({
      assistantProviders: assistants,
      creativeEngines: creative,
      zeroCostProviderIds: ['atlas-local']
    });

    expect(catalog.find(entry => entry.id === 'assistant:atlas-local')).toMatchObject({
      verified: true,
      executionAvailable: true,
      costClass: 'zero-cost',
      modalities: ['text']
    });
    expect(catalog.find(entry => entry.id === 'assistant:openai')).toMatchObject({
      verified: false,
      executionAvailable: false
    });
    expect(catalog.find(entry => entry.id === 'creator:prompt-export')).toMatchObject({
      verified: true,
      executionAvailable: false,
      costClass: 'planning-only'
    });
  });

  it('never recommends an unverified provider and prefers executable engines over planning fallback', () => {
    const catalog = buildAIUniverseCatalog({
      assistantProviders: assistants,
      creativeEngines: creative,
      zeroCostProviderIds: ['atlas-local']
    });

    const video = recommendAIUniverseEntries(catalog, { modality: 'video', priority: 'cost' }, []);
    expect(video[0].entry.id).toBe('creator:atlas-native');
    expect(video.map(item => item.entry.id)).not.toContain('assistant:openai');

    const image = recommendAIUniverseEntries(catalog, { modality: 'image', priority: 'cost' }, []);
    expect(image).toHaveLength(1);
    expect(image[0].entry.id).toBe('creator:prompt-export');
    expect(image[0].entry.executionAvailable).toBe(false);
  });

  it('uses observed latency and completion history without inventing subjective quality scores', () => {
    const catalog = buildAIUniverseCatalog({
      assistantProviders: [
        { ...assistants[0], id: 'fast-provider' },
        { ...assistants[0], id: 'slow-provider' }
      ],
      creativeEngines: [],
      zeroCostProviderIds: []
    });
    const observations = [
      { provider: 'fast-provider', requests: 10, completed: 10, failed: 0, average_latency_ms: 300, automatic_api_cost_usd: 0 },
      { provider: 'slow-provider', requests: 10, completed: 8, failed: 2, average_latency_ms: 1800, automatic_api_cost_usd: 0 }
    ];

    expect(recommendAIUniverseEntries(catalog, { modality: 'text', priority: 'latency' }, observations)[0].entry.providerId).toBe('fast-provider');
    const quality = recommendAIUniverseEntries(catalog, { modality: 'text', priority: 'quality' }, observations);
    expect(quality[0].entry.providerId).toBe('fast-provider');
    expect(quality[0].reasons.join(' ')).toContain('Quality proxy');
  });

  it('ships only ATLAS-original reusable templates and does not claim live trends', () => {
    expect(ATLAS_AI_UNIVERSE_TEMPLATES.length).toBeGreaterThanOrEqual(8);
    expect(ATLAS_AI_UNIVERSE_TEMPLATES.every(item => item.source === 'atlas-original')).toBe(true);
    const page = readFileSync('apps/web/src/modules/creator/AIUniversePage.tsx', 'utf8');
    expect(page).toContain('No live social trend signal is claimed');
  });

  it('wires the authenticated control center, telemetry endpoint and fail-closed onboarding', () => {
    const app = readFileSync('apps/web/src/App.tsx', 'utf8');
    const page = readFileSync('apps/web/src/modules/creator/AIUniversePage.tsx', 'utf8');
    const copilot = readFileSync('supabase/functions/atlas-copilot/index.ts', 'utf8');
    const store = readFileSync('supabase/functions/atlas-copilot/atlas-intelligence-store.mjs', 'utf8');

    expect(app).toContain('path="/studio/ai-universe"');
    expect(app).toContain('<RequireAtlasIdentity><AIUniversePage /></RequireAtlasIdentity>');
    expect(page).toContain('getAssistantUsage(30)');
    expect(page).toContain('ATLAS never requests provider secrets in this browser page');
    expect(copilot).toContain("if(api==='usage')return await handleUsage(req)");
    expect(store).toContain('async function usageSummary');
    expect(store).toContain('atlas_ai_requests?select=status,provider,model,usage,latency_ms');
    expect(page).not.toMatch(/OPENAI_API_KEY|GEMINI_API_KEY|AWS_BEARER_TOKEN/i);
  });
});
