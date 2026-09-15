# ATLAS Motion Designer — Design Specification

Date: 2026-09-15
Status: Approved
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/atlas-motion-designer`
Owner: ATLAS Studio / Creator
Entry: `/studio/create?type=video` → ATLAS Director → Motion Designer

## Purpose
Extend the existing ATLAS Director with a native, editable motion-composition system. A natural-language creative instruction becomes a deterministic composition graph that can be inspected, edited, validated, previewed, rendered by an authorized runtime, and optionally exported through adapters. This is not a Higgsfield clone and After Effects is not a runtime dependency.

## Architecture
ATLAS remains the canonical owner. The existing `ProductionSpec` remains the production source of truth and receives a versioned `motionComposition`. The motion model is provider-neutral and separates creative intent from rendering implementation.

Flow:
`Intent/reference → ATLAS Assistant → MotionCompositionSpec → deterministic validation → editable canvas/timeline → preview → authorized render → multimodal review → revision → asset/provenance`.

The existing orchestration responsibilities remain: ChatGPT creative direction, Gemini multimodal review, Codex Sovereign technical verification, deterministic reconciliation by the ATLAS Studio orchestrator. Agents may propose mutations but cannot independently authorize render or cost.

## Domain model
Introduce `MotionCompositionSpec` with `version`, `width`, `height`, `fps`, `durationSeconds`, `background`, `scenes`, `layers`, `markers`, and `renderSettings`.

A `MotionLayer` has `id`, `name`, `kind`, `sceneId`, `parentLayerId`, `startSecond`, `endSecond`, `visible`, `locked`, `transform`, `tracks`, `effects`, and optional `expression`.

Layer kinds for milestone 1: `text`, `shape`, `image`, `video`, `audio`, `particle`, `camera`, `light`, `group`.

A `MotionTrack<T>` targets one animatable property and contains ordered `MotionKeyframe<T>` values. A keyframe has `time`, `value`, and easing. Milestone-1 easing: linear, ease-in, ease-out, ease-in-out, and cubic-bezier.

Transform supports position X/Y/Z, scale X/Y/Z, rotation X/Y/Z, opacity and anchor X/Y/Z. Effects are declarative descriptors; unsupported effects are validation warnings or blockers rather than silently ignored.

Expressions use a constrained ATLAS expression DSL, never arbitrary browser/server JavaScript. Initial operations are arithmetic, time, sin/cos, clamp, lerp and references to explicitly exposed layer properties.

## Editing contract
Motion Designer is part of Director, not a parallel app. Desktop uses assets/layers on the left, preview canvas in the center, properties/AI instructions on the right, and timeline/keyframes below. Tablet collapses the inspector. Mobile uses a single-column editor with explicit Layers, Canvas, Timeline and Properties tabs. No required action depends on hover.

Required milestone-1 operations: add/delete/duplicate/reorder layers; select/lock/hide layers; edit transforms; add/move/delete keyframes; select easing; scrub timeline; play/pause deterministic preview; edit text/shape properties; attach constrained expressions; undo/redo; validate; save; reload without losing composition state.

## Natural-language planning
A planner contract converts a user instruction into proposed deterministic composition operations. AI output is never applied as opaque executable code. Proposed operations are validated against the composition schema and permissions, shown as a change set, and then applied to local draft state. Sensitive/cost-bearing actions retain existing authorization gates.

## Renderer boundary
Milestone 1 implements the composition model, deterministic evaluator, browser preview and renderer contract. The current ATLAS Native Composer remains truthful: it is not labeled motion-capable until its readiness response explicitly advertises the required motion capability/version. Production render is disabled when that capability is absent.

The renderer request receives a frozen composition version plus asset references and returns a job/asset result. No provider credentials enter browser state. Existing organization isolation, Creator permissions, audit and provenance rules apply.

## Optional adapters
Professional application/provider adapters are secondary: After Effects, DaVinci Resolve, Blender and compatible external generation providers may be added behind capability descriptors. Export adapters translate from the canonical MotionCompositionSpec; external formats never become the ATLAS source of truth.

## Data and persistence
Persist motion composition inside the existing Creator production contract for the first milestone to avoid a second source of truth. Version conflicts use the existing optimistic concurrency behavior. Generated assets continue through Creator Library and provenance records.

## Security
Maintain authenticated organization context, `creator.read`, `creator.write`, and `creator.generate` gates. Expressions are parsed/evaluated by an allowlisted DSL with complexity limits. Asset references must belong to the active organization. Render and provider calls remain server-side. No secrets, arbitrary shell, arbitrary JavaScript, remote URL fetching, or fabricated readiness.

## Validation
Blocking: invalid duration/fps/dimensions; duplicate IDs; layer outside composition; invalid parent/cycle; malformed track; keyframe outside layer; unsupported property/value; invalid expression; missing required asset; renderer capability mismatch at submission.

Warnings: empty layer, hidden animated layer, overlapping redundant keyframes, unsupported preview-only effect, orphan scene, asset metadata unavailable.

## Testing
Unit tests cover schema/defaults, graph integrity, keyframe interpolation/easing, expression parser/evaluator, deterministic frame evaluation, operation reducer, validation, capability gating and serialization round trips. UI tests cover layer selection/editing, timeline keyframes, undo/redo, responsive navigation, save conflict and disabled render. Existing Creator/Director tests must remain green.

## Acceptance criteria
1. Existing Studio/Director routes and behavior remain compatible.
2. A production can create, edit, save and reload a MotionCompositionSpec.
3. Preview evaluation is deterministic for a composition version and time.
4. Timeline/keyframe operations work without placeholders.
5. Arbitrary JavaScript cannot execute through expressions.
6. Render cannot claim readiness without verified motion capability.
7. Tenant/RBAC/audit/provenance boundaries remain intact.
8. Desktop/tablet/mobile have usable editing paths.
9. `npm run typecheck`, focused tests, full tests and `npm run build` pass before integration.
10. No external credits are spent by planning, editing, preview validation or tests.
