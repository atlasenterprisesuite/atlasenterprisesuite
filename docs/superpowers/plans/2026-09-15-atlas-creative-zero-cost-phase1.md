# ATLAS Creative Zero-Cost Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a working first slice of ATLAS Creative Studio that introduces a media-neutral Creative Engine Registry, a zero-cost prompt-export path, truthful readiness for existing external and native engines, and a usable prompt-export action in the existing Creator UI without regressing ATLAS Director.

**Architecture:** Extend the existing `packages/creator` domain with media-neutral engine contracts and a deterministic Prompt Engine. Reuse the existing `atlas-creator` and `atlas-creator-native` edge functions, existing Creator permissions, existing route tree, and existing Creator UI. `atlas-creator` exposes mapped external provider readiness plus the always-available prompt-export engine; the browser separately probes `atlas-creator-native` and only adds it when its real readiness endpoint succeeds.

**Tech Stack:** TypeScript 5.7, React 18.3, Vite 6.4, Vitest 3.2, Supabase Edge Functions (Deno), existing ATLAS Identity/RBAC, existing Creator domain, existing `atlas-creator-native` renderer.

**Spec:** `docs/superpowers/specs/2026-09-15-atlas-creative-zero-cost-design.md`

## Global Constraints

- Reuse `/studio`, `/studio/create`, `/studio/library`, `/studio/providers`, and `/studio/voice`; do not create a parallel Creator application.
- Preserve `creator.read`, `creator.write`, `creator.generate`, `creator.manage_providers`, `creator.publish`, and `creator.admin` as the authoritative permission contract.
- Preserve the current `ProductionSpec`, ATLAS Director flow, provider compiler, validator, and current external-provider behavior.
- Never report a provider or local runtime as connected until a real readiness check succeeds.
- Never report media as generated until a real asset/result is verified.
- Prompt export is a planning result, not a media-generation result; it must not create a generation job or `CreatorAsset`.
- Do not expose provider credentials or native-renderer secrets to the browser.
- Zero-cost-first means browser-native, local/self-hosted, verified free-tier, BYO, prompt-export, then paid-optional; open-source software is not automatically zero monetary cost.
- `atlas-native` remains a verified self-hosted engine with `billingClass: 'zero-cost'`; do not duplicate or bypass `atlas-creator-native` readiness.
- All Creator persistence and audit records remain organization-scoped.
- Required verification before production claim: `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run build`.

---

## File Structure

- `packages/creator/creative_engine.ts` — media-neutral engine types, execution-class order, external-provider adapter, native-readiness adapter, compatibility/ranking helpers.
- `packages/creator/prompt_engine.ts` — deterministic provider-neutral prompt package compiler used by server and tests.
- `supabase/functions/atlas-creator/index.ts` — add `engines` and `prompt-export` routes while preserving existing provider routes.
- `apps/web/src/lib/creatorApi.ts` — add engine-registry and prompt-export browser methods; merge verified native readiness in the client without hardcoding native readiness.
- `apps/web/src/modules/creator/CreatorStudioPage.tsx` — expose prompt export as the zero-cost fallback and show generalized engine readiness while preserving current Director routing.
- `tests/unit/creator-creative-engine.test.ts` — execution ordering, provider adaptation, native adaptation, compatibility tests.
- `tests/unit/creator-prompt-engine.test.ts` — deterministic prompt-package behavior and no fabricated asset/job semantics.
- `tests/unit/creator-api.test.ts` — authenticated `engines`, native readiness, and `prompt-export` request tests.
- `tests/integration/atlas-creator-route.test.tsx` — UI behavior, truthful readiness, prompt export, and Director regression coverage.

---

### Task 1: Add media-neutral Creative Engine contracts and ranking

**Files:**
- Create: `packages/creator/creative_engine.ts`
- Create: `tests/unit/creator-creative-engine.test.ts`

