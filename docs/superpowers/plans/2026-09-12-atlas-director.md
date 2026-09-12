# ATLAS Director Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing ATLAS Studio Video Lab into ATLAS Director: a governed, provider-neutral production workspace that structures, validates, persists, compiles, and truthfully gates video-generation requests without spending external-provider credits during planning.

**Architecture:** Keep `/studio/create?type=video` inside the existing Creator module as the browser entrypoint. Put provider-neutral domain contracts, permissions, validation, and compilation in a focused shared `packages/creator` package so React and Supabase Edge Functions consume the same deterministic rules; use one authenticated `atlas-creator` Edge Function for organization-scoped persistence, provider readiness, audit, and the final submission gate. External provider calls remain server-side and fail closed until an authorized provider adapter is actually configured and verified.

**Tech Stack:** React 18.3.1, React Router 7.18.3, TypeScript 5.7, Vite 6.4.3, Vitest 3.2.6, Testing Library, Supabase Auth/Postgres/RLS/Edge Functions, Deno, GitHub Actions, Cloudflare production deployment.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-director-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Canonical branch: `main`; implementation branch: `feat/atlas-director`; draft PR: `#78`.
- Reuse the existing ATLAS Studio route graph and Creator module; do not create a parallel app or replacement Studio.
- Primary route remains `/studio/create?type=video` behind `RequireAtlasIdentity`.
- Use one canonical `ProductionSpec` as the source of truth for each video production.
- No provider may be displayed as `ready` unless an authorized server-side verification has succeeded.
- No generation result may be displayed until an actual provider result exists.
- No external-provider credits may be spent by planning, validation, compilation, draft saving, or cost/readiness inspection.
- Provider secrets, API tokens, private credentials, and service-role credentials remain server-side and are never committed or returned to the browser.
- Every persisted Creator row must be scoped to `organization_id` and protected by RLS plus server-side authorization.
- Reuse the existing `audit_logs` table for Creator audit events instead of creating a second audit source of truth.
- Use explicit permissions: `creator.read`, `creator.write`, `creator.generate`, `creator.manage_providers`, `creator.publish`, `creator.admin`.
- Until a shared canonical permission resolver exists, map roles only inside the `atlas-creator` request boundary: `owner`, `admin`, and `platform_admin` receive all Creator permissions; other active members receive `creator.read` only.
- Use accessible Move Up/Move Down controls for shot ordering; do not add a drag-and-drop dependency.
- Cost estimates must be `null`/unavailable unless a verified provider adapter returns a current estimate. Never hard-code the user's OpenArt balance or provider prices into ATLAS.
- Provider capability descriptors used for submission must come from the authenticated server readiness response. Static browser metadata may contain display names only.
- Run `npm ci`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm test`, and `npm run build` before requesting merge.
- Do not merge PR #78 or deploy production until all implementation checks pass and the repository owner approves the merge/deploy checkpoint.

---

## File Structure

### Shared Creator domain

- `packages/creator/types.ts` — canonical production, scene, shot, continuity, provider, validation, job, asset, and permission types.
- `packages/creator/defaults.ts` — empty-draft and child-entity factories with injectable IDs/time for deterministic tests.
- `packages/creator/permissions.ts` — pure Creator permission helpers.
- `packages/creator/validator.ts` — deterministic production, continuity, and provider-compatibility validation.
- `packages/creator/compiler.ts` — neutral prompt compiler plus provider-specific formatting.
- `packages/creator/providers.ts` — provider IDs, display labels, and prompt-dialect registry only; no live readiness data.

### Supabase persistence and server boundary

- `supabase/migrations/20260912_creator_director.sql` — productions, provider metadata, generation jobs, assets, indexes, constraints, RLS, and read grants.
- `supabase/functions/atlas-creator/_shared/context.ts` — bearer authentication, organization resolution, role-to-permission mapping.
- `supabase/functions/atlas-creator/_shared/errors.ts` — safe normalized error responses.
- `supabase/functions/atlas-creator/_shared/repository.ts` — organization-scoped persistence and `audit_logs` writes.
- `supabase/functions/atlas-creator/index.ts` — thin API router for readiness, providers, productions, save, assets, and submit gate.

### Browser integration

- `apps/web/src/lib/creatorApi.ts` — authenticated browser client for `atlas-creator`.
- `apps/web/src/modules/creator/director/directorState.ts` — reducer/actions/selectors for the local production edit session.
- `apps/web/src/modules/creator/director/DirectorWorkspace.tsx` — Director shell, steps, persistence, validation orchestration.
- `apps/web/src/modules/creator/director/BriefSubjectEnvironment.tsx` — Creative Brief, Subject/Entity, Environment editors.
- `apps/web/src/modules/creator/director/SceneShotEditor.tsx` — scene/shot CRUD, timing, ordering, camera, motion, lighting, material controls.
- `apps/web/src/modules/creator/director/ContinuityStyleAudio.tsx` — continuity, negative constraints, visual style, camera defaults, motion rules, audio.
- `apps/web/src/modules/creator/director/ProviderGate.tsx` — verified readiness, compatibility, and cost state.
- `apps/web/src/modules/creator/director/ReviewPanel.tsx` — validation issues, compiled prompt, final submission gate.
- `apps/web/src/modules/creator/director/director.css` — responsive Director layout/state styles.
- `apps/web/src/modules/creator/CreatorStudioPage.tsx` — existing route integration plus persisted Library/Providers data.
- `apps/web/src/modules/creator/creator.css` — shared Creator styles only.

### Tests

- `tests/unit/atlas-director-domain.test.ts`
- `tests/unit/atlas-director-validator.test.ts`
- `tests/unit/atlas-director-compiler.test.ts`
- `tests/unit/creator-api.test.ts`
- `tests/integration/atlas-director-schema-contract.test.ts`
- `tests/integration/atlas-director-edge-contract.test.ts`
- `tests/integration/atlas-creator-route.test.tsx`

---

### Task 1: Create the shared ATLAS Director domain and permissions

**Files:**
- Create: `packages/creator/types.ts`
- Create: `packages/creator/defaults.ts`
- Create: `packages/creator/permissions.ts`
- Create: `tests/unit/atlas-director-domain.test.ts`

**Interfaces:**
- Produces every shared type used by later tasks.
- Produces `createEmptyProductionSpec`, `createEmptyScene`, `createEmptyShot`, `createEmptySubject`.
- Produces `creatorPermissionsForRole`, `hasCreatorPermission`, `requireCreatorPermission`.

- [ ] **Step 1: Write the failing domain/default/permission tests**

Create `tests/unit/atlas-director-domain.test.ts`:

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
      id: '00000000-0000-4000-8000-000000000001',
      organizationId: '00000000-0000-4000-8000-000000000002',
      createdByUserId: '00000000-0000-4000-8000-000000000003',
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
    expect(createEmptyScene({ id: '00000000-0000-4000-8000-000000000004' }).description).toBe('');
    expect(createEmptyShot({ id: '00000000-0000-4000-8000-000000000005', order: 1 }).action).toBe('');
  });

  it('maps administrative roles only at the permission boundary', () => {
    const admin = creatorPermissionsForRole('admin');
    const member = creatorPermissionsForRole('member');
    expect(hasCreatorPermission(admin, 'creator.generate')).toBe(true);
    expect(hasCreatorPermission(member, 'creator.read')).toBe(true);
    expect(hasCreatorPermission(member, 'creator.write')).toBe(false);
    expect(() => requireCreatorPermission(member, 'creator.write')).toThrow('authorization_denied');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
npx vitest run tests/unit/atlas-director-domain.test.ts
```

