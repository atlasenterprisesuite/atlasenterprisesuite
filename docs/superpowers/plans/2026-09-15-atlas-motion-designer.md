# ATLAS Motion Designer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, provider-neutral editable motion-composition system to the existing ATLAS Director without creating a parallel application.

**Architecture:** Extend `ProductionSpec` with a versioned `MotionCompositionSpec`; keep deterministic graph/evaluation/validation logic in `packages/creator/motion`; expose editing through the existing Director; keep render behind server-verified native capability and existing RBAC/audit boundaries.

**Tech Stack:** TypeScript, React, existing ATLAS Creator package, Vitest/current repository test stack, Supabase Edge Functions, existing Creator persistence/API.

**Spec:** `docs/superpowers/specs/2026-09-15-atlas-motion-designer-design.md`

## Global Constraints
- Reuse `/studio/create?type=video` and ATLAS Director; no parallel app or duplicate route tree.
- `ProductionSpec` remains canonical and motion composition is provider-neutral.
- Never execute arbitrary JavaScript from expressions.
- Never claim render readiness unless the server verifies the required motion capability/version.
- Preserve organization isolation, Creator RBAC, audit and provenance.
- No external credits may be spent by tests, planning, editing, validation or preview.
- Existing Director behavior and tests must remain compatible.

---

### Task 1: Motion domain types and defaults
**Files:** Modify `packages/creator/types.ts`; create `packages/creator/motion/types.ts`, `packages/creator/motion/defaults.ts`; test `packages/creator/motion/defaults.test.ts`.
**Produces:** `MotionCompositionSpec`, `MotionLayer`, `MotionTrack`, `MotionKeyframe`, `MotionExpression`, `createEmptyMotionComposition()`.
- [ ] Write failing tests asserting a 1920x1080/30fps default composition has unique IDs, empty layers, valid duration and deterministic serialization.
- [ ] Run the focused test and verify failure because motion types/defaults do not exist.
- [ ] Implement the exact domain described by the spec and add optional `motionComposition: MotionCompositionSpec | null` to `ProductionSpec`.
- [ ] Run focused tests and typecheck; verify pass.
- [ ] Commit `feat(creator): add motion composition domain`.

### Task 2: Graph and timeline validator
**Files:** Create `packages/creator/motion/validator.ts`, `packages/creator/motion/validator.test.ts`.
**Consumes:** `MotionCompositionSpec` from Task 1. **Produces:** `validateMotionComposition(spec): ValidationIssue[]`.
- [ ] Write failing cases for duplicate IDs, parent cycles, invalid layer ranges, out-of-range keyframes, malformed tracks and valid graphs.
- [ ] Run focused tests and verify failure.
- [ ] Implement deterministic validation with stable issue codes and target IDs; no AI calls.
- [ ] Run focused tests and verify pass.
- [ ] Commit `feat(creator): validate motion composition graphs`.

### Task 3: Easing and deterministic frame evaluator
**Files:** Create `packages/creator/motion/easing.ts`, `packages/creator/motion/evaluator.ts`, tests beside both.
**Produces:** `evaluateTrack(track,time)`, `evaluateLayerAtTime(layer,time)`, `evaluateCompositionFrame(spec,time)`.
- [ ] Write failing interpolation tests for linear, ease-in/out/in-out and cubic-bezier, including boundary times and identical-time protection.
- [ ] Run focused tests and verify failure.
- [ ] Implement numeric/vector interpolation and deterministic layer-frame output; unsupported values return typed validation/evaluation errors rather than guesses.
- [ ] Run focused tests twice and assert identical results.
- [ ] Commit `feat(creator): add deterministic motion evaluator`.

### Task 4: Constrained ATLAS expression DSL
**Files:** Create `packages/creator/motion/expression.ts`, `packages/creator/motion/expression.test.ts`.
**Produces:** `parseMotionExpression(source)`, `evaluateMotionExpression(ast,context)`.
- [ ] Write failing allowlist tests for arithmetic, time, sin/cos, clamp, lerp and explicit property references; rejection tests include `eval`, `Function`, property traversal, loops, assignments, imports and oversized expressions.
- [ ] Run focused tests and verify failure.
- [ ] Implement tokenizer/parser/evaluator with node/depth limits and no JS evaluation APIs.
- [ ] Run security-focused tests and verify pass.
- [ ] Commit `feat(creator): add safe motion expression DSL`.

### Task 5: Motion edit reducer and undo/redo
**Files:** Create `apps/web/src/modules/creator/director/motion/motionState.ts` and test.
**Produces:** reducer actions for layer add/delete/duplicate/reorder/select/visibility/lock, transform update, keyframe add/move/delete, expression update, undo and redo.
- [ ] Write reducer tests for every mutation plus undo/redo round trips and immutable state.
- [ ] Run focused tests and verify failure.
- [ ] Implement reducer with bounded history and stable IDs supplied by action creators.
- [ ] Run focused tests and verify pass.
- [ ] Commit `feat(studio): add motion editor state engine`.

### Task 6: Motion Designer workspace shell
**Files:** Create `apps/web/src/modules/creator/director/motion/MotionDesigner.tsx`, `MotionDesigner.css`; modify `DirectorWorkspace.tsx`; add UI tests.
**Produces:** Director-integrated Layers/Canvas/Timeline/Properties workspace.
- [ ] Write failing UI tests proving Motion Designer is reachable from Director, no new top-level route is required, and mobile tabs expose all four editing surfaces.
- [ ] Run focused tests and verify failure.
- [ ] Implement responsive shell using existing Creator visual primitives and ATLAS identity; no decorative fake controls.
- [ ] Run focused UI tests and verify pass.
- [ ] Commit `feat(studio): add Motion Designer workspace`.

