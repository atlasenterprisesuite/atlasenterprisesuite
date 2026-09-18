# ATLAS Creative Studio Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the Unified Creator Composer so one creative brief becomes a persisted provider-neutral CreativePlan with specialized prompts, zero-cost-first engine selection, SFX/graphics/template planning, and responsive truthful states while preserving ATLAS Director.

**Architecture:** Add a pure `CreativePlan` domain and deterministic media specialization in `packages/creator`; persist plans in a tenant-scoped Supabase table through the existing `atlas-creator` edge function; expose browser APIs; then upgrade the existing `/studio/create` workspace rather than adding routes. Video continues to delegate to ATLAS Director.

**Tech Stack:** TypeScript, React 18, Vite, Vitest, Supabase Edge Functions/Deno, PostgreSQL/RLS, existing ATLAS Identity/RBAC and Creator Engine Registry.

**Spec:** `docs/superpowers/specs/2026-09-15-atlas-creative-zero-cost-design.md`

## Global Constraints
- Preserve existing Creator routes and ATLAS Director behavior.
- Support exactly: image, video, music, voice, sfx, graphic, template.
- Persist every CreativePlan with organization scope and optimistic versioning.
- Never create a generation job or CreatorAsset for planning or prompt export.
- Engine selection follows the existing zero-cost-first ranking and never invents readiness.
- `creator.read` reads plans; `creator.write` creates/updates plans.
- No provider credentials in browser responses.
- Required final gates: `npm run verify:all`, PR CI, merged-SHA production readiness, Cloudflare runtime verification.

---

### Task 1: CreativePlan domain and specialized prompts

**Files:**
- Create: `packages/creator/creative_plan.ts`
- Modify: `packages/creator/prompt_engine.ts`
- Create: `tests/unit/creator-creative-plan.test.ts`

**Interfaces:**
- `CreativePlanInput`
- `CreativePlan`
- `CreativeDeliverable`
- `CreativeAccessibilityPlan`
- `buildCreativePlan(input, engines, identity)`
- `compileSpecializedPrompt(plan, mediaKind)`

- [ ] Write failing tests proving all seven media kinds normalize, SFX/graphics/template deliverables are generated, accessibility requirements are retained, and the selected engine is the first ready engine from zero-cost ranking.
- [ ] Run `npx vitest run tests/unit/creator-creative-plan.test.ts` and confirm RED because the module/functions do not exist.
- [ ] Implement immutable provider-neutral planning. The source brief remains unchanged; normalized objective is trimmed; each requested media kind receives one deterministic deliverable and one prompt artifact.
- [ ] Specialized prompt sections:
  - image/graphic/template: composition, aspect, audience, destination, alt-text intent;
  - music: mood/use/duration intent;
  - voice: script/tone/language/transcript;
  - sfx: cue/texture/duration intent;
  - video: Director handoff note only, not a duplicate video spec.
- [ ] Use `rankCreativeEngines` to select the first ready compatible engine; prompt-export remains the fallback.
- [ ] Re-run focused unit test and Creator domain regressions.

### Task 2: Persist CreativePlan with tenant isolation

**Files:**
- Create: `supabase/migrations/20260918141000_creator_creative_plans.sql`
- Modify: `supabase/functions/atlas-creator/_shared/repository.ts`
- Modify: `supabase/functions/atlas-creator/index.ts`
- Modify: `tests/integration/atlas-director-edge-contract.test.ts`
- Create: `tests/unit/creator-creative-plan-persistence-contract.test.ts`

**Interfaces:**
- `listCreativePlans(orgId)`
- `getCreativePlan(orgId, planId)`
- `saveCreativePlan(ctx, plan, expectedVersion)`
- GET `?api=creative-plans`
- GET `?api=creative-plan&id=<uuid>`
- POST `?api=creative-plan-save`

- [ ] Write failing source-contract tests asserting table, RLS, org predicates, creator.read/write route gates and optimistic version checks.
- [ ] Run focused tests and confirm RED.
- [ ] Add `creator_creative_plans` with id, organization_id, created_by, title, source_brief, media_kinds, plan_json, version, created_at, updated_at; RLS read policy for active members; browser role receives SELECT only.
- [ ] Implement repository methods using service role but always filtering by `organization_id`; server overwrites organization/user identity and enforces expected version.
- [ ] Route reads through `creator.read`, writes through `creator.write`; write audit events `creator.plan.saved`.
- [ ] Re-run focused tests and edge/source verification.

### Task 3: Browser API for plans

**Files:**
- Modify: `apps/web/src/lib/creatorApi.ts`
- Modify: `tests/unit/creator-api.test.ts`

**Interfaces:**
- `listCreativePlans()`
- `getCreativePlan(id)`
- `saveCreativePlan(plan, expectedVersion)`

- [ ] Add failing API tests for authenticated routes and wire-format mapping.
- [ ] Run focused test and confirm RED.
- [ ] Implement API helpers through existing `creatorRequest`; no direct Supabase table writes from browser.
- [ ] Re-run test and typecheck.

### Task 4: Unified seven-mode composer

**Files:**
- Modify: `apps/web/src/modules/creator/CreatorStudioPage.tsx`
- Modify: `apps/web/src/modules/creator/creator.css`
- Modify: `tests/integration/atlas-creator-route.test.tsx`

**Interfaces:**
- Uses `buildCreativePlan`, `listCreativeEngines`, `saveCreativePlan`, `exportCreatorPrompt`.
- Video still returns `<DirectorWorkspace />`.

- [ ] Add failing integration tests proving tabs for image/video/music/voice/sfx/graphic/template, Plan creation, Save plan, prompt specialization preview, engine/fallback status, accessibility controls, and unchanged Director route.
- [ ] Run integration test and confirm RED.
- [ ] Add fields: brief, destination, audience, aspect ratio, language, accessibility toggles (captions, transcript, alt text, audio description), negative constraints.
- [ ] Add `Create plan` action that builds the local plan and renders deliverables/prompt preview.
- [ ] Add `Save plan` action using optimistic versioning.
- [ ] Keep `Generate` disabled unless a non-prompt-export ready engine exists.
- [ ] Keep Prompt Export as fallback; export the selected plan/media prompt rather than pretending to generate media.
- [ ] Add responsive 3-panel desktop / single-column mobile CSS and semantic status/labels.
- [ ] Re-run integration and unit regressions.

### Task 5: Full verification, PR, merge and production evidence

- [ ] Run/observe `npm run verify:all` on the exact branch HEAD through repository CI.
- [ ] Require CodeQL and ATLAS Consensus success.
- [ ] Review changed files against Phase 2 acceptance criteria and verify no Phase 3+ features were accidentally implemented.
- [ ] Merge only after green PR evidence.
- [ ] Require merged SHA to pass ATLAS Build + Production Readiness Gate.
- [ ] Require Cloudflare workflow to pass `Verify complete repository`, deploy, public routes, authorized runtime and evidence recording.
- [ ] Do not claim Phase 2 complete before all of the above are green.

## Phase Boundary

Phase 2 ends with a persisted, provider-neutral multimodal planning experience. It does **not** yet extend CreatorAsset provenance/import workflows (Phase 3), add FFmpeg composition/export execution (Phase 4), install OSS generation runtimes (Phase 5), or implement Brand Kit/publishing connectors (Phase 6).