Expected: FAIL because `packages/creator` does not exist.

- [ ] **Step 3: Implement the canonical types**

Create `packages/creator/types.ts` with these exact shared contracts:

```ts
export type ProductionStatus =
  | 'draft' | 'validating' | 'blocked' | 'ready'
  | 'submitting' | 'generating' | 'completed' | 'failed';

export type CreatorPermission =
  | 'creator.read' | 'creator.write' | 'creator.generate'
  | 'creator.manage_providers' | 'creator.publish' | 'creator.admin';

export type ProviderId = 'seedance' | 'veo' | 'kling' | 'wan' | 'minimax';
export type ProviderConnectionState =
  | 'unconfigured' | 'configured-unverified' | 'ready'
  | 'unavailable' | 'insufficient-credit' | 'error';
export type ProviderGenerationMode = 'text2video' | 'image2video' | 'element2video';
export type AspectRatio = 'adaptive' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9';
export type ResolutionPreference = 'adaptive' | '480p' | '720p' | '1080p' | '2k' | '4k';

export type CameraSpec = {
  framing: string;
  angle: string;
  position: string;
  lens: string;
  focalLengthMm: number | null;
  depthOfField: string;
  movement: string;
  movementSpeed: string;
  focusTarget: string;
  orientationRule: string;
};

export type SubjectSpec = {
  id: string;
  label: string;
  description: string;
  identityLock: boolean;
  appearanceTraits: string[];
  materialTraits: string[];
  allowedTransformations: string[];
  forbiddenChanges: string[];
  referenceAssetIds: string[];
};

export type EnvironmentSpec = {
  locationDescription: string;
  timeOfDay: string;
  lightingEnvironment: string;
  weatherOrAtmosphere: string;
  backgroundConstraints: string[];
  referenceAssetIds: string[];
};

export type ShotSpec = {
  id: string;
  order: number;
  title: string;
  startSecond: number;
  endSecond: number;
  subjectIds: string[];
  action: string;
  camera: CameraSpec;
  motion: { direction: string; speedProfile: string; physicality: string };
  lighting: string;
  materials: string[];
  audioCueIds: string[];
  transitionIn: string;
  transitionOut: string;
  continuityNotes: string[];
  negativeConstraints: string[];
};

export type SceneSpec = {
  id: string;
  title: string;
  startSecond: number;
  endSecond: number;
  description: string;
  shots: ShotSpec[];
};

export type VisualStyleSpec = {
  photorealismLevel: string;
  cinematicStyle: string;
  textureStyle: string;
  colorPalette: string;
  contrastStyle: string;
  filmLook: string;
  grain: string;
  halation: string;
  surfaceDetail: string;
  lightingStyle: string;
};

export type MotionRule = {
  id: string;
  subjectId: string | null;
  movementDescription: string;
  direction: string;
  speedProfile: string;
  physicality: string;
  mustRemainContinuous: boolean;
};

export type AudioPlan = {
  musicDescription: string;
  ambientSound: string;
  soundEffects: string[];
  dialogue: string[];
  voiceReferenceAssetIds: string[];
  syncRules: string[];
};

export type NegativeConstraint = {
  id: string;
  scope: 'production' | 'scene' | 'shot' | 'subject';
  value: string;
  severity: 'preference' | 'warning' | 'blocking';
};

export type ContinuityRule = {
  id: string;
  ruleType:
    | 'identity' | 'orientation' | 'wardrobe-or-surface' | 'material'
    | 'lighting' | 'position' | 'camera-axis' | 'motion-direction'
    | 'damage-or-scar' | 'object-presence' | 'transformation-continuity' | 'custom';
  subjectId: string | null;
  description: string;
  startShotId: string | null;
  endShotId: string | null;
  severity: 'warning' | 'blocking';
};

export type ProductionSpec = {
  id: string;
  organizationId: string;
  createdByUserId: string;
  title: string;
  brief: string;
  status: ProductionStatus;
  durationSeconds: number;
  aspectRatio: AspectRatio;
  resolutionPreference: ResolutionPreference;
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

export type ValidationIssue = {
  code: string;
  severity: 'warning' | 'blocking';
  section: 'brief' | 'subjects' | 'environment' | 'shots' | 'continuity' | 'style' | 'camera' | 'audio' | 'provider' | 'review';
  message: string;
  targetId: string | null;
};

export type ValidationResult = {
  status: 'pass' | 'warning' | 'blocking';
  issues: ValidationIssue[];
};

export type ProviderCapability = {
  providerId: ProviderId;
  connectionState: ProviderConnectionState;
  modes: ProviderGenerationMode[];
  minDurationSeconds: number | null;
  maxDurationSeconds: number | null;
  aspectRatios: AspectRatio[];
  resolutions: ResolutionPreference[];
  audioSupport: boolean;
  imageReferenceSupport: boolean;
  videoReferenceSupport: boolean;
  audioReferenceSupport: boolean;
  maxImageReferences: number | null;
  maxVideoReferences: number | null;
  maxAudioReferences: number | null;
  startFrameSupport: boolean;
  endFrameSupport: boolean;
  costEstimatorAvailable: boolean;
  lastVerifiedAt: string | null;
};

export type ProviderReadiness = {
  providerId: ProviderId;
  displayName: string;
  connectionState: ProviderConnectionState;
  capability: ProviderCapability | null;
  estimatedCost: Record<string, unknown> | null;
  lastVerifiedAt: string | null;
};

export type CompiledProviderRequest = {
  providerId: ProviderId;
  prompt: string;
  normalizedParams: {
    durationSeconds: number;
    aspectRatio: AspectRatio;
    resolutionPreference: ResolutionPreference;
    audioEnabled: boolean;
  };
  unsupportedFeatures: string[];
  adaptationNotes: string[];
  readinessClaim: boolean;
};
```

- [ ] **Step 4: Implement empty factories with no fabricated creative values**

Create `packages/creator/defaults.ts` using `crypto.randomUUID()` and `new Date().toISOString()` only when callers do not inject deterministic values. `createEmptyProductionSpec` must return empty strings/arrays, `durationSeconds: 0`, `providerPreference: null`, `status: 'draft'`, and `version: 1`. `createEmptyScene` uses `startSecond: 0`, `endSecond: 0`, empty title/description/shots. `createEmptyShot` uses the supplied order, zero timings, empty content, and an empty `CameraSpec`. `createEmptySubject` uses an empty label/description and `identityLock: true`.