### Task 7: Functional layer and property editing
**Files:** Create focused components under `.../motion/components/`: `LayerPanel.tsx`, `PropertiesPanel.tsx`, `CanvasPreview.tsx`; tests beside components.
**Consumes:** Task 5 reducer and Task 3 evaluator.
- [ ] Write failing interaction tests for add/delete/duplicate/reorder, hide/lock, text/shape edits and transform changes.
- [ ] Run tests and verify failure.
- [ ] Implement controls wired to reducer; locked layers reject mutation and hidden layers do not render in preview.
- [ ] Run focused tests and verify pass.
- [ ] Commit `feat(studio): make motion layers editable`.

### Task 8: Timeline, keyframes and playback
**Files:** Create `TimelinePanel.tsx`, `PlaybackControls.tsx`, tests.
- [ ] Write failing tests for scrubbing, play/pause, add/move/delete keyframe, easing selection and clamping to composition duration.
- [ ] Run and verify failure.
- [ ] Implement timeline using requestAnimationFrame only for UI clock; frame values come from deterministic evaluator.
- [ ] Run focused tests and verify pass.
- [ ] Commit `feat(studio): add motion timeline and keyframes`.

### Task 9: Expression editor and safety UI
**Files:** Create `ExpressionEditor.tsx`; integrate PropertiesPanel; tests.
- [ ] Write failing tests showing valid DSL expressions affect preview and prohibited syntax is rejected with a visible error without changing saved state.
- [ ] Run and verify failure.
- [ ] Implement parse-before-apply behavior, complexity messages and explicit expression removal.
- [ ] Run focused tests and verify pass.
- [ ] Commit `feat(studio): add governed motion expressions`.

### Task 10: Persistence and serialization
**Files:** Modify `packages/creator/defaults.ts`, existing Creator repository/API mapping files and tests discovered by existing `saveCreatorProduction` path.
- [ ] Write failing round-trip tests proving motion composition survives save/load and version conflict behavior is unchanged.
- [ ] Run focused tests and verify failure.
- [ ] Extend existing production serialization only; do not introduce a second persistence source.
- [ ] Run focused persistence tests and verify pass.
- [ ] Commit `feat(creator): persist motion compositions`.

### Task 11: Native motion capability gate
**Files:** Modify `packages/creator/native_policy.ts`, `supabase/functions/atlas-creator-native/index.ts`, Director review/gate components and tests.
**Produces:** explicit capability requirement such as `motion-composition-v1` returned by readiness and checked before submission.
- [ ] Write failing tests: legacy native readiness must not enable motion render; verified matching capability may enable it when existing permission/save/validation gates also pass.
- [ ] Run focused tests and verify failure.
- [ ] Add capability negotiation without fabricating support. Existing native composer remains usable for its existing supported path.
- [ ] Run policy and Edge trust-boundary tests and verify pass.
- [ ] Commit `feat(creator): gate native motion rendering by capability`.

### Task 12: AI proposal operation contract
**Files:** Create `packages/creator/motion/operations.ts`, tests; add a small `AIInstructionPanel.tsx` that accepts proposal payloads from the existing orchestrator boundary without adding a paid call.
- [ ] Write failing tests for schema-valid add/update/delete/keyframe operations, invalid target rejection and atomic rollback when any proposed operation is invalid.
- [ ] Run and verify failure.
- [ ] Implement deterministic `applyMotionOperations(spec,operations)`; UI presents proposed changes and applies them to draft state only.
- [ ] Run focused tests and verify pass.
- [ ] Commit `feat(creator): add governed AI motion operations`.

### Task 13: Audit/provenance and asset ownership boundaries
**Files:** Modify Creator Edge/repository paths used by motion save/render; tests.
- [ ] Write failing tests for cross-organization asset rejection, creator.write/save, creator.generate/render, and audit metadata containing production/composition version.
- [ ] Run and verify failure.
- [ ] Implement ownership validation and audit fields using existing Creator context helpers.
- [ ] Run trust-boundary tests and verify pass.
- [ ] Commit `fix(creator): enforce motion tenant and audit boundaries`.

### Task 14: Accessibility and responsive verification
**Files:** Motion Designer components/CSS and UI tests.
- [ ] Write failing keyboard/focus tests for panels, layer controls, timeline controls and mobile tabs; verify labels and no hover-only actions.
- [ ] Run and verify failure.
- [ ] Implement focus-visible states, semantic labels, keyboard activation and reduced-motion handling using existing ATLAS patterns.
- [ ] Run focused tests and verify pass.
- [ ] Commit `fix(studio): harden Motion Designer accessibility`.

### Task 15: Full regression and production-readiness evidence
**Files:** Update Creator architecture docs only if implementation changed an interface; no feature expansion.
- [ ] Run `npm ci`.
- [ ] Run `npm run typecheck`.
- [ ] Run focused Creator/Motion tests.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Inspect generated build/test output for secrets and ensure no test contacted a paid provider.
- [ ] Verify `/studio`, `/studio/create?type=video`, Director and Motion Designer navigation with existing identity/RBAC behavior.
- [ ] Commit only evidence/doc corrections required by the verified implementation; do not claim production readiness unless every gate above passes.