**Interfaces:**
- Consumes: `ProviderReadiness`, `ProviderConnectionState`, `ProviderId` from `packages/creator/types.ts`.
- Produces: `CreativeMediaKind`, `CreativeExecutionClass`, `CreativeEngineId`, `CreativeEngineReadiness`, `CREATIVE_EXECUTION_ORDER`, `adaptProviderToCreativeEngine(provider)`, `adaptNativeReadiness(native)`, `rankCreativeEngines(engines, mediaKind)`.

- [ ] **Step 1: Write the failing domain tests**

Create `tests/unit/creator-creative-engine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  adaptNativeReadiness,
  adaptProviderToCreativeEngine,
  rankCreativeEngines
} from '../../packages/creator/creative_engine';

describe('ATLAS Creative Engine domain', () => {
  it('maps an unconfigured external video provider without inventing readiness', () => {
    const engine = adaptProviderToCreativeEngine({
      providerId: 'seedance',
      displayName: 'Seedance',
      connectionState: 'unconfigured',
      capability: null,
      estimatedCost: null,
      lastVerifiedAt: null
    });
    expect(engine.engineId).toBe('provider:seedance');
    expect(engine.executionClass).toBe('byo-provider');
    expect(engine.connectionState).toBe('unconfigured');
    expect(engine.mediaKinds).toEqual(['video']);
    expect(engine.ready).toBe(false);
  });

  it('maps verified ATLAS native readiness as zero-cost self-hosted video', () => {
    const engine = adaptNativeReadiness({
      ok: true,
      renderer: 'atlas-native',
      billing_class: 'zero-cost',
      execution: 'self-hosted',
      native: { state: 'ready', capabilities: ['motion-composition-v1'] }
    });
    expect(engine.engineId).toBe('atlas-native');
    expect(engine.executionClass).toBe('self-hosted');
    expect(engine.connectionState).toBe('ready');
    expect(engine.ready).toBe(true);
    expect(engine.mediaKinds).toContain('video');
  });

  it('orders lower-cost execution classes ahead of paid providers', () => {
    const ranked = rankCreativeEngines([
      { engineId: 'paid:x', displayName: 'Paid X', executionClass: 'paid-provider', connectionState: 'ready', ready: true, mediaKinds: ['image'], capabilityNotes: [], lastVerifiedAt: '2026-09-15T12:00:00Z' },
      { engineId: 'prompt-export', displayName: 'Prompt Export', executionClass: 'prompt-export-only', connectionState: 'ready', ready: true, mediaKinds: ['image'], capabilityNotes: [], lastVerifiedAt: '2026-09-15T12:00:00Z' },
      { engineId: 'browser:image', displayName: 'Browser Image', executionClass: 'browser-local', connectionState: 'ready', ready: true, mediaKinds: ['image'], capabilityNotes: [], lastVerifiedAt: '2026-09-15T12:00:00Z' }
    ], 'image');
    expect(ranked.map(value => value.engineId)).toEqual(['browser:image', 'prompt-export', 'paid:x']);
  });
});
```

- [ ] **Step 2: Run the new test and verify failure**

Run:

```bash
npx vitest run tests/unit/creator-creative-engine.test.ts
```

Expected: FAIL because `packages/creator/creative_engine.ts` does not exist.

- [ ] **Step 3: Implement the engine contracts and adapters**

Create `packages/creator/creative_engine.ts` with these exact public contracts:

