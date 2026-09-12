# ATLAS Spatial Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ATLAS Spatial Interface as a real, governed, multimodal workspace that supports live hand gestures, pointer/touch/keyboard fallback, interactive 3D manipulation, safe command routing, server-authoritative authorization, auditability, and progressive degradation without replacing current ATLAS identity, routing, module ownership, or production controls.

**Architecture:** Add one `packages/spatial` workspace for renderer-independent domain logic, one `apps/web/src/modules/spatial` UI boundary, and one Supabase Edge Function for server-authoritative Spatial capability/authorization/audit decisions. Vision, gesture recognition, scene manipulation, command routing, and integrations communicate through explicit contracts; Tier 3/4 actions fail closed unless an owner module supplies a real adapter and authorization path.

**Tech Stack:** React 18.3.1, TypeScript 5.7.x, Vite 6.4.x, React Router 7.18.3, Vitest 3.2.x, Supabase Edge Functions, shared `audit_logs`, MediaPipe Tasks Vision for browser hand landmarks, Three.js + React Three Fiber for the first 3D renderer, Playwright for browser/E2E verification.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-spatial-interface-design.md`

## Global Constraints

- Canonical repository is `atlasenterprisesuite/atlasenterprisesuite`; `main` remains canonical.
- Work on `feat/atlas-spatial-interface`; do not merge or deploy without separate explicit approval.
- Reconcile the feature branch with current `main` before implementation; do not force-reset or force-push away newer approved work.
- Reuse current ATLAS Identity, organization membership, shell, Supabase, `audit_logs`, test, and CI patterns before creating equivalents.
- Camera access requires explicit user action and browser permission. Full frames and instantaneous landmarks are ephemeral by default and must not be persisted.
- Spatial input is additive. Keyboard, pointer, touch, and accessible DOM controls remain valid alternatives.
- A single frame never executes a command. Gesture intent requires temporal stability, context, target validation, and policy.
- Tier 3 actions require deliberate confirmation plus owner-module authorization. Tier 4 actions can never be authorized by gesture alone.
- Client-side state may improve UX but cannot grant authority.
- No fake provider, microphone, camera, WebGL, Voice, Connect, Health, Automations, or backend readiness state.
- No new standalone database for Spatial. Reuse canonical Supabase and shared `audit_logs`; device-local preferences may use clearly labeled local storage where server persistence does not yet exist.
- No downloaded humanoid asset is required for v1. Use procedural geometry so the 3D interaction path is real without introducing a large binary asset dependency.
- Every meaningful gesture action must have a keyboard/pointer/touch equivalent.
- Run test-first cycles for each task. Each task ends with tests, a focused commit, spec review, then code-quality review before the next task.

---

## File Map

### New spatial domain workspace
- `packages/spatial/package.json` — workspace metadata only.
- `packages/spatial/src/index.ts` — public exports.
- `packages/spatial/src/types.ts` — shared Spatial domain types.
- `packages/spatial/src/policy.ts` — risk/confirmation and local fail-closed policy.
- `packages/spatial/src/gesture-state.ts` — candidate/armed/confirmed/executed/cancelled state machine.
- `packages/spatial/src/vision/types.ts` — normalized hand-frame/provider interfaces.
- `packages/spatial/src/vision/fake.ts` — deterministic test provider.
- `packages/spatial/src/gestures/recognizer.ts` — landmark-to-gesture heuristics and temporal stabilization.
- `packages/spatial/src/scene/reducer.ts` — renderer-independent object transforms and selection/isolation state.
- `packages/spatial/src/commands/router.ts` — route/scene/governed command routing.
- `packages/spatial/src/commands/multimodal.ts` — gesture + optional voice intent resolution.
- `packages/spatial/src/integrations/registry.ts` — truthful readiness contract for Voice, Automations, Connect, Health, future owners.

### Web application
- `apps/web/src/modules/spatial/SpatialRoutes.tsx` — `/spatial/*` route ownership.
- `apps/web/src/modules/spatial/SpatialOverviewPage.tsx` — capability/readiness entry.
- `apps/web/src/modules/spatial/SpatialWorkspacePage.tsx` — live workspace composition.
- `apps/web/src/modules/spatial/SpatialSupportPages.tsx` — calibration, gestures, commands, digital twin, automations, integrations, sessions, permissions, settings pages.
- `apps/web/src/modules/spatial/components/SpatialNav.tsx` — route navigation.
- `apps/web/src/modules/spatial/components/CommandStrip.tsx` — mode, gesture, confidence, camera/mic, confirmation and pause state.
- `apps/web/src/modules/spatial/components/ObjectTree.tsx` — accessible target hierarchy.
- `apps/web/src/modules/spatial/components/ContextPanel.tsx` — target metadata and available actions.
- `apps/web/src/modules/spatial/components/CameraPanel.tsx` — explicit camera start/stop/calibration/privacy controls.
- `apps/web/src/modules/spatial/scene/SpatialCanvas.tsx` — React Three Fiber bridge.
- `apps/web/src/modules/spatial/scene/ProceduralHumanoid.tsx` — real selectable procedural 3D hierarchy.
- `apps/web/src/modules/spatial/hooks/useSpatialVision.ts` — browser MediaPipe provider lifecycle.
- `apps/web/src/modules/spatial/hooks/useSpatialController.ts` — composition of vision, gestures, scene, command, focus-loss and privacy behavior.
- `apps/web/src/modules/spatial/lib/spatialApi.ts` — authenticated calls to the Spatial Edge Function.
- `apps/web/src/modules/spatial/spatial.css` — responsive, reduced-motion, focus, 2D fallback styles.

### Existing files to modify
- `apps/web/src/App.tsx` — register identity-gated `/spatial/*` route family only.
- `apps/web/src/components/AtlasShell.tsx` — add one `Spatial` navigation item.
- `apps/web/src/lib/atlasSession.ts` — expose a narrow authenticated function-request helper without duplicating token refresh logic.
- `apps/web/package.json` and `package-lock.json` — MediaPipe/Three/R3F runtime dependencies.
- `package.json` — Playwright script/dev dependency in the final hardening task only.

### Supabase server boundary
- `supabase/functions/atlas-spatial-command/_shared/context.ts` — authenticated user + active organization + server-side role-derived Spatial permissions.
- `supabase/functions/atlas-spatial-command/_shared/policy.ts` — authoritative Spatial risk decision; Tier 3/4 require owner module authorization.
- `supabase/functions/atlas-spatial-command/_shared/repository.ts` — `audit_logs` writes/reads only.
- `supabase/functions/atlas-spatial-command/_shared/errors.ts` — safe JSON/CORS/error normalization.
- `supabase/functions/atlas-spatial-command/index.ts` — `capabilities`, `authorize`, and `audit` operations.

### Tests and QA
- `tests/unit/spatial-types.test.ts`
- `tests/unit/spatial-policy.test.ts`
- `tests/unit/spatial-gesture-state.test.ts`
- `tests/unit/spatial-recognizer.test.ts`
- `tests/unit/spatial-scene.test.ts`
- `tests/unit/spatial-multimodal.test.ts`
- `tests/integration/spatial-edge-contract.test.ts`
- `tests/integration/spatial-security-contract.test.ts`
- `tests/integration/spatial-routes.test.tsx`
- `tests/integration/spatial-workspace.test.tsx`
- `e2e/spatial.spec.ts`
- `playwright.config.ts`
- `.github/workflows/atlas-spatial-interface-ci.yml`
- `docs/qa/ATLAS_SPATIAL_INTERFACE_READINESS.md`

---

### Task 1: Establish the Spatial domain contract and branch baseline

**Files:**
- Create: `packages/spatial/package.json`
- Create: `packages/spatial/src/types.ts`
- Create: `packages/spatial/src/index.ts`
- Test: `tests/unit/spatial-types.test.ts`

**Interfaces:**
- Produces `SpatialMode`, `SpatialRiskTier`, `SpatialInputModality`, `SpatialTarget`, `SpatialCommand`, `SpatialCommandStatus`, `SpatialSession`, `GestureName`, `GestureState`, `GestureEvent`, `CommandDecision`, and `IntegrationReadiness`.
- Later tasks must import these names from `packages/spatial/src` instead of redefining them.

- [ ] **Step 1: Reconcile the execution worktree with current `main` before writing code**

Run in the isolated worktree created by `superpowers:using-git-worktrees`:

```bash
git fetch origin
git status --short --branch
git merge --no-ff origin/main
```

Expected: no force reset; newer `main` work is preserved. If conflicts exist, resolve by keeping current-main functionality and the approved Spatial spec, then run `git status` until clean.

- [ ] **Step 2: Write the failing domain contract test**

```ts
// tests/unit/spatial-types.test.ts
import { describe, expect, it } from 'vitest';
import type {
  CommandDecision,
  GestureEvent,
  SpatialCommand,
  SpatialMode,
  SpatialRiskTier
} from '../../packages/spatial/src';

function acceptsMode(value: SpatialMode) { return value; }
function acceptsRisk(value: SpatialRiskTier) { return value; }

describe('ATLAS Spatial domain contracts', () => {
  it('defines stable mode and risk vocabularies', () => {
    expect(acceptsMode('navigate')).toBe('navigate');
    expect(acceptsMode('manipulate')).toBe('manipulate');
    expect(acceptsMode('command')).toBe('command');
    expect(acceptsRisk(0)).toBe(0);
    expect(acceptsRisk(4)).toBe(4);
  });

  it('carries target, policy and gesture evidence through a command', () => {
    const gesture: GestureEvent = {
      eventId: 'g-1', sessionId: 's-1', gesture: 'pinch', confidence: 0.94,
      startedAt: 100, endedAt: 360, handedness: 'right', targetId: 'finance',
      mode: 'navigate', state: 'confirmed', velocity: 0.05
    };
    const command: SpatialCommand = {
      commandId: 'c-1', sessionId: 's-1', source: 'gesture', sourceGesture: gesture,
      target: { id: 'finance', type: 'route', label: 'Finance', route: '/finance' },
      action: 'open', requiredPermission: 'spatial.use', riskTier: 1,
      confirmationPolicy: 'none', status: 'requested'
    };
    const decision: CommandDecision = { allowed: true, reason: 'local_navigation', riskTier: 1 };
    expect(command.target.route).toBe('/finance');
    expect(decision.allowed).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test and verify the import fails**

Run:

```bash
npm run test:unit -- tests/unit/spatial-types.test.ts
```

Expected: FAIL because `packages/spatial/src` does not yet exist.

- [ ] **Step 4: Add the minimal workspace and exact shared types**

```json
// packages/spatial/package.json
{
  "name": "@atlas/spatial",
  "private": true,
  "version": "0.1.0",
  "type": "module"
}
```

```ts
// packages/spatial/src/types.ts
export type SpatialMode = 'navigate' | 'manipulate' | 'command';
export type SpatialRiskTier = 0 | 1 | 2 | 3 | 4;
export type SpatialInputModality = 'gesture' | 'voice' | 'gesture+voice' | 'pointer' | 'touch' | 'keyboard';
export type GestureName = 'point' | 'pinch' | 'swipe-left' | 'swipe-right' | 'open-palm' | 'grab' | 'two-hand-spread' | 'two-hand-pinch' | 'hold-pinch' | 'confirm';
export type GestureState = 'candidate' | 'armed' | 'confirmed' | 'executed' | 'cancelled';
export type SpatialCommandStatus = 'requested' | 'awaiting_confirmation' | 'authorized' | 'denied' | 'executing' | 'succeeded' | 'failed' | 'cancelled';
export type SpatialConfirmationPolicy = 'none' | 'brief' | 'deliberate' | 'owner-module';

export type SpatialTarget = {
  id: string;
  type: 'route' | 'scene-object' | 'record' | 'automation' | 'device' | 'health-layer';
  label: string;
  route?: string;
  ownerModule?: string;
};

export type GestureEvent = {
  eventId: string;
  sessionId: string;
  gesture: GestureName;
  confidence: number;
  startedAt: number;
  endedAt: number;
  handedness: 'left' | 'right' | 'both' | 'unknown';
  targetId: string | null;
  mode: SpatialMode;
  state: GestureState;
  velocity: number;
};

export type SpatialCommand = {
  commandId: string;
  sessionId: string;
  source: SpatialInputModality;
  sourceGesture?: GestureEvent;
  voiceIntentId?: string;
  target: SpatialTarget;
  action: string;
  requiredPermission: string;
  riskTier: SpatialRiskTier;
  confirmationPolicy: SpatialConfirmationPolicy;
  status: SpatialCommandStatus;
};

export type CommandDecision = {
  allowed: boolean;
  reason: string;
  riskTier: SpatialRiskTier;
  requiresOwnerAuthorization?: boolean;
  auditReference?: string | null;
};

export type SpatialSession = {
  sessionId: string;
  organizationId: string;
  userId: string | null;
  deviceId: string;
  startedAt: string;
  endedAt: string | null;
  cameraPermission: 'unknown' | 'prompt' | 'granted' | 'denied' | 'unavailable';
  voiceEnabled: boolean;
  activeScene: string;
  status: 'active' | 'paused' | 'ended';
};

export type IntegrationReadiness = {
  integration: 'voice' | 'automations' | 'connect' | 'health';
  state: 'ready' | 'not_configured' | 'unavailable' | 'error';
  blocker: string | null;
  checkedAt: string;
};
```

```ts
// packages/spatial/src/index.ts
export * from './types';
```

- [ ] **Step 5: Run the focused test, then typecheck**

```bash
npm run test:unit -- tests/unit/spatial-types.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the domain foundation**

```bash
git add packages/spatial tests/unit/spatial-types.test.ts
git commit -m "feat: define ATLAS Spatial domain contracts"
```

---

### Task 2: Implement risk policy and the gesture confirmation state machine

**Files:**
- Create: `packages/spatial/src/policy.ts`
- Create: `packages/spatial/src/gesture-state.ts`
- Modify: `packages/spatial/src/index.ts`
- Test: `tests/unit/spatial-policy.test.ts`
- Test: `tests/unit/spatial-gesture-state.test.ts`

**Interfaces:**
- Produces `classifySpatialRisk(action, target)`, `confirmationForRisk(riskTier)`, `evaluateLocalSpatialPolicy(command)`, `GestureMachineState`, `advanceGestureState(state, input)`, and `cancelGestureState(state, reason)`.
- Tier 3/4 decisions returned by local policy must never authorize execution.

- [ ] **Step 1: Write failing policy tests**

```ts
import { describe, expect, it } from 'vitest';
import { classifySpatialRisk, confirmationForRisk, evaluateLocalSpatialPolicy } from '../../packages/spatial/src';
import type { SpatialCommand } from '../../packages/spatial/src';

const base: SpatialCommand = {
  commandId: 'c', sessionId: 's', source: 'keyboard',
  target: { id: 'x', type: 'route', label: 'X', route: '/health' },
  action: 'open', requiredPermission: 'spatial.use', riskTier: 1,
  confirmationPolicy: 'none', status: 'requested'
};

describe('Spatial policy', () => {
  it('classifies visual/navigation as low risk', () => {
    expect(classifySpatialRisk('rotate', { id:'h', type:'scene-object', label:'Human' })).toBe(0);
    expect(classifySpatialRisk('open', { id:'h', type:'route', label:'Health', route:'/health' })).toBe(1);
  });
  it('classifies destructive/security/payment actions as Tier 4', () => {
    for (const action of ['payment.execute', 'delete.permanent', 'security.change', 'payroll.approve']) {
      expect(classifySpatialRisk(action, { id:'r', type:'record', label:'Record', ownerModule:'finance' })).toBe(4);
    }
  });
  it('fails closed locally for sensitive and critical actions', () => {
    const command = { ...base, action:'payment.execute', riskTier:4 as const, confirmationPolicy:'owner-module' as const };
    expect(evaluateLocalSpatialPolicy(command)).toMatchObject({ allowed:false, requiresOwnerAuthorization:true });
    expect(confirmationForRisk(4)).toBe('owner-module');
  });
});
```

- [ ] **Step 2: Write failing gesture state tests**

```ts
import { describe, expect, it } from 'vitest';
import { advanceGestureState, cancelGestureState, initialGestureMachineState } from '../../packages/spatial/src';

describe('gesture confirmation machine', () => {
  it('requires candidate -> armed -> confirmed before execution', () => {
    let state = initialGestureMachineState();
    state = advanceGestureState(state, { type:'candidate', gesture:'hold-pinch', at:100, confidence:0.95, targetId:'x' });
    state = advanceGestureState(state, { type:'stable', at:750, confidence:0.96, targetId:'x' });
    expect(state.phase).toBe('armed');
    state = advanceGestureState(state, { type:'confirm', at:900, confidence:0.97, targetId:'x' });
    expect(state.phase).toBe('confirmed');
  });
  it('cancels when tracking, target, focus or confidence is lost', () => {
    const armed = { ...initialGestureMachineState(), phase:'armed' as const, targetId:'x', gesture:'hold-pinch' as const };
    expect(cancelGestureState(armed, 'browser_blur').phase).toBe('cancelled');
  });
});
```

- [ ] **Step 3: Run focused tests and confirm failure**

```bash
npm run test:unit -- tests/unit/spatial-policy.test.ts tests/unit/spatial-gesture-state.test.ts
```

Expected: FAIL because policy/state exports do not exist.

- [ ] **Step 4: Implement the exact fail-closed rules**

```ts
// packages/spatial/src/policy.ts
import type { SpatialCommand, SpatialConfirmationPolicy, SpatialRiskTier, SpatialTarget } from './types';

const tier4 = new Set(['payment.execute','delete.permanent','security.change','payroll.approve','publish.external']);
const tier3Prefixes = ['finance.write','payroll.write','hr.write','health.write','permission.','communication.send'];

export function classifySpatialRisk(action: string, target: SpatialTarget): SpatialRiskTier {
  if (tier4.has(action)) return 4;
  if (tier3Prefixes.some((prefix) => action.startsWith(prefix))) return 3;
  if (target.type === 'automation' || action.startsWith('preference.') || action.startsWith('draft.')) return 2;
  if (target.type === 'route' || action === 'open' || action === 'back' || action === 'scroll') return 1;
  return 0;
}

export function confirmationForRisk(risk: SpatialRiskTier): SpatialConfirmationPolicy {
  if (risk <= 1) return 'none';
  if (risk === 2) return 'brief';
  if (risk === 3) return 'deliberate';
  return 'owner-module';
}

export function evaluateLocalSpatialPolicy(command: SpatialCommand) {
  if (command.riskTier >= 3) {
    return { allowed:false, reason:'owner_authorization_required', riskTier:command.riskTier, requiresOwnerAuthorization:true } as const;
  }
  return { allowed:true, reason:command.riskTier <= 1 ? 'local_low_risk' : 'server_confirmation_required', riskTier:command.riskTier } as const;
}
```

Implement `gesture-state.ts` with `stable` arming only after 600 ms for `hold-pinch`, cancellation on confidence `< 0.75`, changed target, lost tracking, privacy mode, or browser blur, and no transition from `confirmed` directly back to `armed`.

- [ ] **Step 5: Export the new APIs and rerun tests**

```ts
// packages/spatial/src/index.ts
export * from './types';
export * from './policy';
export * from './gesture-state';
```

```bash
npm run test:unit -- tests/unit/spatial-policy.test.ts tests/unit/spatial-gesture-state.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/spatial/src tests/unit/spatial-policy.test.ts tests/unit/spatial-gesture-state.test.ts
git commit -m "feat: add spatial policy and gesture safety state machine"
```

---

### Task 3: Add the interchangeable vision provider and privacy-safe camera lifecycle

**Files:**
- Modify: `apps/web/package.json`
- Modify: `package-lock.json`
- Create: `packages/spatial/src/vision/types.ts`
- Create: `packages/spatial/src/vision/fake.ts`
- Modify: `packages/spatial/src/index.ts`
- Create: `apps/web/src/modules/spatial/hooks/useSpatialVision.ts`
- Test: `tests/unit/spatial-vision.test.ts`

**Interfaces:**
- `VisionProvider.start(video, onFrame): Promise<void>` and `VisionProvider.stop(): Promise<void> | void`.
- `HandFrame` contains normalized 21-landmark hands, handedness, timestamp, and source confidence; it never contains raw image bytes.
- `FakeVisionProvider.push(frame)` drives deterministic tests.

- [ ] **Step 1: Write failing provider lifecycle tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { FakeVisionProvider, type HandFrame } from '../../packages/spatial/src';

describe('VisionProvider contract', () => {
  it('emits normalized hand frames without image payloads', async () => {
    const provider = new FakeVisionProvider();
    const seen: HandFrame[] = [];
    await provider.start({} as HTMLVideoElement, (frame) => seen.push(frame));
    provider.push({ timestamp:1, hands:[] });
    expect(seen).toEqual([{ timestamp:1, hands:[] }]);
    expect('image' in seen[0]).toBe(false);
  });
  it('stops delivery after stop', async () => {
    const provider = new FakeVisionProvider();
    const listener = vi.fn();
    await provider.start({} as HTMLVideoElement, listener);
    await provider.stop();
    provider.push({ timestamp:2, hands:[] });
    expect(listener).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify failure**

```bash
npm run test:unit -- tests/unit/spatial-vision.test.ts
```

- [ ] **Step 3: Add MediaPipe Tasks Vision to the web workspace**

```bash
npm install --workspace apps/web @mediapipe/tasks-vision
```

Expected: `apps/web/package.json` and `package-lock.json` change; no camera access is attempted during install or test.

- [ ] **Step 4: Implement normalized provider contracts and the fake provider**

```ts
// packages/spatial/src/vision/types.ts
export type HandLandmark = { x:number; y:number; z:number };
export type NormalizedHand = {
  landmarks: HandLandmark[];
  handedness: 'left' | 'right' | 'unknown';
  confidence: number;
};
export type HandFrame = { timestamp:number; hands:NormalizedHand[] };
export interface VisionProvider {
  start(video: HTMLVideoElement, onFrame: (frame: HandFrame) => void): Promise<void>;
  stop(): Promise<void> | void;
}
```

`FakeVisionProvider` stores the callback only while running and rejects frames with hand landmark arrays other than 21 points in a helper `validateHandFrame(frame)`.

- [ ] **Step 5: Implement `useSpatialVision` so camera consent is explicit and stop is complete**

The hook exposes:

```ts
export type SpatialVisionController = {
  status: 'idle' | 'requesting' | 'running' | 'denied' | 'unavailable' | 'error';
  startCamera(): Promise<void>;
  stopCamera(): Promise<void>;
  privacyLock(): Promise<void>;
  videoRef: React.RefObject<HTMLVideoElement>;
  lastFrame: HandFrame | null;
  error: string | null;
};
```

`startCamera()` calls `navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' }, audio:false })` only after the user invokes it. `stopCamera()` calls `track.stop()` on every stream track, clears `srcObject`, stops the provider, and clears `lastFrame`. `privacyLock()` calls `stopCamera()` and clears all transient state.

- [ ] **Step 6: Run tests and typecheck**

```bash
npm run test:unit -- tests/unit/spatial-vision.test.ts
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json package-lock.json packages/spatial/src apps/web/src/modules/spatial/hooks tests/unit/spatial-vision.test.ts
git commit -m "feat: add privacy-safe spatial vision provider contract"
```

---

### Task 4: Implement MediaPipe hand landmarks and deterministic gesture recognition

**Files:**
- Create: `apps/web/src/modules/spatial/vision/MediaPipeVisionProvider.ts`
- Create: `packages/spatial/src/gestures/recognizer.ts`
- Modify: `packages/spatial/src/index.ts`
- Test: `tests/unit/spatial-recognizer.test.ts`

**Interfaces:**
- Produces `MediaPipeVisionProvider` implementing `VisionProvider`.
- Produces `recognizeGesture(frame, previous, mode)` and `StableGestureRecognizer.push(frame, targetId, mode)`.
- Default temporal policy: minimum confidence `0.80`; stable window `180 ms`; hold-pinch arming `600 ms`; duplicate cooldown `350 ms`.

- [ ] **Step 1: Write landmark fixture tests for pinch, point, open palm and duplicate suppression**

Create deterministic 21-point fixtures in the test; use thumb tip index `4`, index tip `8`, middle tip `12`, ring tip `16`, pinky tip `20`, wrist `0`.

```ts
it('recognizes pinch when thumb and index tips converge', () => {
  const frame = handFrame({ thumbTip:[0.50,0.50,0], indexTip:[0.52,0.50,0] });
  expect(recognizeGesture(frame, null, 'navigate')?.gesture).toBe('pinch');
});

it('does not emit a command from one unstable frame', () => {
  const r = new StableGestureRecognizer({ stableMs:180, holdMs:600, cooldownMs:350, minConfidence:0.80 });
  expect(r.push(pinchFrame(100), 'finance', 'navigate')).toBeNull();
  expect(r.push(pinchFrame(150), 'finance', 'navigate')).toBeNull();
});
```

- [ ] **Step 2: Verify the tests fail**

```bash
npm run test:unit -- tests/unit/spatial-recognizer.test.ts
```

- [ ] **Step 3: Implement concrete recognition heuristics**

Use normalized Euclidean distance. Pinch requires `distance(thumbTip,indexTip) <= 0.055`. Point requires index tip farther from wrist than index PIP while middle/ring/pinky tips remain closer to wrist than their PIP joints. Open palm requires all four fingertips farther from the wrist than their PIP joints and thumb tip farther from index MCP than a configured threshold. Swipe requires lateral index/wrist displacement over successive frames plus bounded vertical displacement. Two-hand spread/pinch uses distance between hand centers across frames. Clamp all confidence values to `[0,1]`.

`StableGestureRecognizer` emits only after the same gesture + same target remains stable for the configured window. A low-confidence frame resets the candidate. The same gesture/target cannot emit again until cooldown expires.

- [ ] **Step 4: Implement the browser MediaPipe provider behind the contract**

Use lazy import so the package is not initialized during SSR/tests:

```ts
const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
const vision = await FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
);
const landmarker = await HandLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    delegate: 'GPU'
  },
  runningMode: 'VIDEO',
  numHands: 2,
  minHandDetectionConfidence: 0.7,
  minHandPresenceConfidence: 0.7,
  minTrackingConfidence: 0.7
});
```

If GPU initialization fails, retry once without the GPU delegate. If model/WASM initialization fails, surface `vision_model_unavailable`; do not label gesture tracking active.

- [ ] **Step 5: Rerun focused tests and typecheck**

```bash
npm run test:unit -- tests/unit/spatial-recognizer.test.ts tests/unit/spatial-vision.test.ts
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/modules/spatial/vision packages/spatial/src tests/unit/spatial-recognizer.test.ts
git commit -m "feat: recognize stable hand gestures with MediaPipe"
```

---

### Task 5: Add the renderer-independent scene model and real procedural 3D manipulation

**Files:**
- Modify: `apps/web/package.json`
- Modify: `package-lock.json`
- Create: `packages/spatial/src/scene/reducer.ts`
- Modify: `packages/spatial/src/index.ts`
- Create: `apps/web/src/modules/spatial/scene/SpatialCanvas.tsx`
- Create: `apps/web/src/modules/spatial/scene/ProceduralHumanoid.tsx`
- Test: `tests/unit/spatial-scene.test.ts`

**Interfaces:**
- Produces `SpatialSceneState`, `SpatialObjectState`, `sceneReducer(state, action)`.
- Supported actions: `select`, `rotate`, `translate`, `zoom`, `isolate`, `reset`, `setCompatibilityMode`.
- `SpatialCanvas` accepts `state`, `dispatch`, `activeTargetId`, `onTargetFocus`.

- [ ] **Step 1: Write failing scene reducer tests**

```ts
it('rotates and zooms within safe bounds', () => {
  let state = createInitialSceneState();
  state = sceneReducer(state, { type:'rotate', objectId:'human', delta:{ x:9, y:-9 } });
  state = sceneReducer(state, { type:'zoom', delta:99 });
  expect(state.objects.human.rotation.x).toBeLessThanOrEqual(Math.PI);
  expect(state.camera.zoom).toBeLessThanOrEqual(2.5);
});

it('isolates one object without deleting the others', () => {
  const state = sceneReducer(createInitialSceneState(), { type:'isolate', objectId:'torso' });
  expect(state.isolatedObjectId).toBe('torso');
  expect(Object.keys(state.objects).length).toBeGreaterThan(1);
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
npm run test:unit -- tests/unit/spatial-scene.test.ts
```

- [ ] **Step 3: Install Three.js and React Three Fiber**

```bash
npm install --workspace apps/web three @react-three/fiber
```

- [ ] **Step 4: Implement scene state and procedural human hierarchy**

`createInitialSceneState()` includes `human`, `head`, `torso`, `left-arm`, `right-arm`, `left-leg`, `right-leg`. Manipulation clamps rotation to `[-π, π]`, zoom to `[0.6, 2.5]`, and translation to a bounded workspace cube.

`ProceduralHumanoid` uses spheres/capsules/cylinders only; each mesh group carries a stable `userData.spatialTargetId` and invokes `onTargetFocus(id)` on pointer focus/select. Do not attach Health data.

- [ ] **Step 5: Add WebGL compatibility fallback**

`SpatialCanvas` renders an accessible DOM fallback summary when WebGL context creation fails or reduced-motion/compatibility policy asks for 2D mode. Meaningful controls remain outside `canvas` and keyboard reachable.

- [ ] **Step 6: Run tests, typecheck and build**

```bash
npm run test:unit -- tests/unit/spatial-scene.test.ts
npm run typecheck
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json package-lock.json packages/spatial/src/scene apps/web/src/modules/spatial/scene tests/unit/spatial-scene.test.ts
git commit -m "feat: add interactive ATLAS spatial scene"
```

---

### Task 6: Add command routing and multimodal resolution with truthful integration readiness

**Files:**
- Create: `packages/spatial/src/commands/router.ts`
- Create: `packages/spatial/src/commands/multimodal.ts`
- Create: `packages/spatial/src/integrations/registry.ts`
- Modify: `packages/spatial/src/index.ts`
- Test: `tests/unit/spatial-multimodal.test.ts`
- Test: `tests/unit/spatial-router.test.ts`

**Interfaces:**
- `resolveMultimodalIntent({ gesture, voice, activeTarget }): ResolvedIntent`.
- `routeSpatialCommand(intent, context): SpatialCommand`.
- `SpatialOwnerAdapter` has `ownerModule`, `readiness()`, and `supports(action)`; default registry entries return `not_configured` unless a real current ATLAS contract is detected and wired.

- [ ] **Step 1: Write contradiction and routing tests**

```ts
it('refuses contradictory voice and gesture intent', () => {
  const result = resolveMultimodalIntent({
    gesture: confirmedPoint('invoice-1'),
    voice: { id:'v1', action:'open', targetId:'employee-9' },
    activeTarget: { id:'invoice-1', type:'record', label:'Invoice', ownerModule:'finance' }
  });
  expect(result.status).toBe('ambiguous');
});

it('routes scene rotation to Tier 0 and finance mutation to Tier 3+', () => {
  expect(routeSpatialCommand(sceneIntent('rotate'), baseContext()).riskTier).toBe(0);
  expect(routeSpatialCommand(recordIntent('finance.write.memo'), baseContext()).riskTier).toBe(3);
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test:unit -- tests/unit/spatial-multimodal.test.ts tests/unit/spatial-router.test.ts
```

- [ ] **Step 3: Implement resolution rules**

Rules:
- gesture supplies target when voice omits one;
- voice supplies action when gesture only points;
- if both supply targets and targets differ, return `ambiguous`;
- if voice is absent, gesture-only navigation/manipulation remains valid;
- no `ResolvedIntent` may invent a target or action;
- duplicate command IDs use a stable hash of session + gesture/voice IDs + target + action for deduplication.

- [ ] **Step 4: Implement truthful adapter registry**

Create registry entries for `voice`, `automations`, `connect`, `health`. Each returns `not_configured` with a concrete blocker unless an imported real adapter is present. Do not probe imaginary endpoints. Navigation and scene adapters are `ready` because they are implemented locally.

- [ ] **Step 5: Rerun tests**

```bash
npm run test:unit -- tests/unit/spatial-multimodal.test.ts tests/unit/spatial-router.test.ts
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/spatial/src tests/unit/spatial-multimodal.test.ts tests/unit/spatial-router.test.ts
git commit -m "feat: route multimodal spatial intent safely"
```

---

### Task 7: Add server-authoritative Spatial authorization and shared audit logging

**Files:**
- Create: `supabase/functions/atlas-spatial-command/_shared/context.ts`
- Create: `supabase/functions/atlas-spatial-command/_shared/policy.ts`
- Create: `supabase/functions/atlas-spatial-command/_shared/repository.ts`
- Create: `supabase/functions/atlas-spatial-command/_shared/errors.ts`
- Create: `supabase/functions/atlas-spatial-command/index.ts`
- Modify: `apps/web/src/lib/atlasSession.ts`
- Create: `apps/web/src/modules/spatial/lib/spatialApi.ts`
- Test: `tests/integration/spatial-edge-contract.test.ts`
- Test: `tests/integration/spatial-security-contract.test.ts`

**Interfaces:**
- Server permissions: `spatial.read`, `spatial.use`, `spatial.command`, `spatial.audit`, `spatial.admin`.
- Owner/admin/platform_admin receive all Spatial permissions; ordinary active members receive `spatial.read` + `spatial.use` only.
- Operations: `GET ?api=capabilities`, `POST ?api=authorize`, `GET ?api=audit`.
- `authorize` accepts one `SpatialCommand` plus `confirmation_method`; it never executes an owner-module action directly.

- [ ] **Step 1: Write the failing edge contract tests**

Test source contracts similar to existing Hospitality edge tests:

```ts
it('requires authenticated organization context before authorization', () => {
  expect(contextSource).toContain("sb.auth.getUser(token)");
  expect(contextSource).toContain("from('organization_members')");
  expect(contextSource).toContain("eq('status', 'active')");
});

it('reuses shared audit_logs and does not create a parallel audit table', () => {
  expect(repositorySource).toContain("from('audit_logs')");
  expect(repositorySource).toContain("table_name: 'atlas_spatial_command'");
});

it('never permits Tier 4 gesture-only authorization', () => {
  expect(policySource).toContain("riskTier === 4");
  expect(policySource).toContain("owner_authorization_required");
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test:integration -- tests/integration/spatial-edge-contract.test.ts tests/integration/spatial-security-contract.test.ts
```

- [ ] **Step 3: Implement server context from the existing Hospitality pattern**

Use `createClient` with the incoming bearer token. Resolve `auth.getUser(token)`, then active `organization_members`. Derive Spatial permissions from server-side role mapping. Never trust client-supplied organization ID, user ID, role, permission array, or audit actor.

- [ ] **Step 4: Implement the authoritative policy**

`authorizeSpatialCommand(ctx, command, confirmationMethod)` must:
- validate command risk tier by recalculating from action/target instead of trusting the client value;
- require `spatial.use` for Tier 0/1;
- require `spatial.command` for Tier 2;
- return `allowed:false`, `reason:'owner_authorization_required'` for Tier 3/4 unless a real owner adapter is added later;
- always reject Tier 4 when `source` is gesture-only and no owner authorization proof exists;
- reject target organization/tenant mismatch because scope comes from context, not payload.

- [ ] **Step 5: Reuse `audit_logs` for attempts and decisions**

Write rows with:

```ts
{
  org_id: ctx.orgId,
  user_id: ctx.userId,
  action: `spatial.command.${decision.allowed ? 'authorized' : 'denied'}`,
  table_name: 'atlas_spatial_command',
  record_id: command.commandId,
  new_data: {
    session_id: command.sessionId,
    source_modality: command.source,
    gesture_id: command.sourceGesture?.eventId ?? null,
    voice_intent_id: command.voiceIntentId ?? null,
    target_type: command.target.type,
    target_id: command.target.id,
    requested_action: command.action,
    risk_tier: recalculatedRisk,
    permission_decision: decision.allowed,
    confirmation_method: confirmationMethod,
    reason: decision.reason,
    correlation_id: command.commandId
  }
}
```

- [ ] **Step 6: Expose authenticated function fetch without duplicating auth refresh**

In `atlasSession.ts`, add only:

```ts
export async function atlasAuthorizedFetch(path: string, init: RequestInit = {}) {
  return authorizedFetch(path, init);
}
```

Then `spatialApi.ts` calls `/functions/v1/atlas-spatial-command?api=...` through that helper.

- [ ] **Step 7: Run integration tests and full typecheck**

```bash
npm run test:integration -- tests/integration/spatial-edge-contract.test.ts tests/integration/spatial-security-contract.test.ts
npm run typecheck
```

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/atlas-spatial-command apps/web/src/lib/atlasSession.ts apps/web/src/modules/spatial/lib tests/integration/spatial-edge-contract.test.ts tests/integration/spatial-security-contract.test.ts
git commit -m "feat: authorize and audit spatial commands server-side"
```

---

### Task 8: Register all Spatial routes and build truthful support pages

**Files:**
- Create: `apps/web/src/modules/spatial/SpatialRoutes.tsx`
- Create: `apps/web/src/modules/spatial/SpatialOverviewPage.tsx`
- Create: `apps/web/src/modules/spatial/SpatialSupportPages.tsx`
- Create: `apps/web/src/modules/spatial/components/SpatialNav.tsx`
- Create: `apps/web/src/modules/spatial/spatial.css`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Test: `tests/integration/spatial-routes.test.tsx`

**Interfaces:**
- Route family exactly matches the approved spec.
- Entire `/spatial/*` family is wrapped in `RequireAtlasIdentity`.
- Support pages use actual capability/audit data where available; otherwise they show explicit `not configured` or empty states.

- [ ] **Step 1: Write route tests first**

```tsx
it('redirects unauthenticated spatial users through ATLAS Identity', () => {
  render(<MemoryRouter initialEntries={['/spatial/workspace']}><App /></MemoryRouter>);
  expect(screen.getByRole('heading', { name:'ATLAS Identity' })).toBeInTheDocument();
  expect(screen.getByText('/spatial/workspace')).toBeInTheDocument();
});

it.each([
  '/spatial','/spatial/workspace','/spatial/calibration','/spatial/gestures','/spatial/commands',
  '/spatial/digital-twin','/spatial/automations','/spatial/integrations','/spatial/sessions',
  '/spatial/permissions','/spatial/settings'
])('registers %s', (path) => expect(routeSource).toContain(path.replace('/spatial','')));
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test:integration -- tests/integration/spatial-routes.test.tsx
```

- [ ] **Step 3: Create nested routes and navigation**

`SpatialRoutes` uses `Routes`/`Route` and redirects `/spatial/workspace` to the real workspace page. `SpatialNav` uses `NavLink`; no `href="#"`.

- [ ] **Step 4: Build real support pages rather than placeholders**

- Calibration: camera permission and calibration status, plus explicit Start Camera action.
- Gestures: table of actual `GestureDefinition` values used by the recognizer.
- Commands: current risk policy and latest session decisions.
- Digital Twin: 3D renderer entry with explicit `No Health data attached` state unless Health adapter reports ready.
- Automations/Integrations: adapter readiness list from the registry; no fake connected state.
- Sessions: server audit records when available, otherwise a truthful empty/error state.
- Permissions: current server capability response and active organization role.
- Settings: local device preferences with text `Stored on this device` until server persistence exists.

- [ ] **Step 5: Register in current App and shell without replacing current modules**

In `App.tsx` add:

```tsx
<Route path="/spatial/*" element={<RequireAtlasIdentity><SpatialRoutes /></RequireAtlasIdentity>} />
```

In `AtlasShell.tsx` add exactly one module link:

```ts
{ to: '/spatial', label: 'Spatial' }
```

Preserve Finance, Health, Hospitality, Creator, identity, and all existing routes.

- [ ] **Step 6: Rerun route tests and build**

```bash
npm run test:integration -- tests/integration/spatial-routes.test.tsx
npm run typecheck
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/components/AtlasShell.tsx apps/web/src/modules/spatial tests/integration/spatial-routes.test.tsx
git commit -m "feat: add identity-gated ATLAS Spatial routes"
```

---

### Task 9: Compose the Live Workspace, gesture cursor, command strip, Privacy Mode and non-gesture alternatives

**Files:**
- Create: `apps/web/src/modules/spatial/SpatialWorkspacePage.tsx`
- Create: `apps/web/src/modules/spatial/components/CommandStrip.tsx`
- Create: `apps/web/src/modules/spatial/components/ObjectTree.tsx`
- Create: `apps/web/src/modules/spatial/components/ContextPanel.tsx`
- Create: `apps/web/src/modules/spatial/components/CameraPanel.tsx`
- Create: `apps/web/src/modules/spatial/hooks/useSpatialController.ts`
- Modify: `apps/web/src/modules/spatial/spatial.css`
- Test: `tests/integration/spatial-workspace.test.tsx`

**Interfaces:**
- `useSpatialController()` is the single composition root for vision frames, stabilized gesture events, active mode, selected target, scene state, pending command, privacy state, and command decision.
- UI components receive state/handlers; they do not execute owner-module side effects directly.

- [ ] **Step 1: Write failing workspace behavior tests**

```tsx
it('renders camera controls without auto-starting camera', () => {
  renderSpatialWorkspace();
  expect(screen.getByRole('button', { name:'Start camera' })).toBeInTheDocument();
  expect(mockGetUserMedia).not.toHaveBeenCalled();
});

it('privacy mode stops tracks, clears transient state and cancels pending commands', async () => {
  const user = userEvent.setup();
  renderSpatialWorkspace({ withRunningCamera:true, pendingCommand:criticalCommand() });
  await user.click(screen.getByRole('button', { name:'Privacy mode' }));
  expect(mockTrackStop).toHaveBeenCalled();
  expect(screen.getByText('Spatial controls paused')).toBeInTheDocument();
  expect(screen.queryByText('Awaiting confirmation')).not.toBeInTheDocument();
});

it('provides keyboard equivalents for scene selection and cancellation', async () => {
  renderSpatialWorkspace();
  expect(screen.getByRole('tree', { name:'Spatial objects' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name:'Pause spatial controls' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
npm run test:integration -- tests/integration/spatial-workspace.test.tsx
```

- [ ] **Step 3: Implement the four-zone workspace**

DOM layout:
- left: `ObjectTree`;
- center: `SpatialCanvas` plus visible gesture cursor overlay;
- right: `ContextPanel` showing only supported actions;
- bottom: `CommandStrip` showing mode, gesture, confidence, camera, mic, confirmation and pause state.

- [ ] **Step 4: Implement command lifecycle and focus-loss cancellation**

`useSpatialController` listens to `window.blur`, `visibilitychange`, camera stop, low confidence, lost target, and Privacy Mode. Any of these moves pending gesture/command state to cancelled before execution. Low-risk navigation may execute through React Router only after stable gesture/target validation. Scene manipulation updates `sceneReducer`. Tier 2 uses the server authorization endpoint. Tier 3/4 remains denied until owner-module authorization exists.

- [ ] **Step 5: Implement accessible input equivalents**

- ObjectTree items are keyboard-selectable.
- Buttons expose rotate left/right, zoom in/out, reset and isolate for the selected object.
- `Escape` pauses/cancels pending spatial interaction but never triggers a business operation.
- Pointer/touch scene interactions route through the same scene reducer.
- `prefers-reduced-motion` disables decorative continuous scene motion, not functionality.

- [ ] **Step 6: Rerun workspace tests and regression build**

```bash
npm run test:integration -- tests/integration/spatial-workspace.test.tsx
npm run test:unit -- tests/unit/spatial-*.test.ts
npm run typecheck
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/modules/spatial tests/integration/spatial-workspace.test.tsx
git commit -m "feat: compose governed spatial live workspace"
```

---

### Task 10: Add browser/E2E, accessibility, performance and production-readiness gates

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `playwright.config.ts`
- Create: `e2e/spatial.spec.ts`
- Create: `.github/workflows/atlas-spatial-interface-ci.yml`
- Create: `docs/qa/ATLAS_SPATIAL_INTERFACE_READINESS.md`

**Interfaces:**
- Adds `npm run test:e2e` only; it does not modify production deployment workflows.
- CI validates this feature branch/PR but does not deploy.

- [ ] **Step 1: Install Playwright test support and add script**

```bash
npm install --save-dev @playwright/test
```

Add:

```json
"test:e2e": "playwright test"
```

- [ ] **Step 2: Write E2E tests before CI wiring**

```ts
import { test, expect } from '@playwright/test';

test('spatial route stays identity-gated', async ({ page }) => {
  await page.goto('/spatial/workspace');
  await expect(page.getByRole('heading', { name:'ATLAS Identity' })).toBeVisible();
});

test('2D fallback retains controls when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (type === 'webgl' || type === 'webgl2') return null;
      return original.call(this, type, ...args as any);
    } as any;
  });
  // Authenticate using the test fixture mechanism already used by the repo or route the component harness directly.
  await page.goto('/spatial/workspace');
  await expect(page.getByText('Compatibility Mode')).toBeVisible();
  await expect(page.getByRole('tree', { name:'Spatial objects' })).toBeVisible();
});
```

For authenticated E2E, do not hard-code credentials. Use a test-only route/component harness or CI-provided authenticated storage state if the repository already provides one; if neither exists, keep identity-gate E2E automated and document authenticated camera/gesture checks as manual hardware gates rather than embedding secrets.

- [ ] **Step 3: Add a feature CI workflow with no deployment job**

Workflow jobs:

```yaml
- run: npm ci
- run: npm audit --audit-level=high
- run: npm run typecheck
- run: npm run test:unit
- run: npm run test:integration
- run: npm run build
- run: npx playwright install --with-deps chromium
- run: npm run test:e2e
```

Trigger on pull requests and pushes affecting `apps/web/src/modules/spatial/**`, `packages/spatial/**`, `supabase/functions/atlas-spatial-command/**`, Spatial tests, plan/spec, and package manifests. Do not call `production-deploy.yml`.

- [ ] **Step 4: Write the readiness checklist with evidence slots that are not pre-marked PASS**

`docs/qa/ATLAS_SPATIAL_INTERFACE_READINESS.md` must include:
- Desktop Chrome/Edge/Safari capable-device camera permission test;
- tablet and mobile touch fallback;
- camera denied/revoked;
- browser blur during armed command;
- low-confidence cancellation;
- Privacy Mode stops all tracks;
- WebGL unavailable fallback;
- reduced motion;
- keyboard-only operation;
- screen-reader semantics;
- Tier 3/4 denied without owner authorization;
- tenant/organization mismatch negative test;
- audit unavailable fail-closed behavior for governed actions;
- scene resource disposal/memory inspection;
- no fake Voice/Connect/Health/Automation readiness;
- existing Finance, Health, Hospitality, Creator routes regression check.

Every row begins `NOT VERIFIED`; implementers may change it only with evidence from that environment.

- [ ] **Step 5: Run the full verification suite**

```bash
npm ci
npm audit --audit-level=high
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
npx playwright install chromium
npm run test:e2e
```

Expected: all automated gates PASS. Manual hardware gates remain explicitly NOT VERIFIED until actually run.

- [ ] **Step 6: Run final repository checks for prohibited implementation shortcuts**

```bash
grep -R 'href="#"' apps/web/src/modules/spatial packages/spatial || true
grep -R 'Coming Soon' apps/web/src/modules/spatial packages/spatial || true
grep -R 'console\.log' apps/web/src/modules/spatial packages/spatial supabase/functions/atlas-spatial-command || true
git diff --check
git status --short
```

Expected: no empty navigation, no placeholder `Coming Soon`, no console-only actions, no whitespace errors.

- [ ] **Step 7: Commit the hardening gates**

```bash
git add package.json package-lock.json playwright.config.ts e2e/spatial.spec.ts .github/workflows/atlas-spatial-interface-ci.yml docs/qa/ATLAS_SPATIAL_INTERFACE_READINESS.md
git commit -m "test: harden ATLAS Spatial Interface readiness gates"
```

---

## Final Verification Before Any Merge Request

Run from the implementation worktree after all task reviews are complete:

```bash
npm ci
npm audit --audit-level=high
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
npm run test:e2e
git diff origin/main...HEAD --check
git status --short --branch
```

Then verify these invariants manually from the diff and test evidence:

1. `App.tsx` still preserves all pre-existing current-main routes and identity behavior.
2. `AtlasShell` only adds Spatial; it does not remove or rename current modules.
3. Raw camera frames are never written to local storage, Supabase, logs, or audit payloads.
4. `audit_logs` is reused; no second audit table is introduced.
5. Tier 3/4 commands cannot execute through client-side policy alone.
6. Tier 4 cannot be approved by gesture alone.
7. Voice/Automations/Connect/Health states remain `not_configured` unless a real adapter is wired and verified.
8. No external provider credits are consumed by tests.
9. The branch has not been merged and no deployment has been triggered.
10. Manual hardware/readiness items are not marked PASS without observed evidence.

Only after this verification may the branch be called **IMPLEMENTED / TESTED**. `SECURITY VERIFIED`, `PRODUCTION CANDIDATE`, `DEPLOYED`, and `POST-DEPLOY VERIFIED` require their own observed gates and separate deployment authorization.