Core production factory:

```ts
export function createEmptyProductionSpec(options: {
  id?: string;
  organizationId?: string;
  createdByUserId?: string;
  now?: string;
} = {}): ProductionSpec {
  const timestamp = options.now ?? new Date().toISOString();
  return {
    id: options.id ?? crypto.randomUUID(),
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
      locationDescription: '', timeOfDay: '', lightingEnvironment: '',
      weatherOrAtmosphere: '', backgroundConstraints: [], referenceAssetIds: []
    },
    scenes: [],
    continuityRules: [],
    visualStyle: {
      photorealismLevel: '', cinematicStyle: '', textureStyle: '', colorPalette: '',
      contrastStyle: '', filmLook: '', grain: '', halation: '', surfaceDetail: '', lightingStyle: ''
    },
    cameraDefaults: {
      framing: '', angle: '', position: '', lens: '', focalLengthMm: null,
      depthOfField: '', movement: '', movementSpeed: '', focusTarget: '', orientationRule: ''
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

- [ ] **Step 5: Implement pure permission helpers**

Create `packages/creator/permissions.ts`:

```ts
import type { CreatorPermission } from './types';

const ALL: CreatorPermission[] = [
  'creator.read', 'creator.write', 'creator.generate',
  'creator.manage_providers', 'creator.publish', 'creator.admin'
];

export function creatorPermissionsForRole(role: string): CreatorPermission[] {
  return ['owner', 'admin', 'platform_admin'].includes(role) ? [...ALL] : ['creator.read'];
}

export function hasCreatorPermission(permissions: readonly CreatorPermission[], permission: CreatorPermission) {
  return permissions.includes('creator.admin') || permissions.includes(permission);
}

export function requireCreatorPermission(permissions: readonly CreatorPermission[], permission: CreatorPermission) {
  if (!hasCreatorPermission(permissions, permission)) throw new Error('authorization_denied');
}
```

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

### Task 2: Implement deterministic production and continuity validation

**Files:**
- Create: `packages/creator/validator.ts`
- Create: `tests/unit/atlas-director-validator.test.ts`

**Interfaces:**
- Consumes `ProductionSpec` and optional verified `ProviderCapability`.
- Produces `validateProductionSpec(spec, provider?): ValidationResult`.

- [ ] **Step 1: Write the failing validator tests**

Create `tests/unit/atlas-director-validator.test.ts` with cases for invalid duration, shot overlap, shot beyond production, continuous camera-axis reversal, identity-locked subject disappearance, exact positive/negative conflict, provider not ready, provider max duration, unsupported audio, and reference limits. Example core cases:

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyProductionSpec, createEmptyScene, createEmptyShot } from '../../packages/creator/defaults';
import { validateProductionSpec } from '../../packages/creator/validator';

function validBase() {
  const spec = createEmptyProductionSpec();
  spec.title = 'Launch spot';
  spec.brief = 'A governed cinematic ATLAS launch sequence.';
  spec.durationSeconds = 10;
  const scene = createEmptyScene();
  scene.title = 'Launch';
  scene.startSecond = 0;
  scene.endSecond = 10;
  const shot = createEmptyShot({ order: 1 });
  shot.title = 'Opening';
  shot.startSecond = 0;
  shot.endSecond = 5;
  shot.action = 'ATLAS mark emerges from darkness.';
  scene.shots = [shot];
  spec.scenes = [scene];
  return spec;
}

it('blocks a shot that exceeds production duration', () => {
  const spec = validBase();
  spec.scenes[0].shots[0].endSecond = 12;
  const result = validateProductionSpec(spec);
  expect(result.status).toBe('blocking');
  expect(result.issues.some(issue => issue.code === 'shot_exceeds_production')).toBe(true);
});

it('warns on an unexplained axis reversal across a continuous transition', () => {
  const spec = validBase();
  spec.scenes[0].shots[0].camera.orientationRule = 'front-facing';
  const second = createEmptyShot({ order: 2 });
  second.startSecond = 5;
  second.endSecond = 10;
  second.action = 'Continue forward motion.';
  second.camera.orientationRule = 'rear-facing';
  second.transitionIn = 'continuous';
  spec.scenes[0].shots.push(second);
  expect(validateProductionSpec(spec).issues.some(issue => issue.code === 'camera_axis_reversal')).toBe(true);
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
npx vitest run tests/unit/atlas-director-validator.test.ts
```

Expected: FAIL because `validator.ts` does not exist.

- [ ] **Step 3: Implement exact structured validation rules**

Create `packages/creator/validator.ts` with a helper:

```ts
function issue(
  code: string,
  severity: 'warning' | 'blocking',
  section: ValidationIssue['section'],
  message: string,
  targetId: string | null = null
): ValidationIssue {
  return { code, severity, section, message, targetId };
}
```

Enforce these deterministic rules:

```ts
if (!spec.brief.trim()) issues.push(issue('brief_required', 'blocking', 'brief', 'Creative brief is required.'));
if (spec.durationSeconds <= 0) issues.push(issue('duration_invalid', 'blocking', 'brief', 'Duration must be greater than zero.'));
if (scene.endSecond <= scene.startSecond) issues.push(issue('scene_timing_invalid', 'blocking', 'shots', 'Scene end must be after scene start.', scene.id));
if (scene.endSecond > spec.durationSeconds) issues.push(issue('scene_exceeds_production', 'blocking', 'shots', 'Scene exceeds production duration.', scene.id));
if (shot.endSecond <= shot.startSecond) issues.push(issue('shot_timing_invalid', 'blocking', 'shots', 'Shot end must be after shot start.', shot.id));
if (shot.startSecond < scene.startSecond || shot.endSecond > scene.endSecond) issues.push(issue('shot_outside_scene', 'blocking', 'shots', 'Shot timing must stay inside its scene.', shot.id));
if (shot.endSecond > spec.durationSeconds) issues.push(issue('shot_exceeds_production', 'blocking', 'shots', 'Shot exceeds production duration.', shot.id));
```

Sort each scene's shots by `order`. Block overlap when `current.startSecond < previous.endSecond`. Warn on a camera-axis change when `current.transitionIn === 'continuous'` and both orientation rules are non-empty and unequal. For identity-locked subjects, warn when a continuity span includes a shot where the subject ID disappears without an allowed transformation note. For negative conflicts, normalize exact lower-case trimmed values and block only when a shot/production positive field exactly equals a blocking negative constraint; do not invent semantic contradictions with an LLM.

- [ ] **Step 4: Add server-capability validation**

When `provider` exists:

```ts
if (provider.connectionState !== 'ready') {
  issues.push(issue('provider_not_ready', 'blocking', 'provider', 'Selected provider is not verified ready.'));
}
if (provider.maxDurationSeconds !== null && spec.durationSeconds > provider.maxDurationSeconds) {
  issues.push(issue('provider_duration_unsupported', 'blocking', 'provider', 'Requested duration exceeds provider capability.'));
}
if (!provider.aspectRatios.includes(spec.aspectRatio) && spec.aspectRatio !== 'adaptive') {
  issues.push(issue('provider_aspect_ratio_unsupported', 'blocking', 'provider', 'Requested aspect ratio is not supported.'));
}
if (spec.audioEnabled && !provider.audioSupport) {
  issues.push(issue('provider_audio_unsupported', 'warning', 'provider', 'Provider does not support native synchronized audio.'));
}
```

Count image/video/audio references from subjects/environment/audio plan and compare against the verified capability limits.

- [ ] **Step 5: Return stable aggregate status**

```ts
const status: ValidationResult['status'] = issues.some(item => item.severity === 'blocking')
  ? 'blocking'
  : issues.length > 0
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

### Task 3: Build neutral prompt compilation and provider formatting

**Files:**
- Create: `packages/creator/providers.ts`
- Create: `packages/creator/compiler.ts`
- Create: `tests/unit/atlas-director-compiler.test.ts`

**Interfaces:**
- Produces `providerLabel(providerId)`.
- Produces `compileNeutralProduction(spec): string`.
- Produces `compileProviderRequest(spec, providerId, capability?): CompiledProviderRequest`.

- [ ] **Step 1: Write the failing deterministic compiler tests**

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyProductionSpec, createEmptyScene, createEmptyShot } from '../../packages/creator/defaults';
import { compileNeutralProduction, compileProviderRequest } from '../../packages/creator/compiler';

function production() {
  const spec = createEmptyProductionSpec();
  spec.title = 'ATLAS Launch';
  spec.brief = 'Cinematic ATLAS launch.';
  spec.durationSeconds = 8;
  spec.negativeConstraints.push({ id: crypto.randomUUID(), scope: 'production', value: 'No text in frame', severity: 'warning' });
  const scene = createEmptyScene();
  scene.title = 'Reveal';
  scene.startSecond = 0;
  scene.endSecond = 8;
  const shot = createEmptyShot({ order: 1 });
  shot.title = 'Macro reveal';
  shot.startSecond = 0;
  shot.endSecond = 8;
  shot.action = 'Metal surfaces assemble into the ATLAS emblem.';
  scene.shots = [shot];
  spec.scenes = [scene];
  return spec;
}

it('produces deterministic neutral output', () => {
  const spec = production();
  expect(compileNeutralProduction(spec)).toBe(compileNeutralProduction(spec));
});

it('preserves ordered production sections and negative constraints', () => {
  const prompt = compileNeutralProduction(production());
  expect(prompt.indexOf('OBJECTIVE')).toBeLessThan(prompt.indexOf('SCENE PLAN'));
  expect(prompt).toContain('No text in frame');
});

it('never claims provider readiness without a verified capability', () => {
  const compiled = compileProviderRequest(production(), 'seedance');
  expect(compiled.providerId).toBe('seedance');
  expect(compiled.readinessClaim).toBe(false);
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npx vitest run tests/unit/atlas-director-compiler.test.ts
```

Expected: FAIL because compiler/registry files do not exist.

- [ ] **Step 3: Implement the static provider identity registry**

Create `packages/creator/providers.ts`:

```ts
import type { ProviderId } from './types';

const PROVIDERS: Record<ProviderId, { label: string; promptDialect: 'cinematic-structured' | 'shot-structured' }> = {
  seedance: { label: 'Seedance', promptDialect: 'cinematic-structured' },
  veo: { label: 'Veo', promptDialect: 'cinematic-structured' },
  kling: { label: 'Kling', promptDialect: 'shot-structured' },
  wan: { label: 'Wan', promptDialect: 'shot-structured' },
  minimax: { label: 'MiniMax', promptDialect: 'cinematic-structured' }
};

export function providerLabel(providerId: ProviderId) {
  return PROVIDERS[providerId].label;
}

export function providerPromptDialect(providerId: ProviderId) {
  return PROVIDERS[providerId].promptDialect;
}
```

No connection state, price, credits, max duration, or model-version capability belongs in this file.

- [ ] **Step 4: Implement canonical neutral compilation order**

`compileNeutralProduction` must serialize in this exact order:

```ts
const sections: Array<[string, string]> = [
  ['OBJECTIVE', renderObjective(spec)],
  ['OUTPUT', renderOutput(spec)],
  ['SUBJECT IDENTITY', renderSubjects(spec)],
  ['ENVIRONMENT', renderEnvironment(spec)],
  ['SCENE PLAN', renderScenes(spec)],
  ['SHOT PLAN', renderShots(spec)],
  ['VISUAL STYLE', renderVisualStyle(spec)],
  ['CAMERA & MOTION', renderCameraMotion(spec)],
  ['AUDIO', renderAudio(spec)],
  ['CONTINUITY CONTRACT', renderContinuity(spec)],
  ['NEGATIVE CONSTRAINTS', renderNegativeConstraints(spec)],
  ['OUTPUT RESTRICTIONS', renderOutputRestrictions(spec)]
];
return sections.map(([heading, body]) => `${heading}\n${body || 'Not specified.'}`).join('\n\n');
```

Sort scenes by `startSecond`, shots by `order`, and array values by their stored order. Do not include `createdAt`, `updatedAt`, random IDs, or any other value that would make prompt output nondeterministic for the same production content/version.

- [ ] **Step 5: Implement provider formatting without altering meaning**

`compileProviderRequest` must return:

```ts
const result: CompiledProviderRequest = {
  providerId,
  prompt: formatForDialect(compileNeutralProduction(spec), providerPromptDialect(providerId)),
  normalizedParams: {
    durationSeconds: spec.durationSeconds,
    aspectRatio: spec.aspectRatio,
    resolutionPreference: spec.resolutionPreference,
    audioEnabled: spec.audioEnabled
  },
  unsupportedFeatures: [],
  adaptationNotes: [],
  readinessClaim: capability?.connectionState === 'ready'
};
```

When a verified capability is passed, add deterministic unsupported-feature/adaptation messages from its actual limits. Do not silently change duration, resolution, audio, aspect ratio, or reference count.

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

### Task 4: Add Supabase persistence and RLS

**Files:**
- Create: `supabase/migrations/20260912_creator_director.sql`
- Create: `tests/integration/atlas-director-schema-contract.test.ts`

**Interfaces:**
- Produces `creator_productions`, `creator_provider_instances`, `creator_generation_jobs`, `creator_assets`.
- Reuses existing `organizations`, `organization_members`, and `audit_logs`.

- [ ] **Step 1: Write the failing schema contract test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20260912_creator_director.sql', 'utf8');