```ts
import type { ProviderReadiness } from './types';

export type CreativeMediaKind = 'image' | 'video' | 'music' | 'voice' | 'sfx' | 'graphic' | 'template';
export type CreativeExecutionClass =
  | 'browser-local'
  | 'local-compute'
  | 'self-hosted'
  | 'free-tier'
  | 'byo-provider'
  | 'prompt-export-only'
  | 'paid-provider';

export type CreativeEngineConnectionState =
  | 'unconfigured'
  | 'configured-unverified'
  | 'ready'
  | 'unavailable'
  | 'insufficient-credit'
  | 'error';

export type CreativeEngineReadiness = {
  engineId: string;
  displayName: string;
  executionClass: CreativeExecutionClass;
  connectionState: CreativeEngineConnectionState;
  ready: boolean;
  mediaKinds: CreativeMediaKind[];
  capabilityNotes: string[];
  lastVerifiedAt: string | null;
};

export const CREATIVE_EXECUTION_ORDER: readonly CreativeExecutionClass[] = [
  'browser-local',
  'local-compute',
  'self-hosted',
  'free-tier',
  'byo-provider',
  'prompt-export-only',
  'paid-provider'
];

export function adaptProviderToCreativeEngine(provider: ProviderReadiness): CreativeEngineReadiness {
  return {
    engineId: `provider:${provider.providerId}`,
    displayName: provider.displayName,
    executionClass: 'byo-provider',
    connectionState: provider.connectionState,
    ready: provider.connectionState === 'ready',
    mediaKinds: ['video'],
    capabilityNotes: provider.capability
      ? [`modes:${provider.capability.modes.join(',')}`, `resolutions:${provider.capability.resolutions.join(',')}`]
      : [],
    lastVerifiedAt: provider.lastVerifiedAt
  };
}

export function adaptNativeReadiness(value: {
  ok: true;
  renderer: 'atlas-native';
  billing_class: 'zero-cost';
  execution: 'self-hosted';
  native: { state: string; capabilities?: string[] };
}): CreativeEngineReadiness {
  const ready = value.native.state === 'ready';
  return {
    engineId: value.renderer,
    displayName: 'ATLAS Native',
    executionClass: 'self-hosted',
    connectionState: ready ? 'ready' : 'unavailable',
    ready,
    mediaKinds: ['video'],
    capabilityNotes: value.native.capabilities ?? [],
    lastVerifiedAt: ready ? new Date().toISOString() : null
  };
}

export function rankCreativeEngines(
  engines: readonly CreativeEngineReadiness[],
  mediaKind: CreativeMediaKind
): CreativeEngineReadiness[] {
  const rank = new Map(CREATIVE_EXECUTION_ORDER.map((value, index) => [value, index]));
  return engines
    .filter(engine => engine.mediaKinds.includes(mediaKind))
    .slice()
    .sort((left, right) => {
      if (left.ready !== right.ready) return left.ready ? -1 : 1;
      return (rank.get(left.executionClass) ?? 99) - (rank.get(right.executionClass) ?? 99);
    });
}
```

Do not add `atlas-native` to any static ready list. It only becomes ready through `adaptNativeReadiness` after a successful native readiness response.

- [ ] **Step 4: Run the focused unit test**

Run:

```bash
npx vitest run tests/unit/creator-creative-engine.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run Creator-domain regression tests**

Run:

```bash
npx vitest run tests/unit/atlas-director-domain.test.ts tests/unit/creator-creative-engine.test.ts
```

Expected: PASS with existing Director behavior unchanged.

- [ ] **Step 6: Commit Task 1**

```bash
git add packages/creator/creative_engine.ts tests/unit/creator-creative-engine.test.ts
git commit -m "feat: add creative engine domain"
```

---

### Task 2: Add deterministic Prompt Export engine

**Files:**
- Create: `packages/creator/prompt_engine.ts`
- Create: `tests/unit/creator-prompt-engine.test.ts`

**Interfaces:**
- Consumes: `CreativeMediaKind` from `packages/creator/creative_engine.ts`.
- Produces: `PromptExportRequest`, `PromptExportPackage`, `PROMPT_EXPORT_ENGINE`, `compilePromptExport(request)`.

- [ ] **Step 1: Write failing Prompt Engine tests**

Create `tests/unit/creator-prompt-engine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { compilePromptExport, PROMPT_EXPORT_ENGINE } from '../../packages/creator/prompt_engine';

