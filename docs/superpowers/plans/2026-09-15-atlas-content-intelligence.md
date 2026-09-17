# ATLAS Content Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a governed, tenant-aware Content Intelligence workflow to ATLAS Studio that transforms creator context into audience insights, ideas, hooks, structured drafts, channel variants, review output, and Director/Social Publisher handoffs.

**Architecture:** Keep the existing ATLAS Creator stack. Add one pure TypeScript content-intelligence domain module, persist workspace state through the existing authenticated `atlas-creator` Edge boundary, expose one new Creator page at `/studio/content`, and extend Director/Social Publisher to consume optional governed React Router handoff state. No paid provider calls are introduced.

**Tech Stack:** React 18, TypeScript, React Router, Vitest/jsdom, Supabase Edge Functions/Postgres, existing ATLAS Creator permissions/audit patterns.

**Spec:** `docs/superpowers/specs/2026-09-15-atlas-content-intelligence-design.md`

## Global Constraints

- Preserve existing ATLAS Identity, organization context, Creator permissions, audit behavior and routes.
- Never trust browser-supplied organization identity.
- No paid provider calls or fabricated provider-readiness state.
- Use optimistic workspace versioning.
- Keep publishing and rendering behind their existing real readiness/authorization gates.
- Implement with TDD: failing test first, then minimal production code.

---

### Task 1: Content Intelligence domain

**Files:**
- Create: `tests/unit/atlas-content-intelligence.test.ts`
- Create: `packages/creator/content_intelligence.ts`

**Interfaces:**
- Produces: `CreatorProfile`, `AudienceProfile`, `ContentIdea`, `HookVariant`, `ContentDraft`, `RepurposedVariant`, `ContentReview`, `ContentWorkspaceState`.
- Produces: `createContentWorkspaceState`, `generateAudienceInsights`, `generateContentIdeas`, `generateHookVariants`, `buildStructuredDraft`, `repurposeDraft`, `reviewDraft`, `createDirectorHandoff`, `createPublisherHandoff`.

- [ ] **Step 1: Write failing domain tests**

Create tests that assert:

```ts
const workspace = createContentWorkspaceState();
expect(workspace.version).toBe(0);
expect(workspace.profile.platforms).toEqual([]);

const audience = generateAudienceInsights(profile, 'Busy owners need easier financial operations');
expect(audience.problems.length).toBeGreaterThanOrEqual(3);
expect(audience.questions.length).toBeGreaterThanOrEqual(3);

const ideas = generateContentIdeas(profile, audience);
expect(ideas.length).toBeGreaterThanOrEqual(6);
expect(ideas[0].score).toBeGreaterThanOrEqual(ideas[1].score);

const hooks = generateHookVariants(ideas[0], profile);
expect(hooks).toHaveLength(5);

const draft = buildStructuredDraft(ideas[0], hooks[0], profile);
expect(draft.introduction).toContain(hooks[0].text);
expect(draft.bodyPoints.length).toBeGreaterThanOrEqual(3);
expect(draft.cta.length).toBeGreaterThan(0);

const variants = repurposeDraft(draft);
expect(variants.map(item => item.platform)).toEqual(['instagram','tiktok','youtube','linkedin','x']);

const review = reviewDraft(draft);
expect(review.overallScore).toBeGreaterThanOrEqual(0);
expect(review.overallScore).toBeLessThanOrEqual(100);
expect(createDirectorHandoff(draft).atlasContentHandoff.brief).toContain(draft.title);
expect(createPublisherHandoff(variants[0]).atlasContentHandoff.caption).toBe(variants[0].content);
```

- [ ] **Step 2: Verify RED**

Run `npm run test:unit -- tests/unit/atlas-content-intelligence.test.ts` and confirm failure because `packages/creator/content_intelligence.ts` does not exist.

- [ ] **Step 3: Implement deterministic domain functions**

Use stable templates derived only from provided profile/audience/draft text. Normalize whitespace, rank ideas with deterministic scores, produce exactly five hook styles and five platform variants, and score review criteria without network access.

- [ ] **Step 4: Verify GREEN**

Run the focused test and confirm pass.

- [ ] **Step 5: Commit**

Commit message: `feat: add content intelligence domain engine`.

---

### Task 2: Tenant-scoped persistence and Creator API

**Files:**
- Create: `supabase/migrations/20260915043000_creator_content_intelligence.sql`
- Modify: `supabase/functions/atlas-creator/_shared/repository.ts`
- Modify: `supabase/functions/atlas-creator/index.ts`
- Modify: `apps/web/src/lib/creatorApi.ts`
- Create: `tests/unit/atlas-content-intelligence-api.test.ts`

**Interfaces:**
- Produces API routes `content-workspaces`, `content-workspace`, `content-save`.
- Produces client functions `listContentWorkspaces`, `getContentWorkspace`, `saveContentWorkspace`.

- [ ] **Step 1: Write failing API contract tests**

Tests read Edge/client source and assert the three route names, `creator.read`/`creator.write` gates, server-side `organization_id` filtering, optimistic version conflict handling, and typed client functions.