describe('ATLAS Director schema contract', () => {
  it('creates four organization-scoped RLS tables', () => {
    for (const table of ['creator_productions', 'creator_provider_instances', 'creator_generation_jobs', 'creator_assets']) {
      expect(sql).toContain(`public.${table}`);
    }
    expect(sql.match(/enable row level security/g)?.length).toBe(4);
    expect(sql).toContain('organization_members');
    expect(sql).toContain('auth.uid()');
  });

  it('contains no provider-secret columns', () => {
    expect(sql).not.toMatch(/api_key|access_token|refresh_token|private_key|provider_secret/i);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
npx vitest run tests/integration/atlas-director-schema-contract.test.ts
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement all four tables and constraints**

Create `supabase/migrations/20260912_creator_director.sql` with the following core DDL:

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

create table if not exists public.creator_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  production_id uuid not null references public.creator_productions(id) on delete cascade,
  requested_by uuid not null,
  provider_id text not null,
  provider_job_id text,
  status text not null check (status in ('queued','submitted','generating','completed','failed','cancelled')),
  compiled_prompt text not null,
  normalized_params_json jsonb not null default '{}'::jsonb,
  estimated_cost_json jsonb,
  actual_cost_json jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  production_id uuid not null references public.creator_productions(id) on delete cascade,
  generation_job_id uuid references public.creator_generation_jobs(id) on delete set null,
  storage_path text not null,
  media_type text not null check (media_type in ('image','video','audio')),
  provider_id text,
  provider_asset_id text,
  mime_type text,
  width integer,
  height integer,
  duration_seconds numeric,
  provenance_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- [ ] **Step 4: Add indexes**

Create indexes on `(organization_id, updated_at desc)` for productions, `(organization_id, provider_id, state)` for provider instances, `(organization_id, production_id, created_at desc)` for jobs, and `(organization_id, production_id, created_at desc)` for assets.

- [ ] **Step 5: Add RLS and read-only browser grants**

Enable RLS on all four tables. For each table, create a `for select to authenticated` policy that requires an active `organization_members` row where `om.org_id = target.organization_id`, `om.user_id = auth.uid()`, and `om.status = 'active'`.

Representative policy:

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

Then:

```sql
revoke all on public.creator_productions from authenticated;
revoke all on public.creator_provider_instances from authenticated;
revoke all on public.creator_generation_jobs from authenticated;
revoke all on public.creator_assets from authenticated;
grant select on public.creator_productions to authenticated;
grant select on public.creator_provider_instances to authenticated;
grant select on public.creator_generation_jobs to authenticated;
grant select on public.creator_assets to authenticated;
```

No direct browser insert/update/delete grant is allowed in this milestone.

- [ ] **Step 6: Run schema and integration tests**

```bash
npx vitest run tests/integration/atlas-director-schema-contract.test.ts
npm run test:integration
```

Expected: PASS.

- [ ] **Step 7: Commit**

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
- `resolveCreatorContext(req)` returns user/org/role/permissions.
- Repository exports `listProductions`, `getProduction`, `saveProduction`, `listProviderReadiness`, `listAssets`, `writeCreatorAudit`.
- HTTP APIs: `readiness`, `providers`, `productions`, `production`, `save`, `assets`, `submit`.

- [ ] **Step 1: Write the failing Edge contract test**

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

  it('contains no direct provider secrets', () => {
    expect(index).not.toMatch(/OPENART_API_KEY|provider_secret|private_key/i);
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npx vitest run tests/integration/atlas-director-edge-contract.test.ts
```

Expected: FAIL because the Edge Function does not exist.

- [ ] **Step 3: Implement safe errors**

Create `_shared/errors.ts`:

```ts
export function creatorError(code: string, status = 400, details: Record<string, unknown> = {}) {
  return Object.assign(new Error(code), { code, status, ...details });
}

export function creatorErrorResponse(error: unknown) {
  const value = error as { code?: string; status?: number };
  return new Response(JSON.stringify({ ok: false, error: value.code || 'internal_error' }), {
    status: value.status || 500,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}
```

- [ ] **Step 4: Implement authenticated context resolution completely**

Create `_shared/context.ts`:

```ts
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { creatorPermissionsForRole } from '../../../../packages/creator/permissions.ts';
import { creatorError } from './errors.ts';

const URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function resolveCreatorContext(req: Request) {
  if (!URL || !PUBLISHABLE) throw creatorError('supabase_runtime_not_configured', 503);
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) throw creatorError('authentication_required', 401);
  const sb = createClient(URL, PUBLISHABLE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: auth } }
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw creatorError('invalid_session', 401);
  const requestedOrg = (req.headers.get('x-atlas-org-id') || '').trim();
  if (requestedOrg && !isUuid(requestedOrg)) throw creatorError('invalid_organization', 400);
  const { data: memberships, error: membershipError } = await sb
    .from('organization_members')
    .select('org_id,role,status')
    .eq('user_id', data.user.id)
    .eq('status', 'active');
  if (membershipError || !memberships?.length) throw creatorError('active_organization_required', 403);
  const membership = requestedOrg
    ? memberships.find(row => String(row.org_id) === requestedOrg)
    : memberships[0];
  if (!membership) throw creatorError('organization_membership_required', 403);
  const role = String(membership.role || 'member');
  return {
    sb,
    userId: data.user.id,
    orgId: String(membership.org_id),
    role,
    permissions: creatorPermissionsForRole(role)
  };
}
```

- [ ] **Step 5: Implement organization-scoped repository methods and optimistic concurrency**

Create `_shared/repository.ts` with a service-role client. Every read/write includes `organization_id` filtering. `saveProduction` must use this complete insert/update split:

```ts
export async function saveProduction(ctx: CreatorContext, spec: ProductionSpec, expectedVersion?: number) {
  const sb = adminClient();
  const baseRow = {
    organization_id: ctx.orgId,
    title: spec.title,
    brief: spec.brief,
    status: spec.status,
    duration_seconds: spec.durationSeconds,
    aspect_ratio: spec.aspectRatio,
    resolution_preference: spec.resolutionPreference,
    audio_enabled: spec.audioEnabled,
    production_spec_json: spec,
    updated_at: new Date().toISOString()
  };

  const { data: existing, error: existingError } = await sb
    .from('creator_productions')
    .select('id,version')
    .eq('organization_id', ctx.orgId)
    .eq('id', spec.id)
    .maybeSingle();
  if (existingError) throw creatorError('persistence_failed', 500);

  if (!existing) {
    const { data, error } = await sb
      .from('creator_productions')
      .insert({ ...baseRow, id: spec.id, created_by: ctx.userId, version: 1 })
      .select('*')
      .single();
    if (error || !data) throw creatorError('persistence_failed', 500);
    return data;
  }

  const version = expectedVersion ?? spec.version;
  const { data, error } = await sb
    .from('creator_productions')
    .update({ ...baseRow, version: version + 1 })
    .eq('organization_id', ctx.orgId)
    .eq('id', spec.id)
    .eq('version', version)
    .select('*')
    .maybeSingle();
  if (error) throw creatorError('persistence_failed', 500);
  if (!data) throw creatorError('version_conflict', 409);
  return data;
}
```

`writeCreatorAudit` writes `org_id`, `user_id`, action, `table_name: 'creator_director'`, record ID, and safe metadata to existing `audit_logs`. Never include compiled secrets or raw provider credentials.

- [ ] **Step 6: Implement truthful provider readiness**

`listProviderReadiness(orgId)` loads `creator_provider_instances`. Normalize missing provider rows into five explicit `unconfigured` entries:

```ts
{
  providerId,
  displayName: providerLabel(providerId),
  connectionState: 'unconfigured',
  capability: null,
  estimatedCost: null,
  lastVerifiedAt: null
}
```

A stored row may return `ready` only when its persisted `state` is `ready` and `last_verified_at` is non-null. The server must not promote a row based on static browser/provider registry data.

- [ ] **Step 7: Implement API routing and permission checks**

In `index.ts`, use `requireCreatorPermission` before each handler. `creator.read` gates readiness/providers/productions/production/assets; `creator.write` gates save; `creator.generate` gates submit.

Routing:

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

- [ ] **Step 8: Implement the fail-closed submission boundary**

`handleSubmit` loads the persisted production and selected provider metadata, converts `capability_json` to `ProviderCapability`, validates server-side, and rejects before creating a generation job unless all gates pass:

```ts
if (!provider || provider.connectionState !== 'ready') {
  throw creatorError('provider_not_ready', 409);
}
const validation = validateProductionSpec(spec, provider.capability);
if (validation.status === 'blocking') {
  throw creatorError('production_blocked', 409);
}
throw creatorError('provider_adapter_not_configured', 503);
```

`provider_adapter_not_configured` is the real dependency boundary for this milestone. Do not create a generation job, return a fake provider ID, spend credits, or change production status to `generating`.

- [ ] **Step 9: Run Edge contract and integration tests**

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

### Task 6: Add the browser API and local Director reducer

**Files:**
- Create: `apps/web/src/lib/creatorApi.ts`
- Create: `apps/web/src/modules/creator/director/directorState.ts`
- Create: `tests/unit/creator-api.test.ts`
- Modify: `tests/unit/atlas-director-domain.test.ts`

**Interfaces:**
- `creatorRequest<T>(api, params?, init?): Promise<T>`.
- `getCreatorReadiness`, `listCreatorProviders`, `listCreatorProductions`, `getCreatorProduction`, `saveCreatorProduction`, `listCreatorAssets`, `submitCreatorProduction`.
- `createDirectorState`, `directorReducer`, `isDirty`.

- [ ] **Step 1: Write the failing API and reducer tests**

Create `tests/unit/creator-api.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listCreatorProviders } from '../../apps/web/src/lib/creatorApi';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('atlas_access_token', 'test-token');
});

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
```

Add reducer assertions to `atlas-director-domain.test.ts`:

```ts
const initial = createDirectorState(createEmptyProductionSpec());
const withScene = directorReducer(initial, { type: 'scene.add', scene: createEmptyScene() });
expect(withScene.spec.scenes).toHaveLength(1);
expect(withScene.dirty).toBe(true);
```

- [ ] **Step 2: Run and verify failure**

```bash
npx vitest run tests/unit/creator-api.test.ts tests/unit/atlas-director-domain.test.ts
```

Expected: FAIL because API/reducer files do not exist.

- [ ] **Step 3: Implement `creatorApi.ts` using the existing ATLAS session pattern**

Mirror `hospitalityApi.ts`: use `getAtlasAccessToken()`, retry after `getActiveAtlasOrganization()` on 401, include publishable key, and throw normalized request errors.

Core function:

```ts
export async function creatorRequest<T>(
  api: string,
  params: Record<string, string | undefined> = {},
  init: RequestInit = {}
): Promise<T> {
  let token = getAtlasAccessToken();
  if (!token) throw new Error('authentication_required');
  const suffix = query({ api, ...params });
  const url = `${SUPABASE_URL}/functions/v1/atlas-creator?${suffix}`;
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

Import canonical types from `../../../../packages/creator/types` and do not redeclare them in `creatorApi.ts`.

- [ ] **Step 4: Implement exact API methods**

```ts
export const getCreatorReadiness = () => creatorRequest<CreatorReadinessResponse>('readiness');
export async function listCreatorProviders() {
  const data = await creatorRequest<{ ok: true; providers: ProviderReadiness[] }>('providers');
  return data.providers;
}
export async function listCreatorProductions() {
  const data = await creatorRequest<{ ok: true; productions: ProductionSummary[] }>('productions');
  return data.productions;
}
export async function getCreatorProduction(id: string) {
  const data = await creatorRequest<{ ok: true; production: ProductionSpec }>('production', { id });
  return data.production;
}
export async function saveCreatorProduction(spec: ProductionSpec, expectedVersion: number) {
  const data = await creatorRequest<{ ok: true; production: ProductionSpec }>('save', {}, {
    method: 'POST', body: JSON.stringify({ spec, expected_version: expectedVersion })
  });
  return data.production;
}
export async function submitCreatorProduction(productionId: string, providerId: ProviderId) {
  return creatorRequest<{ ok: true; job: unknown }>('submit', {}, {
    method: 'POST', body: JSON.stringify({ production_id: productionId, provider_id: providerId })
  });
}
```

- [ ] **Step 5: Implement the reducer with exact actions**

Create `directorState.ts` with immutable actions for root fields, subjects, scenes, shots, continuity rules, negative constraints, provider selection, and save success. Use:

```ts
export type DirectorState = { spec: ProductionSpec; dirty: boolean };
export function createDirectorState(spec: ProductionSpec): DirectorState {
  return { spec, dirty: false };
}
```

`shot.move` swaps the selected shot with its neighbor and then rewrites every shot's `order` to `index + 1`. `save.succeeded` updates the persisted ID/version/timestamp and sets `dirty: false`.

- [ ] **Step 6: Run tests and typecheck**

```bash
npx vitest run tests/unit/creator-api.test.ts tests/unit/atlas-director-domain.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

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
- `DirectorWorkspace` owns one local production edit session and the active step.
- Existing Image/Music/Voice composer behavior remains unchanged.
- Query parsing uses React Router `useSearchParams()`.

- [ ] **Step 1: Add the failing Video Lab integration test**

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
  expect(screen.getByRole('button', { name: 'Generate video' })).toBeDisabled();
});
```

Retain the existing Image Lab assertion that `Generate image` remains disabled when no provider is configured.

- [ ] **Step 2: Run and verify failure**

```bash
npx vitest run tests/integration/atlas-creator-route.test.tsx
```

Expected: FAIL because Video still renders the generic composer.

- [ ] **Step 3: Refactor query handling and integrate Director**

In `CreatorStudioPage.tsx` import `useSearchParams`, read `type`, and render `<DirectorWorkspace />` when the active media kind is `video`. Preserve the existing generic composer branch for image/music/voice.

```tsx
const [searchParams] = useSearchParams();
const initial = searchParams.get('type');
const [kind, setKind] = useState<MediaKind>(
  initial === 'video' || initial === 'music' || initial === 'voice' ? initial : 'image'
);

if (kind === 'video') return <DirectorWorkspace />;
```

- [ ] **Step 4: Implement the ten-step Director shell**

Use exactly:

```ts
export const DIRECTOR_STEPS = [
  'Creative Brief', 'Subject / Entity', 'Environment', 'Stages & Shots',
  'Continuity', 'Visual Style', 'Camera & Motion', 'Audio',
  'Provider & Cost', 'Review & Generate'
] as const;
```

Render the step rail as `<nav aria-label="Production steps">`. Step buttons set the active index. Back is disabled at index 0; Next is disabled at the last step. State lives in one reducer and survives all step changes.

- [ ] **Step 5: Implement responsive layout primitives**

Create `director.css`:

```css
.director-shell{display:grid;grid-template-columns:220px minmax(0,1fr) 320px;gap:16px}
.director-step-rail{position:sticky;top:16px;align-self:start}
.director-main,.director-context{min-width:0}
.director-step-button:focus-visible,.director-action:focus-visible{outline:2px solid currentColor;outline-offset:3px}
@media(max-width:1050px){.director-shell{grid-template-columns:180px minmax(0,1fr)}.director-context{grid-column:1/-1}}
@media(max-width:720px){.director-shell{display:block}.director-step-rail{position:static;overflow:auto}.director-steps{display:flex;min-width:max-content}.director-context{margin-top:16px}}
```

- [ ] **Step 6: Add readiness loading and truthful save state**

On mount call `getCreatorReadiness()`. Render `loading`, `error`, and resolved permission states. `Save draft` is disabled unless `creator.write` is present. On save call `saveCreatorProduction(state.spec, state.spec.version)`, dispatch `save.succeeded` on success, and show `version_conflict` without overwriting on HTTP 409.

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

### Task 8: Implement production editors, scene/shot CRUD, and continuity controls

**Files:**
- Create: `apps/web/src/modules/creator/director/BriefSubjectEnvironment.tsx`
- Create: `apps/web/src/modules/creator/director/SceneShotEditor.tsx`
- Create: `apps/web/src/modules/creator/director/ContinuityStyleAudio.tsx`
- Modify: `apps/web/src/modules/creator/director/DirectorWorkspace.tsx`
- Modify: `apps/web/src/modules/creator/director/director.css`
- Modify: `tests/integration/atlas-creator-route.test.tsx`

**Interfaces:**
- Editors receive `spec` plus reducer `dispatch` and own no duplicate source of truth.
- `SceneShotEditor` renders `data-testid="director-shot-card"` on each shot card for deterministic interaction tests.

- [ ] **Step 1: Add failing state-preservation and shot-order tests**

```tsx
it('keeps the creative brief while moving between steps', () => {
  render(<MemoryRouter initialEntries={['/studio/create?type=video']}><CreatorWorkspace /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Creative brief'), {
    target: { value: 'ATLAS payroll cinematic launch' }
  });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByLabelText('Creative brief')).toHaveValue('ATLAS payroll cinematic launch');
});

it('adds and reorders shots with accessible controls', () => {
  render(<MemoryRouter initialEntries={['/studio/create?type=video']}><CreatorWorkspace /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Stages & Shots' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add scene' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add shot' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add shot' }));
  const cardsBefore = screen.getAllByTestId('director-shot-card');
  expect(within(cardsBefore[0]).getByText('Shot 1')).toBeInTheDocument();
  expect(within(cardsBefore[1]).getByText('Shot 2')).toBeInTheDocument();
  fireEvent.click(within(cardsBefore[1]).getByRole('button', { name: 'Move shot up' }));
  const cardsAfter = screen.getAllByTestId('director-shot-card');
  expect(within(cardsAfter[0]).getByText('Shot 1')).toBeInTheDocument();
  expect(cardsAfter[0]).not.toBe(cardsBefore[0]);
});
```

Update imports to include `fireEvent` and `within`.

- [ ] **Step 2: Run and verify failure**

```bash
npx vitest run tests/integration/atlas-creator-route.test.tsx
```

Expected: FAIL because the editors do not exist.

- [ ] **Step 3: Implement Creative Brief, Subject, and Environment editors**

Creative Brief controls title, brief, duration, aspect ratio, resolution, and audio enabled. Subject cards expose label, description, identity lock, appearance traits, material traits, allowed transformations, forbidden changes, and reference asset IDs. Environment controls expose every `EnvironmentSpec` field.

Use controlled fields such as:

```tsx
<label>
  <span>Creative brief</span>
  <textarea
    aria-label="Creative brief"
    value={spec.brief}
    onChange={event => dispatch({ type: 'field.set', field: 'brief', value: event.target.value })}
  />
</label>
```

List-valued text controls split newline input into trimmed non-empty strings and join arrays with `\n` for editing.

- [ ] **Step 4: Implement full scene and shot CRUD**

Scene actions: Add scene, Remove scene, Add shot. Shot actions: Duplicate shot, Remove shot, Move shot up, Move shot down. Duplicate creates a new UUID and inserts immediately after the source; order is then normalized.

Each shot card exposes controlled timing, action, subject selection, camera fields, motion direction/speed/physicality, lighting, materials, audio cue IDs, transitions, continuity notes, and shot-level negative constraints.

Core timing controls:

```tsx
<input type="number" step="0.1" aria-label="Shot start" value={shot.startSecond}
  onChange={event => updateShot({ startSecond: Number(event.target.value) })} />
<input type="number" step="0.1" aria-label="Shot end" value={shot.endSecond}
  onChange={event => updateShot({ endSecond: Number(event.target.value) })} />
<textarea aria-label="Shot action" value={shot.action}
  onChange={event => updateShot({ action: event.target.value })} />
```

- [ ] **Step 5: Implement continuity and negative-constraint editors**

Continuity Add creates a rule using the exact `ContinuityRule` fields. Each rule is editable and removable. Negative constraints expose scope, value, severity and removal. Empty descriptions remain visibly incomplete and are handled by validation; do not auto-invent text.

- [ ] **Step 6: Implement visual style, camera defaults, motion rules, and audio**

Map every property in `VisualStyleSpec`, `CameraSpec`, `MotionRule`, and `AudioPlan` to controlled inputs. Motion rules allow add/remove and explicit subject selection. Audio lists use newline-to-array normalization.

- [ ] **Step 7: Render live deterministic validation context**

Compute `validateProductionSpec(state.spec)` with `useMemo`. Render warning/blocking chips and a `Go to section` button. Map issue sections to step indexes explicitly:

```ts
const ISSUE_STEP: Record<ValidationIssue['section'], number> = {
  brief: 0, subjects: 1, environment: 2, shots: 3, continuity: 4,
  style: 5, camera: 6, audio: 7, provider: 8, review: 9
};
```

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

### Task 9: Implement Provider & Cost, Review & Generate, Library provenance, and Providers readiness

**Files:**
- Create: `apps/web/src/modules/creator/director/ProviderGate.tsx`
- Create: `apps/web/src/modules/creator/director/ReviewPanel.tsx`
- Modify: `apps/web/src/modules/creator/director/DirectorWorkspace.tsx`
- Modify: `apps/web/src/modules/creator/CreatorStudioPage.tsx`
- Modify: `apps/web/src/modules/creator/director/director.css`
- Modify: `tests/integration/atlas-creator-route.test.tsx`

**Interfaces:**
- `ProviderGate` consumes server `ProviderReadiness[]` and selected provider.
- `ReviewPanel` consumes validation plus compiled provider request.
- Creator Library and Providers use `creatorApi` rather than hard-coded arrays.

- [ ] **Step 1: Add failing truthful-readiness tests**

Mock `creatorApi.listCreatorProviders` and navigate by the real step button:

```tsx
it('shows an unconfigured provider without inventing cost or readiness', async () => {
  vi.spyOn(creatorApi, 'listCreatorProviders').mockResolvedValue([
    {
      providerId: 'seedance', displayName: 'Seedance',
      connectionState: 'unconfigured', capability: null,
      estimatedCost: null, lastVerifiedAt: null
    }
  ]);
  render(<MemoryRouter initialEntries={['/studio/create?type=video']}><CreatorWorkspace /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Provider & Cost' }));
  expect(await screen.findByText('unconfigured')).toBeInTheDocument();
  expect(screen.getByText('Cost estimate unavailable until provider configuration is verified.')).toBeInTheDocument();
});
```

Add a Review test that clicks `Review & Generate` and confirms `Generate video` is disabled for the unconfigured provider.

- [ ] **Step 2: Run and verify failure**

```bash
npx vitest run tests/integration/atlas-creator-route.test.tsx
```

Expected: FAIL because ProviderGate/ReviewPanel are not implemented.

- [ ] **Step 3: Implement ProviderGate with server-only truth**

For every server result display connection state, last verified timestamp or `Never verified`, capability summary only when `capability !== null`, requested settings, deterministic compatibility issues, current estimated cost only when `estimatedCost !== null`, and the exact unavailable message otherwise.

Provider selection dispatches:

```ts
dispatch({ type: 'provider.select', providerId: provider.providerId });
```

- [ ] **Step 4: Implement ReviewPanel and compiled prompt preview**

Use:

```tsx
const compiled = spec.providerPreference
  ? compileProviderRequest(spec, spec.providerPreference, selectedCapability || undefined)
  : null;
```

Render validation status/issues, provider compatibility, a read-only compiled prompt region, normalized params, unsupported features, adaptation notes, and an explicit `Select a provider to compile a provider request.` empty state when no provider is selected.

- [ ] **Step 5: Implement the final Generate gate**

```ts
const canGenerate =
  hasCreatorPermission(readiness.permissions, 'creator.generate') &&
  selectedProvider?.connectionState === 'ready' &&
  validation.status !== 'blocking' &&
  !submitting;
```

Render:

```tsx
<button type="button" disabled={!canGenerate} onClick={submit}>Generate video</button>
```

`submit` calls `submitCreatorProduction`. If the server returns `provider_adapter_not_configured`, show that error and keep local/persisted state out of `generating`. Only a future provider-accepted response may transition the UI to generating.

- [ ] **Step 6: Replace the hard-coded Creator Providers view**

Delete the current static `providers` array from `CreatorStudioPage.tsx`. `CreatorProviders` loads `listCreatorProviders()` and renders loading/error/unconfigured/verified states from the server response. Do not map the existing OpenAI/Google AI/Suno placeholder list onto video-provider readiness.

- [ ] **Step 7: Connect Creator Library to real productions/assets**

`CreatorLibrary` loads `listCreatorProductions()` and `listCreatorAssets()`. Search filters loaded production title/brief and asset provider/media metadata. Production cards show persisted status/version/updated timestamp. Asset cards show provider/provenance only for real rows. An empty dataset continues to render an explicit empty state.

- [ ] **Step 8: Run integration tests, typecheck, and build**

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
- Modify: `tests/integration/atlas-creator-route.test.tsx`
- No planned production-code changes. If verification identifies a defect, return to the task that owns that code, add a failing regression test there, fix it, rerun that task's checks, then resume Task 10.

**Interfaces:**
- Produces verification evidence only; no new product API.

- [ ] **Step 1: Add final accessibility regression assertions**

```tsx
expect(screen.getByRole('navigation', { name: 'Production steps' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
expect(screen.getByLabelText('Creative brief')).toHaveAccessibleName('Creative brief');
```

For repeated shot controls, accessible names must include the shot context or the controls must be scoped inside the shot card with unique labels.

- [ ] **Step 2: Run all tests**

```bash
npm run test:unit
npm run test:integration
npm test
```

Expected: PASS with no skipped/focused ATLAS Director tests.

- [ ] **Step 3: Run TypeScript and production build**

```bash
npm run typecheck
npm run build
```

Expected: PASS with zero TypeScript errors and a successful Vite production bundle.

- [ ] **Step 4: Run the repository Cloudflare verification script**

```bash
npm run verify:cloudflare
```

Expected: PASS. If `npm audit --audit-level=high` fails on a pre-existing advisory, record the exact advisory and do not claim full repository verification until it is resolved or explicitly accepted by the repository owner.

- [ ] **Step 5: Verify route behavior locally**

```bash
npm run dev -- --host 127.0.0.1
```

Verify:

```text
/studio
/studio/create?type=image
/studio/create?type=video
/studio/library
/studio/providers
```

Expected behavior: no 404/500; identity gating remains in App routing; Image Lab retains truthful unconfigured state; Video opens ATLAS Director; Back/Next work at desktop and mobile widths; Save shows real auth/permission/persistence outcomes; Generate remains disabled until a verified provider plus passing validation; Library/Providers show real data or real empty/unconfigured states.

- [ ] **Step 6: Inspect feature diff for secret exposure**

```bash
git diff main...HEAD -- . ':!package-lock.json' | grep -Ei 'api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|service[_-]?role|provider[_-]?secret' || true
```

Expected: only variable names/documentation references; no credential value introduced by this feature.

- [ ] **Step 7: Inspect final diff and CI state**

```bash
git diff --stat main...HEAD
git status --short
```

Expected: only ATLAS Director/shared Creator changes plus approved spec/plan; working tree clean.

Push `feat/atlas-director` and inspect PR #78 checks. Do not merge while a required check is pending or failing.

- [ ] **Step 8: Report the exact production-readiness matrix**

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

- [ ] **Step 9: Request the merge/deploy checkpoint**

Only after explicit repository-owner approval: merge PR #78 to `main`, allow the established production deployment path to run, apply/deploy the Supabase migration and `atlas-creator` function through the authorized environment, then verify `https://www.atlasenterprisesuite.com/studio/create?type=video` through the authenticated production flow. Do not describe provider generation as production-ready while `Provider adapter configured` or `Production generation verified` remains `NO`.
