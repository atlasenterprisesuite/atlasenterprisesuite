# ATLAS Image Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing authenticated Image Lab route into a usable photo-editing workspace with uploads, point annotations, identity-preservation constraints, and fail-closed generation.

**Architecture:** Keep image editing inside ATLAS Creator. A dedicated React workspace owns local source-image preview and edit-point state; the existing authenticated Creator API receives provider-neutral edit requests and refuses execution unless a verified image engine is available.

**Tech Stack:** React 18, TypeScript, Vite, Supabase Edge Functions, Vitest/Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-26-atlas-image-lab-design.md`

## Global Constraints

- Route remains `/studio/create?type=image`.
- Accept JPEG, PNG, WebP only.
- Maximum upload size is 15 MiB.
- Annotation coordinates are normalized to 0..1.
- Preserve identity is explicit and defaults to enabled.
- Generation fails closed when no verified executable image engine exists.
- No output is represented as generated until a persisted asset is returned.

## Review Focus

- Oversized or unsupported uploads must be rejected before submission.
- Responsive preview clicks must produce stable normalized coordinates.
- Removing a marker must not renumber unrelated instructions incorrectly.
- Provider failure must leave the original image and edit plan intact.
- A successful response without a persisted asset must not be shown as generated.

---

### Task 1: Image edit domain contract

**Files:**
- Create: `packages/creator/image_edit.ts`
- Test: `tests/unit/creator-image-edit.test.ts`

**Interfaces:**
- Produces: `normalizeImageEditPoint(x, y, width, height)`, `validateImageEditRequest(request)`, and shared request/result types.

- [ ] Write failing tests for coordinate normalization and request validation.
- [ ] Run `npx vitest run tests/unit/creator-image-edit.test.ts`; expect failure.
- [ ] Implement the minimal domain contract.
- [ ] Re-run the unit test; expect PASS.
- [ ] Commit.

### Task 2: Authenticated Creator API image-edit endpoint

**Files:**
- Modify: `supabase/functions/atlas-creator/index.ts`
- Modify: `apps/web/src/lib/creatorApi.ts`
- Test: `tests/unit/creator-image-edit-edge.test.ts`

**Interfaces:**
- Consumes: Task 1 request validation.
- Produces: `submitImageEdit(form: FormData)` client function and `api=image-edit` endpoint.

- [ ] Write failing tests proving permission checks, input validation, and fail-closed readiness.
- [ ] Run the focused unit test; expect failure.
- [ ] Implement multipart parsing, audit logging, readiness gate, and explicit `image_engine_not_ready` response until a verified adapter exists.
- [ ] Add the typed client wrapper.
- [ ] Re-run focused tests; expect PASS.
- [ ] Commit.

### Task 3: Image Lab workspace

**Files:**
- Create: `apps/web/src/modules/creator/image/ImageLabWorkspace.tsx`
- Modify: `apps/web/src/modules/creator/CreatorStudioPage.tsx`
- Modify: `apps/web/src/modules/creator/creator.css`
- Test: `tests/integration/atlas-creator-route.test.tsx`

**Interfaces:**
- Consumes: Task 1 normalized annotations and Task 2 `submitImageEdit`.
- Produces: authenticated source upload, preview, numbered markers, per-point instructions, global instruction, preserve-identity toggle, and generation button.

- [ ] Add failing integration tests for upload, marker creation, marker removal, preserve-identity default, and fail-closed submission.
- [ ] Run `npx vitest run tests/integration/atlas-creator-route.test.tsx`; expect failure.
- [ ] Implement the workspace and route image mode to it.
- [ ] Add responsive ATLAS styling.
- [ ] Re-run integration tests; expect PASS.
- [ ] Commit.

### Task 4: Verification

**Files:**
- No new production files expected.

- [ ] Run `npm run typecheck`.
- [ ] Run `npm run test:unit`.
- [ ] Run `npm run test:integration`.
- [ ] Run `npm run build`.
- [ ] Open a draft PR to `main` with truthful readiness notes.