- [ ] **Step 2: Verify RED**

Run the focused API test and confirm the missing routes/functions fail assertions.

- [ ] **Step 3: Add migration**

Create `creator_content_workspaces` with `uuid` PK, `organization_id`, `created_by`, `title`, `state_json jsonb`, `version`, timestamps, organization/update indexes, RLS enabled, and no authenticated browser policy.

- [ ] **Step 4: Extend repository**

Add organization-scoped list/get/save functions. On save, overwrite `organization_id` and `created_by` from `CreatorContext`; insert at version `1`; update only when persisted `version` equals `expected_version`; throw `version_conflict` on zero-row update.

- [ ] **Step 5: Extend Edge routes**

Add handlers with existing `creatorContext` permission gates. Audit successful saves as `creator.content.saved`.

- [ ] **Step 6: Extend web API client**

Add typed wrappers that map wire rows into `ContentWorkspaceState` plus persistence metadata.

- [ ] **Step 7: Verify GREEN**

Run focused API contract test.

- [ ] **Step 8: Commit**

Commit message: `feat: persist content intelligence workspaces`.

---

### Task 3: Content Intelligence UI and navigation

**Files:**
- Create: `apps/web/src/modules/creator/content/ContentIntelligencePage.tsx`
- Create: `apps/web/src/modules/creator/content/content-intelligence.css`
- Modify: `apps/web/src/modules/creator/CreatorStudioPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Create: `tests/unit/atlas-content-intelligence-ui.test.ts`

**Interfaces:**
- Route: `/studio/content`.
- Consumes Task 1 domain and Task 2 Creator API.

- [ ] **Step 1: Write failing UI/source contract test**

Assert `/studio/content` is routed, Studio home links to it, page contains the seven named stages, save action calls `saveContentWorkspace`, and action links target Director and Social Publisher.

- [ ] **Step 2: Verify RED**

Run focused UI test and confirm failure because the page/route does not exist.

- [ ] **Step 3: Implement page**

Build a responsive stage workspace with profile inputs, audience seed, generated insight lists, ranked ideas, hook variants, draft editor/output, repurposed variants, review scores/recommendations, workspace list/load/save, and explicit loading/error/success/empty states.

- [ ] **Step 4: Add Studio navigation and route**

Add Content Intelligence to the Studio home and authenticated route graph without removing existing Creator routes.

- [ ] **Step 5: Verify GREEN**

Run focused UI test.

- [ ] **Step 6: Commit**

Commit message: `feat: add ATLAS Content Intelligence workspace`.

---

### Task 4: Governed handoffs to Director and Social Publisher

**Files:**
- Modify: `apps/web/src/modules/creator/director/DirectorWorkspace.tsx`
- Modify: `apps/web/src/modules/business/social/SocialPublisherPage.tsx`
- Create: `tests/unit/atlas-content-intelligence-handoff.test.ts`

**Interfaces:**
- Director consumes `location.state.atlasContentHandoff.{title,brief,narration}` once when initializing an empty production.
- Social Publisher consumes `location.state.atlasContentHandoff.{caption,platform?}` as draft-only state.

- [ ] **Step 1: Write failing handoff tests**

Assert both target pages import/use `useLocation`, consume `atlasContentHandoff`, and preserve existing readiness/connection gates.

- [ ] **Step 2: Verify RED**

Run focused handoff test and confirm failure.

- [ ] **Step 3: Implement Director handoff**

Initialize `createEmptyProductionSpec()` with title/brief/dialogue seed only when a valid handoff exists. Do not auto-save or auto-render.

- [ ] **Step 4: Implement Social Publisher handoff**

Prefill caption and supported platform on first render. Do not bypass media validation or connection requirements.

- [ ] **Step 5: Verify GREEN**

Run focused handoff test.

- [ ] **Step 6: Commit**

Commit message: `feat: connect content intelligence handoffs`.

---

### Task 5: Full verification and integration

**Files:**
- Modify only if verification exposes a regression.

- [ ] **Step 1: Run typecheck**

Run `npm run typecheck` and require exit `0`.

- [ ] **Step 2: Run unit suite**

Run `npm run test:unit` and require zero failures.

- [ ] **Step 3: Run integration suite**

Run `npm run test:integration` and require zero failures.

- [ ] **Step 4: Run production build**

Run `npm run build` and require exit `0`.

- [ ] **Step 5: Review branch diff against spec**

Confirm route, persistence, permissions, audit, responsive UI, Director handoff, Publisher handoff and no paid-provider execution.

- [ ] **Step 6: Open PR**

Create PR from `feat/atlas-content-intelligence` to `main` with verification evidence.

- [ ] **Step 7: Verify PR checks**

Inspect commit/PR checks and resolve failures before merge.

- [ ] **Step 8: Merge only when checks are green**

Squash merge to `main` using the expected head SHA.

- [ ] **Step 9: Post-merge verification**

Verify merged commit status/workflow runs. Do not claim Supabase/public production deployment unless migration, Edge Function, and site deployment are independently evidenced.