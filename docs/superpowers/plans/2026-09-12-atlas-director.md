# ATLAS Director Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing ATLAS Studio Video Lab into ATLAS Director: a governed, provider-neutral production workspace that structures, validates, persists, compiles, and truthfully gates video-generation requests without spending external-provider credits during planning.

**Architecture:** Keep `/studio/create?type=video` inside the existing Creator module as the browser entrypoint. Put provider-neutral domain contracts, permissions, validation, and compilation in a focused shared `packages/creator` package so React and Supabase Edge Functions consume the same types and deterministic rules; use a single authenticated `atlas-creator` Edge Function for organization-scoped persistence, readiness, audit, and the final submission gate. External provider calls remain server-side and fail closed until an authorized provider adapter is actually configured and verified.

**Tech Stack:** React 18.3.1, React Router 7.18.3, TypeScript 5.7, Vite 6.4.3, Vitest 3.2.6, Testing Library, Supabase Auth/Postgres/RLS/Edge Functions, Deno, GitHub Actions, Cloudflare production deployment.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-director-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Canonical branch: `main`; implementation branch: `feat/atlas-director`; draft PR: `#78`.
- Reuse the existing ATLAS Studio route graph and Creator module; do not create a parallel app or replacement Studio.
- Primary route remains `/studio/create?type=video` behind `RequireAtlasIdentity`.
- Use one canonical `ProductionSpec` as the source of truth for a video production.
- No provider may be displayed as `ready` unless an authorized server-side verification has succeeded.
- No generation result may be displayed until an actual provider result exists.
- No external-provider credits may be spent by planning, validation, compilation, draft saving, or cost/readiness inspection.
- Provider secrets, API tokens, private credentials, and service-role credentials remain server-side and are never committed or returned to the browser.
- Every persisted Creator row must be scoped to `organization_id` and must preserve tenant isolation through RLS plus server-side authorization.
- Use the existing `audit_logs` table for Creator audit events instead of creating a duplicate audit source of truth.
- Use explicit permissions: `creator.read`, `creator.write`, `creator.generate`, `creator.manage_providers`, `creator.publish`, `creator.admin`.
- Until a canonical permission-table resolver is shared across all ATLAS modules, map existing roles only at the `atlas-creator` server boundary: `owner`, `admin`, and `platform_admin` receive all Creator permissions; other active members receive `creator.read` only.
- Use accessible Move Up/Move Down controls for shot ordering; do not add a drag-and-drop dependency for this milestone.
- Cost estimates must be `null`/unavailable unless a verified provider adapter returns a current estimate. Do not hard-code the user's current OpenArt credit balance or stale provider prices into the product.
- Provider capability descriptors used for submission must come from the authenticated server readiness response. Static display labels may exist in the client, but static data must never promote a provider to `ready`.
- Run `npm ci`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm test`, and `npm run build` before requesting merge.
- Do not merge PR #78 or deploy production until the implementation checks pass and the repository owner approves the merge/deploy checkpoint.

---

## File Structure

Create or modify these focused units:

### Shared Creator domain

- `packages/creator/types.ts` — canonical production, scene, shot, continuity, provider, validation, job, asset, and permission types.
- `packages/creator/defaults.ts` — deterministic empty-draft and child-entity factories with injectable IDs/time for tests.
- `packages/creator/permissions.ts` — pure Creator permission helpers; no role-name checks inside domain code.
- `packages/creator/validator.ts` — deterministic production and provider-compatibility validation.
- `packages/creator/compiler.ts` — neutral prompt compiler plus provider-specific formatting adapters.
- `packages/creator/providers.ts` — provider IDs/display labels and prompt adapter registry; no secrets and no live readiness claims.

### Supabase persistence and server boundary

- `supabase/migrations/20260912_creator_director.sql` — productions, provider-instance metadata, generation jobs, assets, indexes, constraints, RLS, and read grants.
- `supabase/functions/atlas-creator/_shared/context.ts` — bearer authentication, active organization resolution, temporary role-to-Creator-permission mapping.
- `supabase/functions/atlas-creator/_shared/errors.ts` — normalized safe error responses.
- `supabase/functions/atlas-creator/_shared/repository.ts` — organization-scoped persistence and `audit_logs` writes.
- `supabase/functions/atlas-creator/index.ts` — thin API router for readiness, providers, productions, save, assets, and submit gate.

### Browser integration

- `apps/web/src/lib/creatorApi.ts` — authenticated API client for `atlas-creator`.
- `apps/web/src/modules/creator/director/directorState.ts` — reducer/actions/selectors for the local production edit session.
- `apps/web/src/modules/creator/director/DirectorWorkspace.tsx` — ATLAS Director shell, step navigation, save/validation orchestration.
- `apps/web/src/modules/creator/director/BriefSubjectEnvironment.tsx` — Creative Brief, Subject/Entity, and Environment editors.
- `apps/web/src/modules/creator/director/SceneShotEditor.tsx` — scene/shot CRUD, timing, ordering, camera/motion/lighting/material fields.
- `apps/web/src/modules/creator/director/ContinuityStyleAudio.tsx` — continuity rules, negative constraints, visual style, camera defaults, motion, and audio controls.
- `apps/web/src/modules/creator/director/ProviderGate.tsx` — authenticated provider readiness, compatibility, and cost display.
- `apps/web/src/modules/creator/director/ReviewPanel.tsx` — validation issues, deterministic compiled prompt, final submission gate.
- `apps/web/src/modules/creator/director/director.css` — responsive desktop/tablet/mobile Director layout and state styling.
- `apps/web/src/modules/creator/CreatorStudioPage.tsx` — route-query handling, integration of Director into the existing video tab, persisted Library/Providers data.
- `apps/web/src/modules/creator/creator.css` — only small shared Creator adjustments; keep Director-specific styles in `director.css`.

### Tests

- `tests/unit/atlas-director-domain.test.ts` — defaults, permissions, immutable editing helpers.
- `tests/unit/atlas-director-validator.test.ts` — duration, overlap, orientation, identity, provider compatibility, and negative-constraint rules.
- `tests/unit/atlas-director-compiler.test.ts` — deterministic neutral/provider prompt compilation.
- `tests/unit/creator-api.test.ts` — browser API request/auth/error contract.
- `tests/integration/atlas-director-schema-contract.test.ts` — migration/RLS/static schema contract.
- `tests/integration/atlas-director-edge-contract.test.ts` — Edge Function authorization, scope, no-secret, no-credit-spend contract.
- `tests/integration/atlas-creator-route.test.tsx` — existing Creator regression coverage plus full Video Lab/Director navigation and truthful provider states.

---

### Task 1: Create the shared ATLAS Director domain and permissions

**Files:**
- Create: `packages/creator/types.ts`
- Create: `packages/creator/defaults.ts`
- Create: `packages/creator/permissions.ts`
- Create: `tests/unit/atlas-director-domain.test.ts`

**Interfaces:**
- Produces `ProductionSpec`, `SubjectSpec`, `EnvironmentSpec`, `SceneSpec`, `ShotSpec`, `CameraSpec`, `VisualStyleSpec`, `MotionRule`, `AudioPlan`, `NegativeConstraint`, `ContinuityRule`, `ValidationIssue`, `ProviderId`, `ProviderConnectionState`, `ProviderCapability`, `ProviderReadiness`, `CompiledProviderRequest`, `CreatorPermission`.
- Produces `createEmptyProductionSpec(options?)`, `createEmptyScene(options?)`, `createEmptyShot(options?)`, `createEmptySubject(options?)`, `creatorPermissionsForRole(role)`, `hasCreatorPermission(permissions, permission)`, `requireCreatorPermission(permissions, permission)`.

- [ ] **Step 1: Write failing domain/default/permission tests**

Create `tests/unit/atlas-director-domain.test.ts` with these assertions:

```ts
import { describe, expect, it } from 'vitest';
import {
  createEmptyProductionSpec,
  createEmptyScene,
  createEmptyShot
} from '../../packages/creator/defaults';
import {
  creatorPermissionsForRole,
  hasCreatorPermission,
  requireCreatorPermission
} from '../../packages/creator/permissions';