describe('ATLAS Prompt Export', () => {
  it('is always a planning engine and never claims generated media', () => {
    expect(PROMPT_EXPORT_ENGINE.engineId).toBe('prompt-export');
    expect(PROMPT_EXPORT_ENGINE.executionClass).toBe('prompt-export-only');
    expect(PROMPT_EXPORT_ENGINE.ready).toBe(true);
  });

  it('compiles the same request deterministically', () => {
    const request = {
      mediaKind: 'image' as const,
      brief: 'ATLAS payroll dashboard on a clean futuristic workstation',
      aspectRatio: '16:9',
      destination: 'web hero',
      language: 'English'
    };
    expect(compilePromptExport(request)).toEqual(compilePromptExport(request));
  });

  it('returns prompt artifacts but no asset or generation job identifiers', () => {
    const result = compilePromptExport({
      mediaKind: 'voice',
      brief: 'Professional ATLAS onboarding narration',
      language: 'English'
    });
    expect(result.status).toBe('prompt-ready');
    expect(result.engineId).toBe('prompt-export');
    expect(result.prompt.length).toBeGreaterThan(20);
    expect('assetId' in result).toBe(false);
    expect('generationJobId' in result).toBe(false);
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npx vitest run tests/unit/creator-prompt-engine.test.ts
```

Expected: FAIL because `packages/creator/prompt_engine.ts` does not exist.

- [ ] **Step 3: Implement the deterministic compiler**

Create `packages/creator/prompt_engine.ts`:

```ts
import type { CreativeMediaKind, CreativeEngineReadiness } from './creative_engine';

export type PromptExportRequest = {
  mediaKind: CreativeMediaKind;
  brief: string;
  aspectRatio?: string;
  destination?: string;
  language?: string;
  negativeConstraints?: string[];
};

export type PromptExportPackage = {
  status: 'prompt-ready';
  engineId: 'prompt-export';
  mediaKind: CreativeMediaKind;
  prompt: string;
  parameters: Record<string, string | string[]>;
  adaptationNotes: string[];
};

export const PROMPT_EXPORT_ENGINE: CreativeEngineReadiness = {
  engineId: 'prompt-export',
  displayName: 'Prompt Export',
  executionClass: 'prompt-export-only',
  connectionState: 'ready',
  ready: true,
  mediaKinds: ['image', 'video', 'music', 'voice', 'sfx', 'graphic', 'template'],
  capabilityNotes: ['planning-only', 'no-media-generation', 'portable-output'],
  lastVerifiedAt: null
};

export function compilePromptExport(request: PromptExportRequest): PromptExportPackage {
  const brief = request.brief.trim();
  if (brief.length < 8) throw new Error('creative_brief_too_short');
  const lines = [
    `MEDIA: ${request.mediaKind}`,
    `OBJECTIVE: ${brief}`,
    request.destination ? `DESTINATION: ${request.destination.trim()}` : '',
    request.aspectRatio ? `ASPECT RATIO: ${request.aspectRatio.trim()}` : '',
    `LANGUAGE: ${(request.language || 'English').trim()}`,
    request.negativeConstraints?.length
      ? `NEGATIVE CONSTRAINTS: ${request.negativeConstraints.map(value => value.trim()).filter(Boolean).join('; ')}`
      : '',
    'OUTPUT: Produce only the requested media result. Preserve the stated brand, accessibility, and composition constraints.'
  ].filter(Boolean);
  return {
    status: 'prompt-ready',
    engineId: 'prompt-export',
    mediaKind: request.mediaKind,
    prompt: lines.join('\n'),
    parameters: {
      ...(request.aspectRatio ? { aspectRatio: request.aspectRatio } : {}),
      ...(request.destination ? { destination: request.destination } : {}),
      language: request.language || 'English',
      negativeConstraints: request.negativeConstraints ?? []
    },
    adaptationNotes: ['No media was generated. Use this package with a compatible authorized engine.']
  };
}
```

- [ ] **Step 4: Run the focused tests**

```bash
npx vitest run tests/unit/creator-prompt-engine.test.ts tests/unit/creator-creative-engine.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add packages/creator/prompt_engine.ts tests/unit/creator-prompt-engine.test.ts
git commit -m "feat: add prompt export engine"
```

---

### Task 3: Expose engine registry and prompt export from `atlas-creator`

**Files:**
- Modify: `supabase/functions/atlas-creator/index.ts`
- Test: `tests/unit/creator-creative-engine.test.ts`
- Test: `tests/unit/creator-prompt-engine.test.ts`

**Interfaces:**
- Consumes: `adaptProviderToCreativeEngine`, `PROMPT_EXPORT_ENGINE`, `compilePromptExport`.
- Produces HTTP contracts:
  - `GET ?api=engines` -> `{ ok: true, engines: CreativeEngineReadiness[] }`
  - `POST ?api=prompt-export` -> `{ ok: true, prompt_package: PromptExportPackage }`
- `GET ?api=providers` remains unchanged for ATLAS Director compatibility.

- [ ] **Step 1: Add pure contract assertions before route wiring**

Extend `tests/unit/creator-creative-engine.test.ts` with:

```ts
import { PROMPT_EXPORT_ENGINE } from '../../packages/creator/prompt_engine';

it('keeps prompt export visibly distinct from real generation engines', () => {
  expect(PROMPT_EXPORT_ENGINE.ready).toBe(true);
  expect(PROMPT_EXPORT_ENGINE.executionClass).toBe('prompt-export-only');
  expect(PROMPT_EXPORT_ENGINE.capabilityNotes).toContain('no-media-generation');
});
```

Extend `tests/unit/creator-prompt-engine.test.ts` with:

```ts
it('rejects a brief shorter than eight characters', () => {
  expect(() => compilePromptExport({ mediaKind: 'image', brief: 'short' })).toThrow('creative_brief_too_short');
});
```

- [ ] **Step 2: Run focused tests and verify the new assertions pass against the pure domain**

```bash
npx vitest run tests/unit/creator-creative-engine.test.ts tests/unit/creator-prompt-engine.test.ts
```

Expected: PASS. These tests pin the semantics before route wiring.

- [ ] **Step 3: Wire imports and handlers in `atlas-creator`**

Modify `supabase/functions/atlas-creator/index.ts` to import:

```ts
import { adaptProviderToCreativeEngine } from '../../../packages/creator/creative_engine.ts';
import { compilePromptExport, PROMPT_EXPORT_ENGINE } from '../../../packages/creator/prompt_engine.ts';
```

Add:

```ts
async function handleEngines(req: Request) {
  const ctx = await creatorContext(req, 'creator.read');
  const providers = await listProviderReadiness(ctx.orgId);
  return json({
    ok: true,
    engines: [PROMPT_EXPORT_ENGINE, ...providers.map(adaptProviderToCreativeEngine)]
  });
}

async function handlePromptExport(req: Request) {
  const ctx = await creatorContext(req, 'creator.write');
  const body = await bodyJson(req);
  const promptPackage = compilePromptExport({
    mediaKind: body.media_kind,
    brief: String(body.brief || ''),
    aspectRatio: body.aspect_ratio ? String(body.aspect_ratio) : undefined,
    destination: body.destination ? String(body.destination) : undefined,
    language: body.language ? String(body.language) : undefined,
    negativeConstraints: Array.isArray(body.negative_constraints)
      ? body.negative_constraints.map((value: unknown) => String(value))
      : undefined
  });
  await writeCreatorAudit(ctx.orgId, ctx.userId, 'creator.prompt.exported', null, {
    media_kind: promptPackage.mediaKind,
    engine_id: promptPackage.engineId
  });
  return json({ ok: true, prompt_package: promptPackage });
}
```

Wrap `compilePromptExport` validation errors so `creative_brief_too_short` becomes a safe `422` response:

```ts
try {
  // compile request
} catch (error) {
  if (error instanceof Error && error.message === 'creative_brief_too_short') {
    throw creatorError('creative_brief_too_short', 422);
  }
  throw error;
}
```

Add route entries before the final 404:

```ts
if (api === 'engines' && req.method === 'GET') return handleEngines(req);
if (api === 'prompt-export' && req.method === 'POST') return handlePromptExport(req);
```

Do not modify `handleSubmit`, `GET ?api=providers`, or existing provider validation.

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Run Creator unit regressions**

```bash
npx vitest run tests/unit/creator-creative-engine.test.ts tests/unit/creator-prompt-engine.test.ts tests/unit/atlas-director-domain.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add supabase/functions/atlas-creator/index.ts tests/unit/creator-creative-engine.test.ts tests/unit/creator-prompt-engine.test.ts
git commit -m "feat: expose creative engine registry"
```

---

### Task 4: Add authenticated browser APIs and merge verified native readiness

**Files:**
- Modify: `apps/web/src/lib/creatorApi.ts`
- Modify: `tests/unit/creator-api.test.ts`

**Interfaces:**
- Consumes: `CreativeEngineReadiness`, `PromptExportRequest`, `PromptExportPackage`, `adaptNativeReadiness`, existing `getNativeCreatorReadiness()`.
- Produces: `listCreativeEngines(): Promise<CreativeEngineReadiness[]>`, `exportCreatorPrompt(request): Promise<PromptExportPackage>`.

- [ ] **Step 1: Extend the browser API tests first**

Modify imports in `tests/unit/creator-api.test.ts`:

```ts
import {
  exportCreatorPrompt,
  listCreativeEngines,
  listCreatorProviders
} from '../../apps/web/src/lib/creatorApi';
```

Add:

```ts
it('loads the generalized engine registry with bearer authentication', async () => {
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
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'native_composer_not_configured' }), { status: 503 }));
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
  const result = await exportCreatorPrompt({ mediaKind: 'image', brief: 'ATLAS launch visual' });
  expect(result.status).toBe('prompt-ready');
  expect(String(fetchMock.mock.calls[0][0])).toContain('/functions/v1/atlas-creator?api=prompt-export');
  expect(String(fetchMock.mock.calls[0][0])).not.toContain('submit');
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
npx vitest run tests/unit/creator-api.test.ts
```

Expected: FAIL because `listCreativeEngines` and `exportCreatorPrompt` do not exist.

- [ ] **Step 3: Implement browser methods**

Modify `apps/web/src/lib/creatorApi.ts` imports:

```ts
import {
  adaptNativeReadiness,
  type CreativeEngineReadiness
} from '../../../../packages/creator/creative_engine';
import type {
  PromptExportPackage,
  PromptExportRequest
} from '../../../../packages/creator/prompt_engine';
```

Add:

```ts
export async function listCreativeEngines(): Promise<CreativeEngineReadiness[]> {
  const data = await creatorRequest<{ ok: true; engines: CreativeEngineReadiness[] }>('engines');
  const engines = data.engines.slice();
  try {
    const native = await getNativeCreatorReadiness();
    engines.push(adaptNativeReadiness(native));
  } catch {
    // Native readiness is optional; failure must not be converted into a fake ready engine.
  }
  return engines;
}

export async function exportCreatorPrompt(request: PromptExportRequest): Promise<PromptExportPackage> {
  const data = await creatorRequest<{ ok: true; prompt_package: PromptExportPackage }>('prompt-export', {}, {
    method: 'POST',
    body: JSON.stringify({
      media_kind: request.mediaKind,
      brief: request.brief,
      aspect_ratio: request.aspectRatio,
      destination: request.destination,
      language: request.language,
      negative_constraints: request.negativeConstraints
    })
  });
  return data.prompt_package;
}
```

The `catch` around native readiness must only omit the native engine; it must not convert a failed probe to `ready`.

- [ ] **Step 4: Run browser API tests**

```bash
npx vitest run tests/unit/creator-api.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add apps/web/src/lib/creatorApi.ts tests/unit/creator-api.test.ts
git commit -m "feat: add creative engine browser api"
```

---

### Task 5: Add zero-cost prompt export to the existing Creator UI

**Files:**
- Modify: `apps/web/src/modules/creator/CreatorStudioPage.tsx`
- Modify: `tests/integration/atlas-creator-route.test.tsx`

**Interfaces:**
- Consumes: `listCreativeEngines()`, `exportCreatorPrompt()`, existing `CreatorWorkspace`, existing `CreatorProviders`.
- Produces: a real prompt-export action for non-video media when no generation engine is verified, and generalized engine readiness in the Provider screen.

- [ ] **Step 1: Add failing integration tests**

Extend `tests/integration/atlas-creator-route.test.tsx`:

```ts
it('offers prompt export without pretending that image generation is live', async () => {
  vi.spyOn(creatorApi, 'listCreativeEngines').mockResolvedValue([{
    engineId: 'prompt-export',
    displayName: 'Prompt Export',
    executionClass: 'prompt-export-only',
    connectionState: 'ready',
    ready: true,
    mediaKinds: ['image', 'video', 'music', 'voice', 'sfx', 'graphic', 'template'],
    capabilityNotes: ['planning-only', 'no-media-generation'],
    lastVerifiedAt: null
  }]);
  vi.spyOn(creatorApi, 'exportCreatorPrompt').mockResolvedValue({
    status: 'prompt-ready',
    engineId: 'prompt-export',
    mediaKind: 'image',
    prompt: 'MEDIA: image\nOBJECTIVE: Futuristic ATLAS finance hero image',
    parameters: { language: 'English', negativeConstraints: [] },
    adaptationNotes: ['No media was generated.']
  });
  render(<MemoryRouter initialEntries={['/studio/create?type=image']}><CreatorWorkspace /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Creative brief'), {
    target: { value: 'Futuristic ATLAS finance hero image' }
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Export prompt package' }));
  expect(await screen.findByText(/MEDIA: image/)).toBeInTheDocument();
  expect(screen.getByText(/No media was generated/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Generate image' })).toBeDisabled();
});

it('shows prompt export and verified native readiness as distinct engine classes', async () => {
  vi.spyOn(creatorApi, 'listCreativeEngines').mockResolvedValue([
    {
      engineId: 'prompt-export',
      displayName: 'Prompt Export',
      executionClass: 'prompt-export-only',
      connectionState: 'ready',
      ready: true,
      mediaKinds: ['image'],
      capabilityNotes: ['planning-only'],
      lastVerifiedAt: null
    },
    {
      engineId: 'atlas-native',
      displayName: 'ATLAS Native',
      executionClass: 'self-hosted',
      connectionState: 'ready',
      ready: true,
      mediaKinds: ['video'],
      capabilityNotes: ['motion-composition-v1'],
      lastVerifiedAt: '2026-09-15T12:00:00Z'
    }
  ]);
  render(<MemoryRouter><CreatorProviders /></MemoryRouter>);
  expect(await screen.findByText('Prompt Export')).toBeInTheDocument();
  expect(screen.getByText('prompt-export-only')).toBeInTheDocument();
  expect(screen.getByText('ATLAS Native')).toBeInTheDocument();
  expect(screen.getByText('self-hosted')).toBeInTheDocument();
});
```

Retain all existing assertions that external providers remain unconfigured when appropriate and that ATLAS Director still opens for `?type=video`.

- [ ] **Step 2: Run the integration test and verify failure**

```bash
npx vitest run tests/integration/atlas-creator-route.test.tsx
```

Expected: FAIL because `CreatorWorkspace` and `CreatorProviders` do not use the new APIs.

- [ ] **Step 3: Update `CreatorWorkspace` without changing the video branch**

In `CreatorStudioPage.tsx`:

1. Keep this early return unchanged in behavior:

```ts
if (kind === 'video') return <DirectorWorkspace />;
```

2. Import `listCreativeEngines` and `exportCreatorPrompt`.
3. Load engine readiness for the selected non-video `kind`.
4. Keep the existing `Generate {kind}` button disabled unless a real executable generation engine for that media kind is verified.
5. Add a separate `Export prompt package` button when the brief is valid and the prompt-export engine is available.
6. On export success, render the returned prompt and `adaptationNotes` in the preview panel.
7. Do not create or display a fake `CreatorAsset`, generation job ID, output URL, or “generated” status for prompt export.

The non-video workspace state should include:

```ts
const [engines, setEngines] = useState<CreativeEngineReadiness[]>([]);
const [promptPackage, setPromptPackage] = useState<PromptExportPackage | null>(null);
const [exportState, setExportState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
```

The export handler should use:

```ts
const exported = await exportCreatorPrompt({
  mediaKind: kind,
  brief: prompt,
  language: 'English'
});
setPromptPackage(exported);
setExportState('success');
```

- [ ] **Step 4: Update `CreatorProviders` to list generalized engines**

Replace the data source for the Provider-readiness screen with `listCreativeEngines()` while preserving truthful state text.

Each engine card must show at minimum:

```tsx
<h2>{engine.displayName}</h2>
<p>{engine.executionClass}</p>
<span className="provider-state">{engine.connectionState}</span>
```

If `lastVerifiedAt` is null, render `Never verified` for engines that require readiness. For `prompt-export`, render copy that identifies it as planning-only rather than a generated-media engine.

- [ ] **Step 5: Run the integration test**

```bash
npx vitest run tests/integration/atlas-creator-route.test.tsx
```

Expected: PASS, including the existing ATLAS Director tests.

- [ ] **Step 6: Run related unit tests**

```bash
npx vitest run tests/unit/creator-api.test.ts tests/unit/creator-creative-engine.test.ts tests/unit/creator-prompt-engine.test.ts tests/unit/atlas-director-domain.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add apps/web/src/modules/creator/CreatorStudioPage.tsx tests/integration/atlas-creator-route.test.tsx
git commit -m "feat: add zero-cost prompt export to creator"
```

---

### Task 6: Full verification and Phase 1 completion gate

**Files:**
- No feature files should be added in this task.
- Modify only files required to fix a verified regression discovered by the commands below, with the regression and fix covered by a test before commit.

**Interfaces:**
- Consumes the complete Phase 1 implementation.
- Produces verification evidence suitable for PR review; it does not deploy automatically.

- [ ] **Step 1: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 2: Run all unit tests**

```bash
npm run test:unit
```

Expected: PASS.

- [ ] **Step 3: Run all integration tests**

```bash
npm run test:integration
```

Expected: PASS.

- [ ] **Step 4: Run production build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Run the combined Cloudflare verification command**

```bash
npm run verify:cloudflare
```

Expected: PASS. If `npm audit --audit-level=high` fails because of a real high-severity dependency issue, do not bypass it; report and resolve the dependency before production.

- [ ] **Step 6: Verify the required product invariants in tests**

Confirm all of these are represented by passing tests:

```text
/studio/create?type=video still opens ATLAS Director.
An unconfigured external provider is never shown ready.
Prompt Export can produce a prompt package without a generation job or CreatorAsset.
atlas-native is included only after the real native readiness probe succeeds.
Prompt Export is clearly labeled planning-only / no-media-generation.
Existing Creator routes remain unchanged.
```

- [ ] **Step 7: Commit any verification-only regression fix, if one was required**

If no fix was required, do not create an empty commit. If a fix was required:

```bash
git add <files changed by the verified regression fix>
git commit -m "fix: preserve creator zero-cost regressions"
```

- [ ] **Step 8: Prepare the Phase 1 review summary**

The review summary must contain the exact command results for:

```text
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
npm run verify:cloudflare
```

and explicitly state that Phase 1 does not yet claim local image/music/voice model installation, FFmpeg availability, or external publishing readiness.

---

## Program Boundary After Phase 1

Phase 1 is independently useful and reviewable. It gives ATLAS a truthful engine abstraction, preserves the verified zero-cost native renderer, and gives every supported media kind a zero-cost prompt-export outcome when generation is unavailable.

The remaining design program should be implemented as separate plans after Phase 1 passes review:

- Phase 2 — unified multimodal composer and richer CreativePlan orchestration.
- Phase 3 — Library provenance expansion and import/reference workflows.
- Phase 4 — verified FFmpeg media-processing adapter and composition/export operations.
- Phase 5 — optional local/self-hosted image, voice, and audio generation adapters with health checks and resource controls.
- Phase 6 — Brand Kit, export presets, and separately authorized publishing connectors.

Each later phase must retain the Phase 1 truthfulness invariant and must not advertise a runtime as ready until its own real readiness check passes.