describe('ATLAS Director domain', () => {
  it('creates an honest empty production draft', () => {
    const spec = createEmptyProductionSpec({
      id: 'prod-1',
      organizationId: 'org-1',
      createdByUserId: 'user-1',
      now: '2026-09-12T12:00:00.000Z'
    });
    expect(spec.status).toBe('draft');
    expect(spec.title).toBe('');
    expect(spec.brief).toBe('');
    expect(spec.durationSeconds).toBe(0);
    expect(spec.scenes).toEqual([]);
    expect(spec.version).toBe(1);
  });

  it('creates scene and shot children without fabricated creative content', () => {
    expect(createEmptyScene({ id: 'scene-1' }).description).toBe('');
    expect(createEmptyShot({ id: 'shot-1', order: 1 }).action).toBe('');
  });

  it('maps ATLAS administrative roles to Creator permissions only at the boundary', () => {
    const admin = creatorPermissionsForRole('admin');
    const member = creatorPermissionsForRole('member');
    expect(hasCreatorPermission(admin, 'creator.generate')).toBe(true);
    expect(hasCreatorPermission(member, 'creator.read')).toBe(true);
    expect(hasCreatorPermission(member, 'creator.write')).toBe(false);
    expect(() => requireCreatorPermission(member, 'creator.write'))
      .toThrow('authorization_denied');
  });
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

```bash
npx vitest run tests/unit/atlas-director-domain.test.ts
```

Expected: FAIL because `packages/creator/*` does not exist.

- [ ] **Step 3: Implement canonical types**

In `packages/creator/types.ts`, define the status and permission vocabulary exactly:

```ts
export type ProductionStatus =
  | 'draft'
  | 'validating'
  | 'blocked'
  | 'ready'
  | 'submitting'
  | 'generating'
  | 'completed'
  | 'failed';

export type CreatorPermission =
  | 'creator.read'
  | 'creator.write'
  | 'creator.generate'
  | 'creator.manage_providers'
  | 'creator.publish'
  | 'creator.admin';

export type ProviderId = 'seedance' | 'veo' | 'kling' | 'wan' | 'minimax';

export type ProviderConnectionState =
  | 'unconfigured'
  | 'configured-unverified'
  | 'ready'
  | 'unavailable'
  | 'insufficient-credit'
  | 'error';
```

Define `ProductionSpec` with every field from the approved spec. Use arrays for subjects/scenes/continuity rules/negative constraints and use nullable provider data instead of fabricated defaults:

```ts
export type ProductionSpec = {
  id: string;
  organizationId: string;
  createdByUserId: string;
  title: string;
  brief: string;
  status: ProductionStatus;
  durationSeconds: number;
  aspectRatio: 'adaptive' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9';
  resolutionPreference: 'adaptive' | '480p' | '720p' | '1080p' | '2k' | '4k';
  audioEnabled: boolean;
  subjects: SubjectSpec[];
  environment: EnvironmentSpec;
  scenes: SceneSpec[];
  continuityRules: ContinuityRule[];
  visualStyle: VisualStyleSpec;
  cameraDefaults: CameraSpec;
  motionRules: MotionRule[];
  audioPlan: AudioPlan;
  negativeConstraints: NegativeConstraint[];
  providerPreference: ProviderId | null;
  providerOverrides: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  version: number;
};
```

Use the approved field names for `SubjectSpec`, `EnvironmentSpec`, `SceneSpec`, `ShotSpec`, `CameraSpec`, `VisualStyleSpec`, `MotionRule`, `AudioPlan`, `NegativeConstraint`, and `ContinuityRule`. Add no provider secrets to any type.

- [ ] **Step 4: Implement empty factories**

In `packages/creator/defaults.ts`, use injectable IDs/time so tests remain deterministic:

```ts
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export function createEmptyProductionSpec(options: {
  id?: string;
  organizationId?: string;
  createdByUserId?: string;
  now?: string;
} = {}): ProductionSpec {
  const timestamp = options.now ?? now();
  return {
    id: options.id ?? id(),
    organizationId: options.organizationId ?? '',
    createdByUserId: options.createdByUserId ?? '',
    title: '',
    brief: '',
    status: 'draft',
    durationSeconds: 0,
    aspectRatio: 'adaptive',
    resolutionPreference: 'adaptive',
    audioEnabled: true,
    subjects: [],
    environment: {
      locationDescription: '',
      timeOfDay: '',
      lightingEnvironment: '',
      weatherOrAtmosphere: '',
      backgroundConstraints: [],
      referenceAssetIds: []
    },
    scenes: [],
    continuityRules: [],
    visualStyle: {
      photorealismLevel: '', cinematicStyle: '', textureStyle: '',
      colorPalette: '', contrastStyle: '', filmLook: '', grain: '',
      halation: '', surfaceDetail: '', lightingStyle: ''
    },
    cameraDefaults: {
      framing: '', angle: '', position: '', lens: '', focalLengthMm: null,
      depthOfField: '', movement: '', movementSpeed: '', focusTarget: '',
      orientationRule: ''
    },
    motionRules: [],
    audioPlan: {
      musicDescription: '', ambientSound: '', soundEffects: [], dialogue: [],
      voiceReferenceAssetIds: [], syncRules: []
    },
    negativeConstraints: [],
    providerPreference: null,
    providerOverrides: {},
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1
  };
}
```

`createEmptyScene`, `createEmptyShot`, and `createEmptySubject` must use empty strings/arrays rather than invented creative values.

- [ ] **Step 5: Implement pure permission helpers**

In `packages/creator/permissions.ts`:

```ts
const ALL: CreatorPermission[] = [
  'creator.read', 'creator.write', 'creator.generate',
  'creator.manage_providers', 'creator.publish', 'creator.admin'
];

export function creatorPermissionsForRole(role: string): CreatorPermission[] {
  return ['owner', 'admin', 'platform_admin'].includes(role) ? [...ALL] : ['creator.read'];
}

export function hasCreatorPermission(
  permissions: readonly CreatorPermission[],
  permission: CreatorPermission
) {
  return permissions.includes('creator.admin') || permissions.includes(permission);
}

export function requireCreatorPermission(
  permissions: readonly CreatorPermission[],
  permission: CreatorPermission
) {
  if (!hasCreatorPermission(permissions, permission)) throw new Error('authorization_denied');
}
```

Do not check role names anywhere else in the shared domain package.

- [ ] **Step 6: Run focused tests and typecheck**

```bash
npx vitest run tests/unit/atlas-director-domain.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/creator tests/unit/atlas-director-domain.test.ts
git commit -m "feat(creator): add ATLAS Director domain contracts"
```

---

### Task 2: Implement the deterministic continuity and production validator

**Files:**
- Create: `packages/creator/validator.ts`
- Create: `tests/unit/atlas-director-validator.test.ts`

**Interfaces:**
- Consumes: `ProductionSpec`, `ProviderCapability` from Task 1.
- Produces: `validateProductionSpec(spec, provider?): ValidationResult`.
- Produces: `ValidationResult = { status: 'pass' | 'warning' | 'blocking'; issues: ValidationIssue[] }`.

- [ ] **Step 1: Write failing validator tests**

Create `tests/unit/atlas-director-validator.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyProductionSpec, createEmptyScene, createEmptyShot } from '../../packages/creator/defaults';
import { validateProductionSpec } from '../../packages/creator/validator';

function validBase() {
  const spec = createEmptyProductionSpec({ id: 'p1' });
  spec.title = 'Launch spot';
  spec.brief = 'A governed cinematic ATLAS launch sequence.';
  spec.durationSeconds = 10;
  const scene = createEmptyScene({ id: 's1' });
  scene.title = 'Launch';
  scene.startSecond = 0;
  scene.endSecond = 10;
  const shot = createEmptyShot({ id: 'sh1', order: 1 });
  shot.title = 'Opening';
  shot.startSecond = 0;
  shot.endSecond = 5;
  shot.action = 'ATLAS mark emerges from darkness.';
  scene.shots = [shot];
  spec.scenes = [scene];
  return spec;
}

describe('validateProductionSpec', () => {
  it('blocks impossible production timing', () => {
    const spec = validBase();
    spec.scenes[0].shots[0].endSecond = 12;
    const result = validateProductionSpec(spec);
    expect(result.status).toBe('blocking');
    expect(result.issues.some(i => i.code === 'shot_exceeds_production')).toBe(true);
  });

  it('blocks overlapping ordered shots in the same scene', () => {
    const spec = validBase();
    const second = createEmptyShot({ id: 'sh2', order: 2 });
    second.startSecond = 4;
    second.endSecond = 8;
    second.action = 'Second shot';
    spec.scenes[0].shots.push(second);
    expect(validateProductionSpec(spec).issues.some(i => i.code === 'shot_overlap')).toBe(true);
  });

  it('warns on an unexplained camera-axis reversal across continuous shots', () => {
    const spec = validBase();
    spec.scenes[0].shots[0].camera.orientationRule = 'front-facing';
    const second = createEmptyShot({ id: 'sh2', order: 2 });
    second.startSecond = 5;
    second.endSecond = 10;
    second.action = 'Continue motion';
    second.camera.orientationRule = 'rear-facing';
    second.transitionIn = 'continuous';
    spec.scenes[0].shots.push(second);
    const result = validateProductionSpec(spec);
    expect(result.issues.some(i => i.code === 'camera_axis_reversal')).toBe(true);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/atlas-director-validator.test.ts
```

Expected: FAIL because the validator does not exist.

- [ ] **Step 3: Implement deterministic validation helpers**

In `packages/creator/validator.ts`, create a small issue helper and enforce exact, structured rules only:

```ts
function issue(
  code: string,
  severity: 'warning' | 'blocking',
  section: string,
  message: string,
  targetId?: string
): ValidationIssue {
  return { code, severity, section, message, targetId: targetId ?? null };
}
```

Required blocking checks:

```ts
if (!spec.brief.trim()) issues.push(issue('brief_required', 'blocking', 'brief', 'Creative brief is required.'));
if (spec.durationSeconds <= 0) issues.push(issue('duration_invalid', 'blocking', 'brief', 'Duration must be greater than zero.'));
if (shot.endSecond <= shot.startSecond) issues.push(issue('shot_timing_invalid', 'blocking', 'shots', 'Shot end must be after shot start.', shot.id));
if (shot.endSecond > spec.durationSeconds) issues.push(issue('shot_exceeds_production', 'blocking', 'shots', 'Shot exceeds production duration.', shot.id));
```

Sort shots by `order`, then block overlap when `current.startSecond < previous.endSecond` within the same scene. Also validate scene timing against production timing.

For deterministic continuity warnings, compare explicit structured fields only. Example camera-axis rule:

```ts
if (
  previous.camera.orientationRule && current.camera.orientationRule &&
  previous.camera.orientationRule !== current.camera.orientationRule &&
  current.transitionIn === 'continuous'
) {
  issues.push(issue(
    'camera_axis_reversal', 'warning', 'continuity',
    'Camera orientation changes during a continuous transition; confirm or add an explicit cut.',
    current.id
  ));
}
```

Add equivalent structured checks for motion direction changes, identity-locked subject disappearance, and exact positive/negative string collisions. Do not use probabilistic AI review in this task.

- [ ] **Step 4: Add provider compatibility checks**

When a `ProviderCapability` is supplied:

```ts
if (provider.connectionState !== 'ready') {
  issues.push(issue('provider_not_ready', 'blocking', 'provider', 'Selected provider is not verified ready.'));
}
if (provider.maxDurationSeconds !== null && spec.durationSeconds > provider.maxDurationSeconds) {
  issues.push(issue('provider_duration_unsupported', 'blocking', 'provider', 'Requested duration exceeds provider capability.'));
}
if (spec.audioEnabled && !provider.audioSupport) {
  issues.push(issue('provider_audio_unsupported', 'warning', 'provider', 'Provider does not support native synchronized audio.'));
}
```

Reference-count checks must use the capability descriptor returned by the server, never assumptions from the browser.

- [ ] **Step 5: Return stable overall status**

```ts
const status = issues.some(i => i.severity === 'blocking')
  ? 'blocking'
  : issues.some(i => i.severity === 'warning')
    ? 'warning'
    : 'pass';
return { status, issues };
```

- [ ] **Step 6: Run tests and typecheck**

```bash
npx vitest run tests/unit/atlas-director-validator.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/creator/validator.ts tests/unit/atlas-director-validator.test.ts
git commit -m "feat(creator): add Director continuity validation"
```

---

### Task 3: Build the neutral prompt compiler and provider adapter registry

**Files:**
- Create: `packages/creator/providers.ts`
- Create: `packages/creator/compiler.ts`
- Create: `tests/unit/atlas-director-compiler.test.ts`

**Interfaces:**
- Consumes: `ProductionSpec`, `ProviderId`, `ProviderCapability`.
- Produces: `compileNeutralProduction(spec): string`.
- Produces: `compileProviderRequest(spec, providerId, capability?): CompiledProviderRequest`.
- Produces: `providerLabel(providerId): string` and `providerAdapter(providerId)`.

- [ ] **Step 1: Write failing deterministic compiler tests**

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyProductionSpec, createEmptyScene, createEmptyShot } from '../../packages/creator/defaults';
import { compileNeutralProduction, compileProviderRequest } from '../../packages/creator/compiler';

function production() {
  const spec = createEmptyProductionSpec({ id: 'p1' });
  spec.title = 'ATLAS Launch';
  spec.brief = 'Cinematic ATLAS launch.';
  spec.durationSeconds = 8;
  spec.negativeConstraints.push({ id: 'n1', scope: 'production', value: 'No text in frame', severity: 'warning' });
  const scene = createEmptyScene({ id: 's1' });
  scene.title = 'Reveal';
  scene.startSecond = 0;
  scene.endSecond = 8;
  const shot = createEmptyShot({ id: 'sh1', order: 1 });
  shot.title = 'Macro reveal';
  shot.startSecond = 0;
  shot.endSecond = 8;
  shot.action = 'Metal surfaces assemble into the ATLAS emblem.';
  scene.shots = [shot];
  spec.scenes = [scene];
  return spec;
}

describe('ATLAS Director compiler', () => {
  it('is deterministic for the same production version', () => {
    const spec = production();
    expect(compileNeutralProduction(spec)).toBe(compileNeutralProduction(spec));
  });

  it('preserves ordered sections and negative constraints', () => {
    const prompt = compileNeutralProduction(production());
    expect(prompt.indexOf('OBJECTIVE')).toBeLessThan(prompt.indexOf('SCENE PLAN'));
    expect(prompt).toContain('No text in frame');
  });

  it('compiles provider-specific payload without claiming readiness', () => {
    const compiled = compileProviderRequest(production(), 'seedance');
    expect(compiled.providerId).toBe('seedance');
    expect(compiled.prompt).toContain('ATLAS Launch');
    expect(compiled.readinessClaim).toBe(false);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/atlas-director-compiler.test.ts
```

Expected: FAIL because compiler/registry files do not exist.

- [ ] **Step 3: Implement provider registry without live state**

In `packages/creator/providers.ts`, keep only stable identity/formatting metadata:

```ts
const PROVIDERS: Record<ProviderId, { label: string; promptDialect: string }> = {
  seedance: { label: 'Seedance', promptDialect: 'cinematic-structured' },
  veo: { label: 'Veo', promptDialect: 'cinematic-structured' },
  kling: { label: 'Kling', promptDialect: 'shot-structured' },
  wan: { label: 'Wan', promptDialect: 'shot-structured' },
  minimax: { label: 'MiniMax', promptDialect: 'cinematic-structured' }
};
```

Do not put connection state, credit balance, cost, or last-verified timestamps in this static registry.

- [ ] **Step 4: Implement canonical neutral compilation order**

`compileNeutralProduction` must emit sections in this exact order:

```ts
const sections = [
  ['OBJECTIVE', objective(spec)],
  ['OUTPUT', output(spec)],
  ['SUBJECT IDENTITY', subjects(spec)],
  ['ENVIRONMENT', environment(spec)],
  ['SCENE PLAN', scenes(spec)],
  ['SHOT PLAN', shots(spec)],
  ['VISUAL STYLE', visualStyle(spec)],
  ['CAMERA & MOTION', cameraMotion(spec)],
  ['AUDIO', audio(spec)],
  ['CONTINUITY CONTRACT', continuity(spec)],
  ['NEGATIVE CONSTRAINTS', negativeConstraints(spec)],
  ['OUTPUT RESTRICTIONS', outputRestrictions(spec)]
];
return sections.map(([name, body]) => `${name}\n${body || 'Not specified.'}`).join('\n\n');
```

`Not specified.` is an explicit state, not fabricated creative content.

- [ ] **Step 5: Implement provider-specific formatting**

`compileProviderRequest` may reorganize labels/wording for each provider, but must never change the canonical meaning or invent unsupported settings. Return:

```ts
{
  providerId,
  prompt,
  normalizedParams: {
    durationSeconds: spec.durationSeconds,
    aspectRatio: spec.aspectRatio,
    resolutionPreference: spec.resolutionPreference,
    audioEnabled: spec.audioEnabled
  },
  unsupportedFeatures: [],
  adaptationNotes: [],
  readinessClaim: false
}
```

If a verified `ProviderCapability` is passed, populate `unsupportedFeatures` and `adaptationNotes` from deterministic compatibility checks; `readinessClaim` may be `true` only when `capability.connectionState === 'ready'`.

- [ ] **Step 6: Run tests and typecheck**

```bash
npx vitest run tests/unit/atlas-director-compiler.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/creator/providers.ts packages/creator/compiler.ts tests/unit/atlas-director-compiler.test.ts
git commit -m "feat(creator): compile provider-neutral video productions"
```

---

### Task 4: Add Supabase Creator persistence, provider metadata, jobs, assets, and RLS

**Files:**
- Create: `supabase/migrations/20260912_creator_director.sql`
- Create: `tests/integration/atlas-director-schema-contract.test.ts`

**Interfaces:**
- Produces tables `creator_productions`, `creator_provider_instances`, `creator_generation_jobs`, `creator_assets`.
- Reuses existing `organizations`, `organization_members`, and `audit_logs`.
- Does not store provider secrets.

- [ ] **Step 1: Write a failing schema contract test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20260912_creator_director.sql', 'utf8');

describe('ATLAS Director schema contract', () => {
  it('creates organization-scoped Creator tables with RLS', () => {
    for (const table of [
      'creator_productions',
      'creator_provider_instances',
      'creator_generation_jobs',
      'creator_assets'
    ]) expect(sql).toContain(`public.${table}`);
    expect(sql.match(/enable row level security/g)?.length).toBe(4);
    expect(sql).toContain('organization_members');
    expect(sql).toContain('auth.uid()');
  });

  it('does not create secret-bearing columns', () => {
    expect(sql).not.toMatch(/api_key|access_token|refresh_token|private_key|provider_secret/i);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/atlas-director-schema-contract.test.ts
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement `creator_productions`**

Use a JSONB canonical spec while keeping key indexable metadata:

```sql
create table if not exists public.creator_productions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null,
  title text not null default '',
  brief text not null default '',
  status text not null default 'draft' check (status in ('draft','validating','blocked','ready','submitting','generating','completed','failed')),
  duration_seconds numeric not null default 0 check (duration_seconds >= 0),
  aspect_ratio text not null default 'adaptive',
  resolution_preference text not null default 'adaptive',
  audio_enabled boolean not null default true,
  production_spec_json jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- [ ] **Step 4: Implement provider-instance metadata without secrets**

```sql
create table if not exists public.creator_provider_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_id text not null check (provider_id in ('seedance','veo','kling','wan','minimax')),
  display_name text not null,
  state text not null default 'unconfigured' check (state in ('unconfigured','configured-unverified','ready','unavailable','insufficient-credit','error')),
  capability_json jsonb not null default '{}'::jsonb,
  cost_estimator_available boolean not null default false,
  last_verified_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider_id)
);
```

A provider row is metadata only; secret material belongs in environment/secret infrastructure outside these tables.

- [ ] **Step 5: Implement generation jobs and assets**

`creator_generation_jobs` must include organization, production, requested user, provider id, provider job reference, state, compiled prompt, normalized params JSON, estimated/actual cost JSON, safe error code/message, timestamps. `creator_assets` must link organization, production, generation job, storage path, media type, provider id/provider asset id, MIME/dimensions/duration, provenance JSON, timestamps.

Use constrained job status:

```sql
check (status in ('queued','submitted','generating','completed','failed','cancelled'))
```

Do not insert a job when submission is rejected before provider acceptance.

- [ ] **Step 6: Add indexes and RLS**

For all four tables:

```sql
alter table public.<table> enable row level security;
```

Authenticated reads require an active membership matching `organization_id` and `auth.uid()`. Do not grant direct browser writes in this milestone; writes go through `atlas-creator` where permission checks and audit are centralized. Example read policy:

```sql
create policy creator_productions_member_read
on public.creator_productions
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = creator_productions.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);
```

Grant `select` to `authenticated` and leave insert/update/delete unavailable to direct browser REST calls.

- [ ] **Step 7: Run schema contract and integration tests**

```bash
npx vitest run tests/integration/atlas-director-schema-contract.test.ts
npm run test:integration
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260912_creator_director.sql tests/integration/atlas-director-schema-contract.test.ts
git commit -m "feat(creator): add Director persistence and RLS"
```

---

### Task 5: Build the authenticated `atlas-creator` server boundary

**Files:**
- Create: `supabase/functions/atlas-creator/_shared/context.ts`
- Create: `supabase/functions/atlas-creator/_shared/errors.ts`
- Create: `supabase/functions/atlas-creator/_shared/repository.ts`
- Create: `supabase/functions/atlas-creator/index.ts`
- Create: `tests/integration/atlas-director-edge-contract.test.ts`

**Interfaces:**
- `resolveCreatorContext(req): Promise<{ sb; userId; orgId; role; permissions }>`.
- `listProductions(orgId)`, `getProduction(orgId, id)`, `saveProduction(ctx, spec, expectedVersion?)`.
- `listProviderReadiness(orgId)`, `listAssets(orgId)`.
- `writeCreatorAudit(orgId, userId, action, recordId, payload)`.
- HTTP APIs: `?api=readiness`, `providers`, `productions`, `production`, `save`, `assets`, `submit`.

- [ ] **Step 1: Write failing static Edge Function contract tests**

Create `tests/integration/atlas-director-edge-contract.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const index = readFileSync('supabase/functions/atlas-creator/index.ts', 'utf8');
const context = readFileSync('supabase/functions/atlas-creator/_shared/context.ts', 'utf8');
const repository = readFileSync('supabase/functions/atlas-creator/_shared/repository.ts', 'utf8');

describe('atlas-creator Edge contract', () => {
  it('requires bearer auth and active organization membership', () => {
    expect(context).toContain("req.headers.get('authorization')");
    expect(context).toContain("from('organization_members')");
    expect(context).toContain(".eq('status', 'active')");
  });

  it('keeps writes server-side and organization scoped', () => {
    expect(repository).toContain(".eq('organization_id', orgId)");
    expect(repository).toContain("from('audit_logs')");
    expect(repository).toContain("table_name: 'creator_director'");
  });

  it('does not contain provider secrets or direct OpenArt credentials', () => {
    expect(index).not.toMatch(/OPENART_API_KEY|provider_secret|private_key/i);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/atlas-director-edge-contract.test.ts
```

Expected: FAIL because the Edge Function does not exist.

- [ ] **Step 3: Implement authenticated context resolution**

Mirror the established Hospitality boundary, importing Creator permissions from the shared package:

```ts
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { creatorPermissionsForRole } from '../../../../packages/creator/permissions.ts';

export async function resolveCreatorContext(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) throw creatorError('authentication_required', 401);
  // create user-scoped client, get user, then query active organization_members
  // return { sb, userId, orgId, role, permissions: creatorPermissionsForRole(role) }
}
```

Use the request header `x-atlas-org-id` when present and valid; otherwise select the first active membership, matching current ATLAS behavior.

- [ ] **Step 4: Implement safe errors**

In `_shared/errors.ts`:

```ts
export function creatorError(code: string, status = 400, details: Record<string, unknown> = {}) {
  return Object.assign(new Error(code), { code, status, ...details });
}

export function safeCreatorError(error: any) {
  return {
    status: Number(error?.status || 500),
    body: { ok: false, error: String(error?.code || 'internal_error') }
  };
}
```

Never return raw provider response bodies, headers, tokens, stack traces, or service-role configuration.

- [ ] **Step 5: Implement organization-scoped repository methods**

Use a service-role client only inside this server module. Every query/update must include organization scope. Implement optimistic concurrency for saves:

```ts
export async function saveProduction(ctx: CreatorContext, spec: ProductionSpec, expectedVersion?: number) {
  if (spec.id) {
    let update = adminClient()
      .from('creator_productions')
      .update({
        title: spec.title,
        brief: spec.brief,
        status: spec.status,
        duration_seconds: spec.durationSeconds,
        aspect_ratio: spec.aspectRatio,
        resolution_preference: spec.resolutionPreference,
        audio_enabled: spec.audioEnabled,
        production_spec_json: spec,
        version: (expectedVersion ?? spec.version) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', ctx.orgId)
      .eq('id', spec.id);
    if (expectedVersion) update = update.eq('version', expectedVersion);
    const { data, error } = await update.select('*').maybeSingle();
    if (error) throw creatorError('persistence_failed', 500);
    if (!data) throw creatorError('version_conflict', 409);
    return data;
  }
  // insert organization_id=ctx.orgId and created_by=ctx.userId
}
```

Write `creator.production.created` / `creator.production.updated` audit events to existing `audit_logs`, with safe IDs/state/version metadata only.

- [ ] **Step 6: Implement readiness/providers endpoints**

Read `creator_provider_instances` for the active organization. For missing rows, return the five provider IDs as explicit `unconfigured` states with `capability: null`, `estimated_cost: null`, and `last_verified_at: null`. Missing configuration is a valid truthful response, not a server error.

- [ ] **Step 7: Implement production/list/assets endpoints**

Require `creator.read` for `readiness`, `providers`, `productions`, `production`, and `assets`. Require `creator.write` for `save`.

Use explicit routing:

```ts
if (api === 'readiness') return handleReadiness(req);
if (api === 'providers') return handleProviders(req);
if (api === 'productions') return handleProductions(req);
if (api === 'production') return handleProduction(req, url);
if (api === 'save') return handleSave(req);
if (api === 'assets') return handleAssets(req);
if (api === 'submit') return handleSubmit(req);
return json({ ok: false, error: 'not_found' }, 404);
```

- [ ] **Step 8: Implement the fail-closed submit boundary without external credit use**

`submit` must require `creator.generate`, load the persisted production, load the selected provider instance, call `validateProductionSpec` with the server capability descriptor, and reject before creating a job if any blocking issue exists.

Required behavior:

```ts
if (!provider || provider.state !== 'ready') {
  throw creatorError('provider_not_ready', 409);
}

const validation = validateProductionSpec(spec, capability);
if (validation.status === 'blocking') {
  throw creatorError('production_blocked', 409, { issues: validation.issues });
}

throw creatorError('provider_adapter_not_configured', 503);
```

That final error is the real dependency boundary for this milestone. Do not simulate submission, create a fake job, or spend provider credits.

- [ ] **Step 9: Run Edge contract plus integration tests**

```bash
npx vitest run tests/integration/atlas-director-edge-contract.test.ts
npm run test:integration
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add supabase/functions/atlas-creator tests/integration/atlas-director-edge-contract.test.ts
git commit -m "feat(creator): add authenticated Director backend boundary"
```

---

### Task 6: Add the authenticated browser API and local Director reducer

**Files:**
- Create: `apps/web/src/lib/creatorApi.ts`
- Create: `apps/web/src/modules/creator/director/directorState.ts`
- Create: `tests/unit/creator-api.test.ts`
- Modify: `tests/unit/atlas-director-domain.test.ts`

**Interfaces:**
- `creatorRequest<T>(api, params?, init?): Promise<T>`.
- `getCreatorReadiness()`, `listCreatorProviders()`, `listCreatorProductions()`, `getCreatorProduction(id)`, `saveCreatorProduction(spec, expectedVersion?)`, `listCreatorAssets()`, `submitCreatorProduction(productionId, providerId)`.
- `directorReducer(state, action)` plus selectors `canMoveNext`, `isDirty`.

- [ ] **Step 1: Write failing API and reducer tests**

API test:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listCreatorProviders } from '../../apps/web/src/lib/creatorApi';

beforeEach(() => {
  localStorage.setItem('atlas_access_token', 'test-token');
});

it('calls the authenticated atlas-creator providers endpoint', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, providers: [] }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  await listCreatorProviders();
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toContain('/functions/v1/atlas-creator?api=providers');
  expect((init.headers as Record<string, string>).authorization).toBe('Bearer test-token');
});
```

Reducer test additions:

```ts
const initial = createDirectorState(spec);
const withScene = directorReducer(initial, { type: 'scene.add', scene: createEmptyScene({ id: 's1' }) });
expect(withScene.spec.scenes).toHaveLength(1);
expect(withScene.dirty).toBe(true);
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/creator-api.test.ts tests/unit/atlas-director-domain.test.ts
```

Expected: FAIL because API/reducer files do not exist.

- [ ] **Step 3: Implement `creatorApi.ts` using the established ATLAS session pattern**

Mirror `hospitalityApi.ts`: use `getAtlasAccessToken()`, retry after `getActiveAtlasOrganization()` on 401, include publishable key, and throw normalized errors. Example:

```ts
export async function creatorRequest<T>(api: string, params = {}, init: RequestInit = {}): Promise<T> {
  let token = getAtlasAccessToken();
  if (!token) throw new Error('authentication_required');
  const url = `${SUPABASE_URL}/functions/v1/atlas-creator?${query({ api, ...params })}`;
  let response = await requestWithToken(url, init, token);
  if (response.status === 401) {
    await getActiveAtlasOrganization();
    token = getAtlasAccessToken();
    if (!token) throw new Error('session_expired');
    response = await requestWithToken(url, init, token);
  }
  return parseResponse(response) as Promise<T>;
}
```

Import canonical types from `../../../../packages/creator/types` rather than duplicating Creator domain types in the browser file.

- [ ] **Step 4: Implement reducer actions**

Support these actions exactly:

```ts
type DirectorAction =
  | { type: 'spec.replace'; spec: ProductionSpec }
  | { type: 'field.set'; field: 'title' | 'brief' | 'durationSeconds' | 'aspectRatio' | 'resolutionPreference' | 'audioEnabled'; value: unknown }
  | { type: 'subject.add'; subject: SubjectSpec }
  | { type: 'subject.update'; id: string; patch: Partial<SubjectSpec> }
  | { type: 'subject.remove'; id: string }
  | { type: 'scene.add'; scene: SceneSpec }
  | { type: 'scene.update'; id: string; patch: Partial<SceneSpec> }
  | { type: 'scene.remove'; id: string }
  | { type: 'shot.add'; sceneId: string; shot: ShotSpec }
  | { type: 'shot.update'; sceneId: string; shotId: string; patch: Partial<ShotSpec> }
  | { type: 'shot.remove'; sceneId: string; shotId: string }
  | { type: 'shot.move'; sceneId: string; shotId: string; direction: -1 | 1 }
  | { type: 'continuity.add'; rule: ContinuityRule }
  | { type: 'continuity.remove'; id: string }
  | { type: 'negative.add'; item: NegativeConstraint }
  | { type: 'negative.remove'; id: string }
  | { type: 'provider.select'; providerId: ProviderId | null }
  | { type: 'save.succeeded'; id: string; version: number; updatedAt: string };
```

Keep edits immutable and renumber shot `order` after moves/removals.

- [ ] **Step 5: Run unit tests and typecheck**

```bash
npx vitest run tests/unit/creator-api.test.ts tests/unit/atlas-director-domain.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/creatorApi.ts apps/web/src/modules/creator/director/directorState.ts tests/unit/creator-api.test.ts tests/unit/atlas-director-domain.test.ts
git commit -m "feat(creator): add Director API client and edit state"
```

---

### Task 7: Integrate the ATLAS Director shell into the existing Video Lab

**Files:**
- Create: `apps/web/src/modules/creator/director/DirectorWorkspace.tsx`
- Create: `apps/web/src/modules/creator/director/director.css`
- Modify: `apps/web/src/modules/creator/CreatorStudioPage.tsx`
- Modify: `tests/integration/atlas-creator-route.test.tsx`

**Interfaces:**
- `DirectorWorkspace` owns one local `ProductionSpec` edit session and the active step.
- Existing Image/Music/Voice composer behavior remains unchanged.
- Query parsing uses React Router `useSearchParams()` instead of reading `window.location.search` directly.

- [ ] **Step 1: Extend the existing integration test with a failing Video Lab expectation**

Add:

```tsx
it('opens ATLAS Director for the video Creator route', () => {
  render(
    <MemoryRouter initialEntries={['/studio/create?type=video']}>
      <CreatorWorkspace />
    </MemoryRouter>
  );
  expect(screen.getByRole('heading', { name: 'ATLAS Director' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Production steps' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save draft' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Generate video/i })).toBeDisabled();
});
```

Keep the existing test that Image Lab still shows `Not configured` and keeps `Generate image` disabled.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/atlas-creator-route.test.tsx
```

Expected: FAIL because the video route still renders the generic composer.

- [ ] **Step 3: Refactor query handling without changing route paths**

In `CreatorStudioPage.tsx`:

```tsx
const [searchParams] = useSearchParams();
const initial = searchParams.get('type');
```

When `kind === 'video'`, render:

```tsx
<DirectorWorkspace />
```

Keep the current generic composer for image/music/voice so existing functionality does not regress.

- [ ] **Step 4: Implement the Director shell and ten-step navigation**

Use exactly these steps:

```ts
const STEPS = [
  'Creative Brief',
  'Subject / Entity',
  'Environment',
  'Stages & Shots',
  'Continuity',
  'Visual Style',
  'Camera & Motion',
  'Audio',
  'Provider & Cost',
  'Review & Generate'
] as const;
```

The shell must expose Back/Next buttons, preserve reducer state across steps, display dirty/saved state, and render a real empty state before the user enters production data.

- [ ] **Step 5: Add responsive layout primitives**

In `director.css`, implement:

```css
.director-shell{display:grid;grid-template-columns:220px minmax(0,1fr) 320px;gap:16px}
.director-step-rail{position:sticky;top:16px;align-self:start}
.director-main{min-width:0}
.director-context{min-width:0}
@media(max-width:1050px){.director-shell{grid-template-columns:180px minmax(0,1fr)}.director-context{grid-column:1/-1}}
@media(max-width:720px){.director-shell{display:block}.director-step-rail{position:static;overflow:auto}.director-steps{display:flex}.director-context{margin-top:16px}}
```

Add visible focus states and do not depend on hover for any action.

- [ ] **Step 6: Implement Save Draft orchestration**

`Save draft` calls `saveCreatorProduction(state.spec, state.spec.version)` only when `creator.write` permission is present in readiness. On success dispatch `save.succeeded`; on `409 version_conflict`, show an error state and do not silently overwrite.

- [ ] **Step 7: Run integration test and typecheck**

```bash
npx vitest run tests/integration/atlas-creator-route.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/modules/creator/director apps/web/src/modules/creator/CreatorStudioPage.tsx tests/integration/atlas-creator-route.test.tsx
git commit -m "feat(creator): add ATLAS Director Video Lab shell"
```

---

### Task 8: Implement all production editors, scene/shot CRUD, and continuity controls

**Files:**
- Create: `apps/web/src/modules/creator/director/BriefSubjectEnvironment.tsx`
- Create: `apps/web/src/modules/creator/director/SceneShotEditor.tsx`
- Create: `apps/web/src/modules/creator/director/ContinuityStyleAudio.tsx`
- Modify: `apps/web/src/modules/creator/director/DirectorWorkspace.tsx`
- Modify: `apps/web/src/modules/creator/director/director.css`
- Modify: `tests/integration/atlas-creator-route.test.tsx`

**Interfaces:**
- Components receive `{ spec, dispatch }` and do not own duplicate production state.
- Shot reordering uses reducer action `shot.move` only.
- Every visible form control updates the canonical `ProductionSpec`.

- [ ] **Step 1: Write failing interactive integration tests**

Add tests using `fireEvent`:

```tsx
it('edits the brief and keeps it while moving between Director steps', () => {
  render(<MemoryRouter initialEntries={['/studio/create?type=video']}><CreatorWorkspace /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Creative brief'), { target: { value: 'ATLAS payroll cinematic launch' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByLabelText('Creative brief')).toHaveValue('ATLAS payroll cinematic launch');
});

it('adds and reorders shots with accessible controls', () => {
  // navigate to Stages & Shots, add scene, add two shots
  // assert Move up/Move down changes the displayed order labels
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/atlas-creator-route.test.tsx
```

Expected: FAIL because step editors are not implemented.

- [ ] **Step 3: Implement Creative Brief / Subject / Environment editors**

Required controls:

```tsx
<label>
  <span>Creative brief</span>
  <textarea aria-label="Creative brief" value={spec.brief} onChange={...} />
</label>
```

Subject cards must support Add, Edit, Remove; expose identity lock, appearance traits, material traits, allowed transformations, forbidden changes, and reference asset IDs as editable text/list controls. Environment controls must cover every approved `EnvironmentSpec` field.

- [ ] **Step 4: Implement scene and shot CRUD**

Scene card actions: Add scene, Remove scene, Add shot. Shot card actions: Duplicate shot, Remove, Move up, Move down. Do not add drag/drop.

Every shot editor exposes timing and approved fields. At minimum:

```tsx
<input type="number" step="0.1" aria-label="Shot start" value={shot.startSecond} onChange={...} />
<input type="number" step="0.1" aria-label="Shot end" value={shot.endSecond} onChange={...} />
<textarea aria-label="Shot action" value={shot.action} onChange={...} />
<input aria-label="Camera framing" value={shot.camera.framing} onChange={...} />
<input aria-label="Camera orientation rule" value={shot.camera.orientationRule} onChange={...} />
```

Duplicate must create a new ID and increment order without mutating the original shot ID.

- [ ] **Step 5: Implement continuity and negative constraints**

Continuity controls create explicit `ContinuityRule` rows with rule type, optional subject, description, start/end shot, and severity. Negative constraints create explicit scope/value/severity rows. Remove buttons must work.

- [ ] **Step 6: Implement visual style, camera defaults, motion, and audio controls**

Map every field from `VisualStyleSpec`, `CameraSpec`, `MotionRule`, and `AudioPlan` to controlled inputs. Avoid fixed creative presets that would imply user choices; optional quick presets may be added only if selecting them visibly changes the underlying fields and can be cleared.

- [ ] **Step 7: Add validation context panel**

Run `validateProductionSpec(spec)` on memoized state. Show issue chips by severity and provide a `Go to section` button that changes the active step based on `issue.section`.

- [ ] **Step 8: Run tests and typecheck**

```bash
npx vitest run tests/integration/atlas-creator-route.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/modules/creator/director tests/integration/atlas-creator-route.test.tsx
git commit -m "feat(creator): add Director production editors and shot planning"
```

---

### Task 9: Implement Provider & Cost, Review & Generate, Library provenance, and provider readiness UI

**Files:**
- Create: `apps/web/src/modules/creator/director/ProviderGate.tsx`
- Create: `apps/web/src/modules/creator/director/ReviewPanel.tsx`
- Modify: `apps/web/src/modules/creator/director/DirectorWorkspace.tsx`
- Modify: `apps/web/src/modules/creator/CreatorStudioPage.tsx`
- Modify: `apps/web/src/modules/creator/director/director.css`
- Modify: `tests/integration/atlas-creator-route.test.tsx`

**Interfaces:**
- `ProviderGate` receives server `ProviderReadiness[]` and selected provider, then runs `validateProductionSpec(spec, capability)`.
- `ReviewPanel` renders deterministic compiled output from `compileProviderRequest` and owns no generation state.
- Creator Library reads persisted productions/assets through `creatorApi`.
- Creator Providers reads server readiness through `creatorApi` and removes the current hard-coded provider array.

- [ ] **Step 1: Write failing truthful-readiness tests**

Add:

```tsx
it('shows an unconfigured provider without inventing price or readiness', async () => {
  vi.spyOn(creatorApi, 'listCreatorProviders').mockResolvedValue([
    {
      providerId: 'seedance',
      displayName: 'Seedance',
      connectionState: 'unconfigured',
      capability: null,
      estimatedCost: null,
      lastVerifiedAt: null
    }
  ]);
  render(<MemoryRouter initialEntries={['/studio/create?type=video']}><CreatorWorkspace /></MemoryRouter>);
  // navigate to Provider & Cost
  expect(await screen.findByText('unconfigured')).toBeInTheDocument();
  expect(screen.getByText(/Cost estimate unavailable/i)).toBeInTheDocument();
});
```

Add a Review test that confirms a blocking provider state keeps Generate disabled.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/atlas-creator-route.test.tsx
```

Expected: FAIL because provider/review components are not implemented.

- [ ] **Step 3: Implement ProviderGate**

Display for each provider:

- exact connection state;
- last verified timestamp or `Never verified`;
- capability summary only when the server returns a capability descriptor;
- requested duration/aspect/resolution/audio;
- compatibility blockers/warnings;
- `estimatedCost` when non-null;
- `Cost estimate unavailable until provider configuration is verified.` when null.

Do not show the OpenArt account's current 40-credit value inside ATLAS unless a future authorized ATLAS provider adapter returns it server-side.

- [ ] **Step 4: Implement ReviewPanel and deterministic prompt preview**

Render:

```tsx
const compiled = spec.providerPreference
  ? compileProviderRequest(spec, spec.providerPreference, selectedCapability ?? undefined)
  : null;
```

Show canonical validation result, provider-specific compatibility, prompt text in a read-only `<pre>`/copyable region, normalized parameters, and adaptation notes. If no provider is selected, show an explicit empty state.

- [ ] **Step 5: Implement final Generate gate**

Compute:

```ts
const canGenerate =
  hasCreatorPermission(readiness.permissions, 'creator.generate') &&
  selectedProvider?.connectionState === 'ready' &&
  validation.status !== 'blocking' &&
  !submitting;
```

Button:

```tsx
<button type="button" disabled={!canGenerate} onClick={submit}>Generate video</button>
```

On `provider_adapter_not_configured`, show that exact dependency state and do not switch the production to `generating`. On provider acceptance in a future adapter response, only then may the UI display `generating`.

- [ ] **Step 6: Replace hard-coded CreatorProviders data with server readiness**

Remove the static `providers` constant from `CreatorStudioPage.tsx`. Render loading, error, empty/unconfigured, and verified states from `listCreatorProviders()`.

- [ ] **Step 7: Connect Creator Library to persisted productions/assets**

Load `listCreatorProductions()` and `listCreatorAssets()`. Search must filter title/brief/provider/asset metadata locally for the loaded data. Production cards expose status/version/updated timestamp; asset cards expose provider/provenance only when real rows exist. If there are none, keep a real empty state.

- [ ] **Step 8: Run integration tests and build**

```bash
npx vitest run tests/integration/atlas-creator-route.test.tsx
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/modules/creator apps/web/src/lib/creatorApi.ts tests/integration/atlas-creator-route.test.tsx
git commit -m "feat(creator): add provider gate review and provenance views"
```

---

### Task 10: Verify accessibility, responsive behavior, regressions, and deployment readiness

**Files:**
- Modify as needed from test failures only: `apps/web/src/modules/creator/director/director.css`
- Modify as needed from test failures only: `apps/web/src/modules/creator/director/*.tsx`
- Modify: `tests/integration/atlas-creator-route.test.tsx`
- Update: `docs/superpowers/plans/2026-09-12-atlas-director.md` only to mark executed checkboxes during execution.

**Interfaces:**
- Produces no new feature API; this task proves the implementation satisfies the approved spec.

- [ ] **Step 1: Add final accessibility regression assertions**

Assert:

```tsx
expect(screen.getByRole('navigation', { name: 'Production steps' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
expect(screen.getByLabelText('Creative brief')).toHaveAccessibleName('Creative brief');
```

For each shot action, ensure there is an accessible button name including the shot title/order where multiple controls repeat.

- [ ] **Step 2: Run complete unit/integration suite**

```bash
npm run test:unit
npm run test:integration
npm test
```

Expected: PASS with no skipped/focused tests added for ATLAS Director.

- [ ] **Step 3: Run TypeScript and production build**

```bash
npm run typecheck
npm run build
```

Expected: PASS; Vite produces the production bundle and TypeScript reports zero errors.

- [ ] **Step 4: Run the repository Cloudflare verification script**

```bash
npm run verify:cloudflare
```

Expected: PASS. If `npm audit --audit-level=high` fails for a pre-existing dependency advisory, record the exact advisory and do not claim the ATLAS Director build is fully verified until the repository owner decides how to handle it.

- [ ] **Step 5: Verify route behavior locally**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Verify these paths manually or with the existing browser test harness:

```text
/studio
/studio/create?type=image
/studio/create?type=video
/studio/library
/studio/providers
```

Expected:
- no 404/500;
- identity gate remains in place through the application route graph;
- image workspace still shows truthful unconfigured generation state;
- video workspace opens ATLAS Director;
- Back/Next work on mobile-width and desktop-width layouts;
- Save shows authentication/permission/persistence results rather than fake success;
- Generate stays disabled until verified provider readiness and a passing production;
- Library and Providers render real rows or real empty/unconfigured states.

- [ ] **Step 6: Inspect secret exposure**

Run:

```bash
git diff main...HEAD -- . ':!package-lock.json' | grep -Ei 'api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|service[_-]?role|provider[_-]?secret' || true
```

Expected: only variable names/documentation references; no actual secret values introduced by this feature.

- [ ] **Step 7: Inspect final PR diff and CI status**

```bash
git diff --stat main...HEAD
git status --short
```

Expected: only ATLAS Director/shared Creator changes plus its approved spec/plan; working tree clean after commits.

Push the branch and inspect PR #78 checks. Do not merge while checks are pending/failing.

- [ ] **Step 8: Commit any verification-only fixes**

If steps 1-7 required fixes, commit only those fixes:

```bash
git add apps/web/src/modules/creator tests packages/creator supabase/functions/atlas-creator supabase/migrations/20260912_creator_director.sql
git commit -m "test(creator): harden ATLAS Director production readiness"
```

If no fixes were needed, do not create an empty commit.

- [ ] **Step 9: Request merge/deploy approval**

Report exact evidence:

```text
Typecheck: PASS/FAIL
Unit tests: PASS/FAIL + count
Integration tests: PASS/FAIL + count
Build: PASS/FAIL
Cloudflare verification: PASS/FAIL
PR checks: PASS/FAIL/PENDING
Supabase migration applied: YES/NO
atlas-creator deployed: YES/NO
Provider adapter configured: YES/NO
Production generation verified: YES/NO
```

Only after explicit repository-owner approval: merge PR #78 to `main`, allow the established production deployment path to run, then verify `https://www.atlasenterprisesuite.com/studio/create?type=video` through the authenticated production flow. Do not describe provider generation as production-ready while `Provider adapter configured` or `Production generation verified` remains `NO`.
