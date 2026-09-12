# ATLAS Spatial Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ATLAS Spatial Interface as a real, governed multimodal workspace with live hand gestures, pointer/touch/keyboard fallback, interactive 3D manipulation, server-authoritative command authorization, auditability, privacy controls, and progressive degradation.

**Architecture:** Add one `packages/spatial` workspace for renderer-independent domain logic, one `apps/web/src/modules/spatial` UI boundary, and one Supabase Edge Function for authoritative capabilities/authorization/audit. Vision, gesture recognition, scene manipulation, multimodal intent and command policy communicate through explicit contracts. Tier 3/4 actions fail closed unless an owner module later supplies a real authorization adapter; this milestone must never simulate one.

**Tech Stack:** React 18.3.1, TypeScript 5.7.x, Vite 6.4.x, React Router 7.18.3, Vitest 3.2.x, Supabase Edge Functions, shared `audit_logs`, MediaPipe Tasks Vision, Three.js + React Three Fiber, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-spatial-interface-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`; canonical branch: `main`.
- Implementation branch: `feat/atlas-spatial-interface`; do not merge or deploy without separate explicit approval.
- At execution time, use an isolated worktree and reconcile current `main` without force-reset/force-push.
- Reuse current ATLAS Identity, organization membership, shell, Supabase, `audit_logs`, test and CI patterns.
- Camera starts only from an explicit user action. Raw frames and instantaneous landmarks are ephemeral and never persisted.
- Gesture is optional input. Keyboard, pointer, touch and semantic DOM alternatives remain functional.
- One frame never executes a command. Gesture execution requires temporal stability, a stable target, the active mode and policy.
- Tier 3 requires owner-module authorization. Tier 4 can never be authorized by gesture alone.
- Client state never grants authority.
- Do not show fake camera, microphone, Voice, Connect, Automations, Health, WebGL, backend or provider readiness.
- Do not create a standalone Spatial database. Reuse canonical Supabase and `audit_logs`; device-only preferences may use labeled local storage.
- The v1 humanoid is procedural geometry; no downloaded 3D model is required.
- Every task follows RED → GREEN → focused tests → full relevant regression → commit → independent spec review → independent quality review.

---

## File Map

### Domain
- `packages/spatial/package.json`
- `packages/spatial/src/index.ts`
- `packages/spatial/src/types.ts`
- `packages/spatial/src/policy.ts`
- `packages/spatial/src/gesture-state.ts`
- `packages/spatial/src/vision/types.ts`
- `packages/spatial/src/vision/fake.ts`
- `packages/spatial/src/gestures/recognizer.ts`
- `packages/spatial/src/scene/reducer.ts`
- `packages/spatial/src/commands/multimodal.ts`
- `packages/spatial/src/commands/router.ts`
- `packages/spatial/src/integrations/registry.ts`

### Web
- `apps/web/src/modules/spatial/SpatialRoutes.tsx`
- `apps/web/src/modules/spatial/SpatialOverviewPage.tsx`
- `apps/web/src/modules/spatial/SpatialWorkspacePage.tsx`
- `apps/web/src/modules/spatial/SpatialSupportPages.tsx`
- `apps/web/src/modules/spatial/components/{SpatialNav,CameraPanel,ObjectTree,ContextPanel,CommandStrip}.tsx`
- `apps/web/src/modules/spatial/scene/{SpatialCanvas,ProceduralHumanoid}.tsx`
- `apps/web/src/modules/spatial/vision/MediaPipeVisionProvider.ts`
- `apps/web/src/modules/spatial/hooks/{useSpatialVision,useSpatialController}.ts`
- `apps/web/src/modules/spatial/lib/spatialApi.ts`
- `apps/web/src/modules/spatial/spatial.css`
- Modify `apps/web/src/App.tsx`, `apps/web/src/components/AtlasShell.tsx`, `apps/web/src/lib/atlasSession.ts`, `apps/web/package.json`, `package-lock.json`.

### Server
- `supabase/functions/atlas-spatial-command/_shared/{context,policy,repository,errors}.ts`
- `supabase/functions/atlas-spatial-command/index.ts`

### Tests/QA
- `tests/unit/spatial-*.test.ts`
- `tests/integration/spatial-*.test.tsx|ts`
- `e2e/spatial.spec.ts`
- `playwright.config.ts`
- `.github/workflows/atlas-spatial-interface-ci.yml`
- `docs/qa/ATLAS_SPATIAL_INTERFACE_READINESS.md`

---

### Task 1: Establish exact Spatial domain contracts

**Files:**
- Create: `packages/spatial/package.json`
- Create: `packages/spatial/src/types.ts`
- Create: `packages/spatial/src/index.ts`
- Test: `tests/unit/spatial-types.test.ts`

**Interfaces:** Produces all shared types used by later tasks. Later tasks import from `packages/spatial/src`; they do not redefine these names.

- [ ] **Step 1: Reconcile the isolated implementation worktree with current main**

```bash
git fetch origin
git status --short --branch
git merge --no-ff origin/main
```

Expected: current-main functionality is preserved; no force update.

- [ ] **Step 2: Write the failing type-contract test**

```ts
// tests/unit/spatial-types.test.ts
import { describe, expect, it } from 'vitest';
import type { GestureDefinition, GestureEvent, SpatialCommand, SpatialMode, SpatialPermission, SpatialRiskTier } from '../../packages/spatial/src';

const mode = (v: SpatialMode) => v;
const risk = (v: SpatialRiskTier) => v;
const permission = (v: SpatialPermission) => v;

describe('Spatial contracts', () => {
  it('defines modes, risks and permissions', () => {
    expect([mode('navigate'), mode('manipulate'), mode('command')]).toHaveLength(3);
    expect(risk(4)).toBe(4);
    expect(permission('spatial.use')).toBe('spatial.use');
  });

  it('carries gesture evidence into a command', () => {
    const definition: GestureDefinition = {
      gesture:'pinch', requiredHands:1, minimumConfidence:0.8, stableMs:180, holdMs:0,
      allowedModes:['navigate','manipulate']
    };
    const event: GestureEvent = {
      eventId:'g1', sessionId:'s1', gesture:'pinch', confidence:0.94,
      startedAt:100, endedAt:310, handedness:'right', targetId:'health',
      mode:'navigate', state:'confirmed', velocity:0.02
    };
    const command: SpatialCommand = {
      commandId:'c1', sessionId:'s1', source:'gesture', sourceGesture:event,
      target:{ id:'health', type:'route', label:'Health', route:'/health' },
      action:'open', requiredPermission:'spatial.use', riskTier:1,
      confirmationPolicy:'none', status:'requested'
    };
    expect(definition.minimumConfidence).toBe(0.8);
    expect(command.target.route).toBe('/health');
  });
});
```

- [ ] **Step 3: Run the test and confirm RED**

```bash
npm run test:unit -- tests/unit/spatial-types.test.ts
```

Expected: FAIL because `packages/spatial/src` does not exist.

- [ ] **Step 4: Create the workspace and exact type surface**

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
export type SpatialPermission = 'spatial.read' | 'spatial.use' | 'spatial.command' | 'spatial.audit' | 'spatial.admin';
export type SpatialInputModality = 'gesture' | 'voice' | 'gesture+voice' | 'pointer' | 'touch' | 'keyboard';
export type GestureName = 'point' | 'pinch' | 'swipe-left' | 'swipe-right' | 'open-palm' | 'grab' | 'two-hand-spread' | 'two-hand-pinch' | 'hold-pinch' | 'confirm';
export type GestureState = 'candidate' | 'armed' | 'confirmed' | 'executed' | 'cancelled';
export type SpatialCommandStatus = 'requested' | 'awaiting_confirmation' | 'authorized' | 'denied' | 'executing' | 'succeeded' | 'failed' | 'cancelled';
export type SpatialConfirmationPolicy = 'none' | 'brief' | 'deliberate' | 'owner-module';

export type GestureDefinition = {
  gesture: GestureName;
  requiredHands: 1 | 2;
  minimumConfidence: number;
  stableMs: number;
  holdMs: number;
  allowedModes: SpatialMode[];
};

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
  requiredPermission: SpatialPermission;
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

- [ ] **Step 5: Verify GREEN and typecheck**

```bash
npm run test:unit -- tests/unit/spatial-types.test.ts
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/spatial tests/unit/spatial-types.test.ts
git commit -m "feat: define ATLAS Spatial domain contracts"
```

---

### Task 2: Implement risk policy and gesture confirmation state machine

**Files:**
- Create: `packages/spatial/src/policy.ts`
- Create: `packages/spatial/src/gesture-state.ts`
- Modify: `packages/spatial/src/index.ts`
- Test: `tests/unit/spatial-policy.test.ts`
- Test: `tests/unit/spatial-gesture-state.test.ts`

**Interfaces:** Produces `classifySpatialRisk`, `confirmationForRisk`, `evaluateLocalSpatialPolicy`, `initialGestureMachineState`, `advanceGestureState`, `cancelGestureState`.

- [ ] **Step 1: Write failing policy/state tests**

```ts
// tests/unit/spatial-policy.test.ts
import { describe, expect, it } from 'vitest';
import { classifySpatialRisk, confirmationForRisk, evaluateLocalSpatialPolicy } from '../../packages/spatial/src';
import type { SpatialCommand } from '../../packages/spatial/src';

const base: SpatialCommand = {
  commandId:'c', sessionId:'s', source:'keyboard',
  target:{ id:'health', type:'route', label:'Health', route:'/health' },
  action:'open', requiredPermission:'spatial.use', riskTier:1,
  confirmationPolicy:'none', status:'requested'
};

describe('Spatial risk policy', () => {
  it('classifies low and critical actions', () => {
    expect(classifySpatialRisk('rotate', { id:'human', type:'scene-object', label:'Human' })).toBe(0);
    expect(classifySpatialRisk('open', base.target)).toBe(1);
    expect(classifySpatialRisk('payment.execute', { id:'bill', type:'record', label:'Bill', ownerModule:'finance' })).toBe(4);
  });
  it('fails closed locally for Tier 3/4', () => {
    const command = { ...base, action:'payment.execute', riskTier:4 as const, confirmationPolicy:'owner-module' as const };
    expect(evaluateLocalSpatialPolicy(command)).toMatchObject({ allowed:false, requiresOwnerAuthorization:true });
    expect(confirmationForRisk(4)).toBe('owner-module');
  });
});
```

```ts
// tests/unit/spatial-gesture-state.test.ts
import { describe, expect, it } from 'vitest';
import { advanceGestureState, cancelGestureState, initialGestureMachineState } from '../../packages/spatial/src';

describe('gesture state machine', () => {
  it('requires stable hold before arming and explicit confirm', () => {
    let state = initialGestureMachineState();
    state = advanceGestureState(state, { type:'candidate', gesture:'hold-pinch', at:100, confidence:0.95, targetId:'x' });
    state = advanceGestureState(state, { type:'stable', at:750, confidence:0.96, targetId:'x' });
    expect(state.phase).toBe('armed');
    state = advanceGestureState(state, { type:'confirm', at:900, confidence:0.97, targetId:'x' });
    expect(state.phase).toBe('confirmed');
  });
  it('cancels on blur', () => {
    const armed = { ...initialGestureMachineState(), phase:'armed' as const, gesture:'hold-pinch' as const, targetId:'x', startedAt:100 };
    expect(cancelGestureState(armed, 'browser_blur').phase).toBe('cancelled');
  });
});
```

- [ ] **Step 2: Confirm RED**

```bash
npm run test:unit -- tests/unit/spatial-policy.test.ts tests/unit/spatial-gesture-state.test.ts
```

- [ ] **Step 3: Implement the policy exactly**

```ts
// packages/spatial/src/policy.ts
import type { SpatialCommand, SpatialConfirmationPolicy, SpatialRiskTier, SpatialTarget } from './types';

const TIER4 = new Set(['payment.execute','delete.permanent','security.change','payroll.approve','publish.external']);
const TIER3_PREFIXES = ['finance.write','payroll.write','hr.write','health.write','permission.','communication.send'];

export function classifySpatialRisk(action: string, target: SpatialTarget): SpatialRiskTier {
  if (TIER4.has(action)) return 4;
  if (TIER3_PREFIXES.some((prefix) => action.startsWith(prefix))) return 3;
  if (target.type === 'automation' || action.startsWith('preference.') || action.startsWith('draft.')) return 2;
  if (target.type === 'route' || ['open','back','scroll'].includes(action)) return 1;
  return 0;
}

export function confirmationForRisk(risk: SpatialRiskTier): SpatialConfirmationPolicy {
  if (risk <= 1) return 'none';
  if (risk === 2) return 'brief';
  if (risk === 3) return 'deliberate';
  return 'owner-module';
}

export function evaluateLocalSpatialPolicy(command: SpatialCommand) {
  if (command.riskTier >= 3) return {
    allowed:false, reason:'owner_authorization_required', riskTier:command.riskTier, requiresOwnerAuthorization:true
  } as const;
  return {
    allowed:true,
    reason:command.riskTier <= 1 ? 'local_low_risk' : 'server_confirmation_required',
    riskTier:command.riskTier
  } as const;
}
```

- [ ] **Step 4: Implement the state machine exactly**

```ts
// packages/spatial/src/gesture-state.ts
import type { GestureName } from './types';

export type GestureMachineState = {
  phase:'idle'|'candidate'|'armed'|'confirmed'|'executed'|'cancelled';
  gesture:GestureName|null;
  targetId:string|null;
  startedAt:number|null;
  cancelReason:string|null;
};
export type GestureMachineInput =
  | { type:'candidate'; gesture:GestureName; at:number; confidence:number; targetId:string|null }
  | { type:'stable'; at:number; confidence:number; targetId:string|null }
  | { type:'confirm'; at:number; confidence:number; targetId:string|null }
  | { type:'execute'; at:number };

export const initialGestureMachineState = (): GestureMachineState => ({
  phase:'idle', gesture:null, targetId:null, startedAt:null, cancelReason:null
});

export function cancelGestureState(state: GestureMachineState, reason:string): GestureMachineState {
  return { ...state, phase:'cancelled', cancelReason:reason };
}

export function advanceGestureState(state:GestureMachineState, input:GestureMachineInput):GestureMachineState {
  if ('confidence' in input && input.confidence < 0.75) return cancelGestureState(state, 'low_confidence');
  if ('targetId' in input && state.targetId && input.targetId !== state.targetId) return cancelGestureState(state, 'target_changed');
  if (input.type === 'candidate') return {
    phase:'candidate', gesture:input.gesture, targetId:input.targetId, startedAt:input.at, cancelReason:null
  };
  if (input.type === 'stable' && state.phase === 'candidate' && state.startedAt !== null) {
    const required = state.gesture === 'hold-pinch' ? 600 : 180;
    return input.at - state.startedAt >= required ? { ...state, phase:'armed' } : state;
  }
  if (input.type === 'confirm' && state.phase === 'armed') return { ...state, phase:'confirmed' };
  if (input.type === 'execute' && state.phase === 'confirmed') return { ...state, phase:'executed' };
  return state;
}
```

- [ ] **Step 5: Export and verify GREEN**

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

- [ ] **Step 6: Commit**

```bash
git add packages/spatial/src tests/unit/spatial-policy.test.ts tests/unit/spatial-gesture-state.test.ts
git commit -m "feat: add spatial risk and gesture safety policy"
```

---

### Task 3: Add privacy-safe VisionProvider, fake provider and browser camera lifecycle

**Files:**
- Modify: `apps/web/package.json`
- Modify: `package-lock.json`
- Create: `packages/spatial/src/vision/types.ts`
- Create: `packages/spatial/src/vision/fake.ts`
- Create: `apps/web/src/modules/spatial/hooks/useSpatialVision.ts`
- Modify: `packages/spatial/src/index.ts`
- Test: `tests/unit/spatial-vision.test.ts`

**Interfaces:** `VisionProvider.start(video,onFrame)`, `VisionProvider.stop()`, `FakeVisionProvider.push(frame)`, `useSpatialVision(provider)`.

- [ ] **Step 1: Write failing provider tests**

```ts
// tests/unit/spatial-vision.test.ts
import { describe, expect, it, vi } from 'vitest';
import { FakeVisionProvider } from '../../packages/spatial/src';

describe('VisionProvider', () => {
  it('emits normalized frames and stops cleanly', async () => {
    const provider = new FakeVisionProvider();
    const listener = vi.fn();
    await provider.start({} as HTMLVideoElement, listener);
    provider.push({ timestamp:1, hands:[] });
    expect(listener).toHaveBeenCalledWith({ timestamp:1, hands:[] });
    await provider.stop();
    provider.push({ timestamp:2, hands:[] });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Confirm RED, then install MediaPipe runtime**

```bash
npm run test:unit -- tests/unit/spatial-vision.test.ts
npm install --workspace apps/web @mediapipe/tasks-vision
```

- [ ] **Step 3: Implement the provider contract and fake**

```ts
// packages/spatial/src/vision/types.ts
export type HandLandmark = { x:number; y:number; z:number };
export type NormalizedHand = { landmarks:HandLandmark[]; handedness:'left'|'right'|'unknown'; confidence:number };
export type HandFrame = { timestamp:number; hands:NormalizedHand[] };
export interface VisionProvider {
  start(video:HTMLVideoElement, onFrame:(frame:HandFrame)=>void):Promise<void>;
  stop():Promise<void>|void;
}
export function validateHandFrame(frame:HandFrame) {
  return frame.hands.every((hand) => hand.landmarks.length === 21 && hand.confidence >= 0 && hand.confidence <= 1);
}
```

```ts
// packages/spatial/src/vision/fake.ts
import type { HandFrame, VisionProvider } from './types';
import { validateHandFrame } from './types';
export class FakeVisionProvider implements VisionProvider {
  private listener:((frame:HandFrame)=>void)|null = null;
  async start(_video:HTMLVideoElement, onFrame:(frame:HandFrame)=>void) { this.listener = onFrame; }
  async stop() { this.listener = null; }
  push(frame:HandFrame) {
    if (!validateHandFrame(frame)) throw new Error('invalid_hand_frame');
    this.listener?.(frame);
  }
}
```

- [ ] **Step 4: Implement the browser hook with explicit consent and Privacy Mode**

```ts
// apps/web/src/modules/spatial/hooks/useSpatialVision.ts
import { useRef, useState } from 'react';
import type { HandFrame, VisionProvider } from '../../../../../packages/spatial/src';

export function useSpatialVision(provider:VisionProvider) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const [status,setStatus] = useState<'idle'|'requesting'|'running'|'denied'|'unavailable'|'error'>('idle');
  const [lastFrame,setLastFrame] = useState<HandFrame|null>(null);
  const [error,setError] = useState<string|null>(null);

  async function stopCamera() {
    await provider.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setLastFrame(null);
    setStatus('idle');
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) { setStatus('unavailable'); return; }
    setStatus('requesting'); setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' }, audio:false });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      await provider.start(videoRef.current, setLastFrame);
      setStatus('running');
    } catch (e) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setLastFrame(null);
      const name = e instanceof DOMException ? e.name : '';
      setStatus(name === 'NotAllowedError' ? 'denied' : 'error');
      setError(name || 'camera_start_failed');
    }
  }

  async function privacyLock() { await stopCamera(); }
  return { videoRef, status, lastFrame, error, startCamera, stopCamera, privacyLock };
}
```

- [ ] **Step 5: Export and verify GREEN**

```ts
// packages/spatial/src/index.ts additions
export * from './vision/types';
export * from './vision/fake';
```

```bash
npm run test:unit -- tests/unit/spatial-vision.test.ts
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json package-lock.json packages/spatial/src/vision packages/spatial/src/index.ts apps/web/src/modules/spatial/hooks/useSpatialVision.ts tests/unit/spatial-vision.test.ts
git commit -m "feat: add privacy-safe spatial vision lifecycle"
```

---

### Task 4: Implement MediaPipe landmarks and stable gesture recognition

**Files:**
- Create: `apps/web/src/modules/spatial/vision/MediaPipeVisionProvider.ts`
- Create: `packages/spatial/src/gestures/recognizer.ts`
- Modify: `packages/spatial/src/index.ts`
- Test: `tests/unit/spatial-recognizer.test.ts`

**Interfaces:** `MediaPipeVisionProvider implements VisionProvider`; `recognizeGesture(frame,previous,mode)`; `StableGestureRecognizer.push(frame,targetId,mode)`.

- [ ] **Step 1: Write complete deterministic fixture tests**

```ts
// tests/unit/spatial-recognizer.test.ts
import { describe, expect, it } from 'vitest';
import { StableGestureRecognizer, recognizeGesture, type HandFrame } from '../../packages/spatial/src';

const p = (x:number,y:number,z=0) => ({x,y,z});
function baseLandmarks() { return Array.from({length:21}, () => p(0.5,0.5)); }
function pinchFrame(timestamp:number):HandFrame {
  const landmarks = baseLandmarks();
  landmarks[0]=p(0.5,0.8); landmarks[4]=p(0.50,0.40); landmarks[8]=p(0.52,0.40);
  return { timestamp, hands:[{ landmarks, handedness:'right', confidence:0.95 }] };
}

describe('gesture recognizer', () => {
  it('recognizes pinch from thumb/index distance', () => {
    expect(recognizeGesture(pinchFrame(100), null, 'navigate')?.gesture).toBe('pinch');
  });
  it('requires stability before emission and suppresses immediate duplicate', () => {
    const r = new StableGestureRecognizer({ stableMs:180, holdMs:600, cooldownMs:350, minConfidence:0.8 });
    expect(r.push(pinchFrame(100),'finance','navigate')).toBeNull();
    expect(r.push(pinchFrame(300),'finance','navigate')?.gesture).toBe('pinch');
    expect(r.push(pinchFrame(320),'finance','navigate')).toBeNull();
  });
});
```

- [ ] **Step 2: Confirm RED**

```bash
npm run test:unit -- tests/unit/spatial-recognizer.test.ts
```

- [ ] **Step 3: Implement recognizer with exact thresholds**

```ts
// packages/spatial/src/gestures/recognizer.ts
import type { GestureEvent, GestureName, SpatialMode } from '../types';
import type { HandFrame, HandLandmark } from '../vision/types';

const distance = (a:HandLandmark,b:HandLandmark) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export type RecognizedGesture = { gesture:GestureName; confidence:number; handedness:'left'|'right'|'both'|'unknown'; velocity:number };

export function recognizeGesture(frame:HandFrame, previous:HandFrame|null, _mode:SpatialMode):RecognizedGesture|null {
  const hand = frame.hands[0];
  if (!hand || hand.confidence < 0.8) return null;
  const lm = hand.landmarks;
  if (distance(lm[4],lm[8]) <= 0.055) return { gesture:'pinch', confidence:hand.confidence, handedness:hand.handedness, velocity:0 };
  const extended = (tip:number,pip:number) => distance(lm[tip],lm[0]) > distance(lm[pip],lm[0]);
  if (extended(8,6) && !extended(12,10) && !extended(16,14) && !extended(20,18)) return { gesture:'point', confidence:hand.confidence, handedness:hand.handedness, velocity:0 };
  if (extended(8,6) && extended(12,10) && extended(16,14) && extended(20,18)) return { gesture:'open-palm', confidence:hand.confidence, handedness:hand.handedness, velocity:0 };
  if (previous?.hands[0]) {
    const dx = lm[0].x - previous.hands[0].landmarks[0].x;
    const dy = Math.abs(lm[0].y - previous.hands[0].landmarks[0].y);
    if (Math.abs(dx) >= 0.12 && dy <= 0.06) return { gesture:dx > 0 ? 'swipe-right' : 'swipe-left', confidence:hand.confidence, handedness:hand.handedness, velocity:Math.abs(dx) };
  }
  return null;
}

export class StableGestureRecognizer {
  private candidate:{ value:RecognizedGesture; startedAt:number; targetId:string|null; mode:SpatialMode }|null = null;
  private lastFrame:HandFrame|null = null;
  private lastEmitAt = -Infinity;
  constructor(private config:{stableMs:number;holdMs:number;cooldownMs:number;minConfidence:number}) {}
  push(frame:HandFrame,targetId:string|null,mode:SpatialMode):GestureEvent|null {
    const value = recognizeGesture(frame,this.lastFrame,mode); this.lastFrame = frame;
    if (!value || value.confidence < this.config.minConfidence) { this.candidate=null; return null; }
    if (!this.candidate || this.candidate.value.gesture !== value.gesture || this.candidate.targetId !== targetId || this.candidate.mode !== mode) {
      this.candidate = { value, startedAt:frame.timestamp, targetId, mode }; return null;
    }
    const required = value.gesture === 'hold-pinch' ? this.config.holdMs : this.config.stableMs;
    if (frame.timestamp - this.candidate.startedAt < required || frame.timestamp - this.lastEmitAt < this.config.cooldownMs) return null;
    this.lastEmitAt = frame.timestamp;
    return {
      eventId:`gesture-${frame.timestamp}`, sessionId:'pending', gesture:value.gesture, confidence:value.confidence,
      startedAt:this.candidate.startedAt, endedAt:frame.timestamp, handedness:value.handedness,
      targetId, mode, state:'candidate', velocity:value.velocity
    };
  }
}
```

- [ ] **Step 4: Implement the MediaPipe provider without storing frames**

```ts
// apps/web/src/modules/spatial/vision/MediaPipeVisionProvider.ts
import type { HandFrame, VisionProvider } from '../../../../../packages/spatial/src';

export class MediaPipeVisionProvider implements VisionProvider {
  private landmarker:any = null; private raf=0; private stopped=true;
  async start(video:HTMLVideoElement,onFrame:(frame:HandFrame)=>void) {
    const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm');
    const options:any = {
      baseOptions:{ modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate:'GPU' },
      runningMode:'VIDEO', numHands:2, minHandDetectionConfidence:0.7, minHandPresenceConfidence:0.7, minTrackingConfidence:0.7
    };
    try { this.landmarker = await HandLandmarker.createFromOptions(vision,options); }
    catch { this.landmarker = await HandLandmarker.createFromOptions(vision,{...options,baseOptions:{...options.baseOptions,delegate:'CPU'}}); }
    this.stopped=false;
    const loop=() => {
      if (this.stopped) return;
      const timestamp=performance.now(); const result=this.landmarker.detectForVideo(video,timestamp);
      const hands=(result.landmarks||[]).map((landmarks:any[],i:number) => ({
        landmarks:landmarks.map((v:any)=>({x:v.x,y:v.y,z:v.z})),
        handedness:String(result.handedness?.[i]?.[0]?.categoryName||'unknown').toLowerCase() as 'left'|'right'|'unknown',
        confidence:Number(result.handedness?.[i]?.[0]?.score||0)
      }));
      onFrame({timestamp,hands}); this.raf=requestAnimationFrame(loop);
    };
    this.raf=requestAnimationFrame(loop);
  }
  async stop() { this.stopped=true; cancelAnimationFrame(this.raf); this.landmarker?.close?.(); this.landmarker=null; }
}
```

- [ ] **Step 5: Export, verify and commit**

```ts
// packages/spatial/src/index.ts additions
export * from './gestures/recognizer';
```

```bash
npm run test:unit -- tests/unit/spatial-recognizer.test.ts tests/unit/spatial-vision.test.ts
npm run typecheck
git add apps/web/src/modules/spatial/vision packages/spatial/src tests/unit/spatial-recognizer.test.ts
git commit -m "feat: recognize stable hand gestures with MediaPipe"
```

---

### Task 5: Implement renderer-independent scene state and procedural 3D manipulation

**Files:**
- Modify: `apps/web/package.json`, `package-lock.json`
- Create: `packages/spatial/src/scene/reducer.ts`
- Create: `apps/web/src/modules/spatial/scene/SpatialCanvas.tsx`
- Create: `apps/web/src/modules/spatial/scene/ProceduralHumanoid.tsx`
- Modify: `packages/spatial/src/index.ts`
- Test: `tests/unit/spatial-scene.test.ts`

**Interfaces:** `createInitialSceneState()`, `sceneReducer(state,action)`, `SpatialCanvas({state,dispatch,onTargetFocus})`.

- [ ] **Step 1: Write failing reducer tests**

```ts
import { describe, expect, it } from 'vitest';
import { createInitialSceneState, sceneReducer } from '../../packages/spatial/src';

describe('Spatial scene reducer', () => {
  it('clamps rotation and zoom', () => {
    let s=createInitialSceneState();
    s=sceneReducer(s,{type:'rotate',objectId:'human',delta:{x:9,y:-9}});
    s=sceneReducer(s,{type:'zoom',delta:99});
    expect(s.objects.human.rotation.x).toBeLessThanOrEqual(Math.PI);
    expect(s.camera.zoom).toBe(2.5);
  });
  it('isolates without deleting object registry', () => {
    const s=sceneReducer(createInitialSceneState(),{type:'isolate',objectId:'torso'});
    expect(s.isolatedObjectId).toBe('torso');
    expect(Object.keys(s.objects)).toContain('head');
  });
});
```

- [ ] **Step 2: Confirm RED and install renderer dependencies**

```bash
npm run test:unit -- tests/unit/spatial-scene.test.ts
npm install --workspace apps/web three @react-three/fiber
```

- [ ] **Step 3: Implement exact state reducer**

```ts
// packages/spatial/src/scene/reducer.ts
export type SpatialObjectState={id:string;position:{x:number;y:number;z:number};rotation:{x:number;y:number;z:number};visible:boolean};
export type SpatialSceneState={objects:Record<string,SpatialObjectState>;selectedObjectId:string|null;isolatedObjectId:string|null;camera:{zoom:number};compatibilityMode:boolean};
export type SceneAction=
 | {type:'select';objectId:string|null}
 | {type:'rotate';objectId:string;delta:{x:number;y:number}}
 | {type:'translate';objectId:string;delta:{x:number;y:number;z:number}}
 | {type:'zoom';delta:number}
 | {type:'isolate';objectId:string|null}
 | {type:'reset'}
 | {type:'setCompatibilityMode';value:boolean};
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const ids=['human','head','torso','left-arm','right-arm','left-leg','right-leg'];
export function createInitialSceneState():SpatialSceneState {
  const objects=Object.fromEntries(ids.map((id)=>[id,{id,position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},visible:true}]));
  return {objects,selectedObjectId:'human',isolatedObjectId:null,camera:{zoom:1},compatibilityMode:false};
}
export function sceneReducer(state:SpatialSceneState,action:SceneAction):SpatialSceneState {
  if(action.type==='reset') return createInitialSceneState();
  if(action.type==='select') return {...state,selectedObjectId:action.objectId};
  if(action.type==='isolate') return {...state,isolatedObjectId:action.objectId};
  if(action.type==='setCompatibilityMode') return {...state,compatibilityMode:action.value};
  if(action.type==='zoom') return {...state,camera:{zoom:clamp(state.camera.zoom+action.delta,0.6,2.5)}};
  const obj='objectId' in action ? state.objects[action.objectId] : undefined; if(!obj) return state;
  if(action.type==='rotate') return {...state,objects:{...state.objects,[obj.id]:{...obj,rotation:{...obj.rotation,x:clamp(obj.rotation.x+action.delta.x,-Math.PI,Math.PI),y:clamp(obj.rotation.y+action.delta.y,-Math.PI,Math.PI)}}}};
  if(action.type==='translate') return {...state,objects:{...state.objects,[obj.id]:{...obj,position:{x:clamp(obj.position.x+action.delta.x,-2,2),y:clamp(obj.position.y+action.delta.y,-2,2),z:clamp(obj.position.z+action.delta.z,-2,2)}}}};
  return state;
}
```

- [ ] **Step 4: Implement procedural humanoid and accessible fallback**

```tsx
// apps/web/src/modules/spatial/scene/ProceduralHumanoid.tsx
export function ProceduralHumanoid({onTargetFocus}:{onTargetFocus:(id:string)=>void}) {
  const part=(id:string,y:number,s:[number,number,number]) => (
    <mesh key={id} position={[0,y,0]} scale={s} onPointerDown={()=>onTargetFocus(id)} userData={{spatialTargetId:id}}>
      <sphereGeometry args={[1,24,24]} /><meshStandardMaterial roughness={0.45} metalness={0.25} />
    </mesh>
  );
  return <group>{part('head',1.8,[0.32,0.38,0.32])}{part('torso',0.8,[0.55,0.8,0.3])}{part('left-arm',0.8,[0.18,0.7,0.18])}{part('right-arm',0.8,[0.18,0.7,0.18])}{part('left-leg',-0.6,[0.22,0.9,0.22])}{part('right-leg',-0.6,[0.22,0.9,0.22])}</group>;
}
```

```tsx
// apps/web/src/modules/spatial/scene/SpatialCanvas.tsx
import { Canvas } from '@react-three/fiber';
import { ProceduralHumanoid } from './ProceduralHumanoid';
export function SpatialCanvas({compatible,onTargetFocus}:{compatible:boolean;onTargetFocus:(id:string)=>void}) {
  if(!compatible) return <div role="img" aria-label="ATLAS spatial model unavailable in 3D">Compatibility Mode: use the object controls to inspect the model.</div>;
  return <Canvas aria-hidden="true"><ambientLight intensity={1.2}/><directionalLight position={[3,4,5]} intensity={2}/><ProceduralHumanoid onTargetFocus={onTargetFocus}/></Canvas>;
}
```

- [ ] **Step 5: Export, test, build and commit**

```bash
npm run test:unit -- tests/unit/spatial-scene.test.ts
npm run typecheck
npm run build
git add apps/web/package.json package-lock.json packages/spatial/src/scene packages/spatial/src/index.ts apps/web/src/modules/spatial/scene tests/unit/spatial-scene.test.ts
git commit -m "feat: add interactive ATLAS spatial scene"
```

---

### Task 6: Implement multimodal intent, command routing and truthful integration registry

**Files:**
- Create: `packages/spatial/src/commands/multimodal.ts`
- Create: `packages/spatial/src/commands/router.ts`
- Create: `packages/spatial/src/integrations/registry.ts`
- Modify: `packages/spatial/src/index.ts`
- Test: `tests/unit/spatial-multimodal.test.ts`
- Test: `tests/unit/spatial-router.test.ts`

**Interfaces:** `VoiceIntent`, `ResolvedIntent`, `resolveMultimodalIntent(input)`, `routeSpatialCommand(intent,context)`, `SpatialOwnerAdapter`, `defaultSpatialIntegrations()`.

- [ ] **Step 1: Write failing tests with no undefined helpers**

```ts
// tests/unit/spatial-multimodal.test.ts
import { expect,it } from 'vitest';
import { resolveMultimodalIntent } from '../../packages/spatial/src';

it('refuses contradictory targets',()=>{
  const result=resolveMultimodalIntent({
    gesture:{eventId:'g',sessionId:'s',gesture:'point',confidence:.95,startedAt:1,endedAt:2,handedness:'right',targetId:'invoice-1',mode:'navigate',state:'confirmed',velocity:0},
    voice:{id:'v',action:'open',targetId:'employee-9'},
    activeTarget:{id:'invoice-1',type:'record',label:'Invoice',ownerModule:'finance'}
  });
  expect(result.status).toBe('ambiguous');
});
```

```ts
// tests/unit/spatial-router.test.ts
import { expect,it } from 'vitest';
import { routeSpatialCommand } from '../../packages/spatial/src';
it('routes visual and sensitive actions to correct risk tiers',()=>{
  expect(routeSpatialCommand({status:'resolved',action:'rotate',target:{id:'human',type:'scene-object',label:'Human'},source:'gesture'}, {sessionId:'s'}).riskTier).toBe(0);
  expect(routeSpatialCommand({status:'resolved',action:'finance.write.memo',target:{id:'bill',type:'record',label:'Bill',ownerModule:'finance'},source:'gesture'}, {sessionId:'s'}).riskTier).toBe(3);
});
```

- [ ] **Step 2: Confirm RED**

```bash
npm run test:unit -- tests/unit/spatial-multimodal.test.ts tests/unit/spatial-router.test.ts
```

- [ ] **Step 3: Implement intent resolution and command routing**

```ts
// packages/spatial/src/commands/multimodal.ts
import type { GestureEvent, SpatialInputModality, SpatialTarget } from '../types';
export type VoiceIntent={id:string;action:string;targetId:string|null};
export type ResolvedIntent=
 | {status:'ambiguous';reason:string}
 | {status:'resolved';action:string;target:SpatialTarget;source:SpatialInputModality;gesture?:GestureEvent;voice?:VoiceIntent};
export function resolveMultimodalIntent(input:{gesture:GestureEvent|null;voice:VoiceIntent|null;activeTarget:SpatialTarget|null}):ResolvedIntent {
  const {gesture,voice,activeTarget}=input; const gestureTarget=gesture?.targetId||activeTarget?.id||null;
  if(voice?.targetId && gestureTarget && voice.targetId!==gestureTarget) return {status:'ambiguous',reason:'target_conflict'};
  if(!activeTarget) return {status:'ambiguous',reason:'target_missing'};
  const action=voice?.action || (gesture?.gesture==='pinch'?'open':gesture?.gesture==='swipe-left'?'back':gesture?.gesture==='swipe-right'?'open':'focus');
  return {status:'resolved',action,target:activeTarget,source:voice&&gesture?'gesture+voice':voice?'voice':'gesture',gesture:gesture||undefined,voice:voice||undefined};
}
```

```ts
// packages/spatial/src/commands/router.ts
import { classifySpatialRisk, confirmationForRisk } from '../policy';
import type { SpatialCommand } from '../types';
import type { ResolvedIntent } from './multimodal';
export function routeSpatialCommand(intent:Extract<ResolvedIntent,{status:'resolved'}>,context:{sessionId:string}):SpatialCommand {
  const riskTier=classifySpatialRisk(intent.action,intent.target);
  return {commandId:`${context.sessionId}:${intent.target.id}:${intent.action}`,sessionId:context.sessionId,source:intent.source,sourceGesture:intent.gesture,voiceIntentId:intent.voice?.id,target:intent.target,action:intent.action,requiredPermission:riskTier<=1?'spatial.use':'spatial.command',riskTier,confirmationPolicy:confirmationForRisk(riskTier),status:'requested'};
}
```

- [ ] **Step 4: Implement truthful adapter readiness**

```ts
// packages/spatial/src/integrations/registry.ts
import type { IntegrationReadiness } from '../types';
export type SpatialOwnerAdapter={ownerModule:string;readiness:()=>Promise<IntegrationReadiness>;supports:(action:string)=>boolean};
const unavailable=(integration:IntegrationReadiness['integration'],blocker:string):IntegrationReadiness=>({integration,state:'not_configured',blocker,checkedAt:new Date().toISOString()});
export function defaultSpatialIntegrations():Record<IntegrationReadiness['integration'],IntegrationReadiness>{
  return {
    voice:unavailable('voice','voice_intent_adapter_not_configured'),
    automations:unavailable('automations','automation_adapter_not_configured'),
    connect:unavailable('connect','device_adapter_not_configured'),
    health:unavailable('health','health_data_adapter_not_configured')
  };
}
```

- [ ] **Step 5: Export, test and commit**

```bash
npm run test:unit -- tests/unit/spatial-multimodal.test.ts tests/unit/spatial-router.test.ts
npm run typecheck
git add packages/spatial/src tests/unit/spatial-multimodal.test.ts tests/unit/spatial-router.test.ts
git commit -m "feat: resolve and route multimodal spatial intent"
```

---

### Task 7: Implement server-authoritative capabilities, authorization and shared audit

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

**Interfaces:** Operations are `GET ?api=capabilities`, `POST ?api=authorize`, `GET ?api=audit`. `authorize` records a decision but never directly executes Finance/Payroll/HR/Health/device/external actions.

- [ ] **Step 1: Write failing source-contract tests**

```ts
// tests/integration/spatial-edge-contract.test.ts
import { readFileSync } from 'node:fs'; import { expect,it } from 'vitest';
const context=readFileSync('supabase/functions/atlas-spatial-command/_shared/context.ts','utf8');
const repo=readFileSync('supabase/functions/atlas-spatial-command/_shared/repository.ts','utf8');
it('derives user/org from Supabase rather than payload',()=>{expect(context).toContain('auth.getUser');expect(context).toContain("from('organization_members')");});
it('reuses audit_logs',()=>{expect(repo).toContain("from('audit_logs')");expect(repo).toContain("atlas_spatial_command");});
```

```ts
// tests/integration/spatial-security-contract.test.ts
import { readFileSync } from 'node:fs'; import { expect,it } from 'vitest';
const policy=readFileSync('supabase/functions/atlas-spatial-command/_shared/policy.ts','utf8');
it('fails closed for Tier 3/4 and gesture-only Tier 4',()=>{expect(policy).toContain('owner_authorization_required');expect(policy).toContain("command.source === 'gesture'");});
```

- [ ] **Step 2: Confirm RED**

```bash
npm run test:integration -- tests/integration/spatial-edge-contract.test.ts tests/integration/spatial-security-contract.test.ts
```

- [ ] **Step 3: Implement server context using the existing ATLAS pattern**

```ts
// supabase/functions/atlas-spatial-command/_shared/context.ts
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import type { SpatialPermission } from '../../../../packages/spatial/src/types.ts';
const URL=Deno.env.get('SUPABASE_URL')||''; const KEY=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY')||'';
const rolePermissions=(role:string):SpatialPermission[]=>['owner','admin','platform_admin'].includes(role)
 ? ['spatial.read','spatial.use','spatial.command','spatial.audit','spatial.admin'] : ['spatial.read','spatial.use'];
export async function resolveSpatialContext(req:Request){
  const auth=req.headers.get('authorization')||''; const token=auth.replace(/^Bearer\s+/i,''); if(!token) throw new Error('authentication_required');
  const sb=createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:auth}}});
  const {data,error}=await sb.auth.getUser(token); if(error||!data.user) throw new Error('invalid_session');
  const {data:memberships,error:membershipError}=await sb.from('organization_members').select('org_id,role,status').eq('user_id',data.user.id).eq('status','active').limit(1);
  if(membershipError||!memberships?.[0]?.org_id) throw new Error('active_organization_required');
  const role=String(memberships[0].role||'member'); return {sb,userId:data.user.id,orgId:String(memberships[0].org_id),role,permissions:rolePermissions(role)};
}
```

- [ ] **Step 4: Implement authoritative policy by recalculating risk**

```ts
// supabase/functions/atlas-spatial-command/_shared/policy.ts
import { classifySpatialRisk } from '../../../../packages/spatial/src/policy.ts';
import type { SpatialCommand, SpatialPermission } from '../../../../packages/spatial/src/types.ts';
export function authorizeSpatialCommand(ctx:{permissions:SpatialPermission[]},command:SpatialCommand,confirmationMethod:string){
  const riskTier=classifySpatialRisk(command.action,command.target);
  const has=(p:SpatialPermission)=>ctx.permissions.includes(p)||ctx.permissions.includes('spatial.admin');
  if(riskTier<=1) return {allowed:has('spatial.use'),reason:has('spatial.use')?'authorized':'permission_denied',riskTier};
  if(riskTier===2) return {allowed:has('spatial.command')&&confirmationMethod!=='none',reason:has('spatial.command')?'authorized':'permission_denied',riskTier};
  if(riskTier===4 && command.source==='gesture') return {allowed:false,reason:'owner_authorization_required',riskTier};
  return {allowed:false,reason:'owner_authorization_required',riskTier};
}
```

- [ ] **Step 5: Implement shared audit writes/reads and safe Edge router**

```ts
// supabase/functions/atlas-spatial-command/_shared/repository.ts
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
const URL=Deno.env.get('SUPABASE_URL')||''; const SECRET=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const admin=()=>{if(!SECRET)throw new Error('server_secret_not_configured');return createClient(URL,SECRET,{auth:{persistSession:false,autoRefreshToken:false}});};
export async function writeSpatialAudit(orgId:string,userId:string,command:any,decision:any,confirmationMethod:string){
  const {data,error}=await admin().from('audit_logs').insert({org_id:orgId,user_id:userId,action:`spatial.command.${decision.allowed?'authorized':'denied'}`,table_name:'atlas_spatial_command',record_id:command.commandId,new_data:{session_id:command.sessionId,source_modality:command.source,gesture_id:command.sourceGesture?.eventId??null,voice_intent_id:command.voiceIntentId??null,target_type:command.target.type,target_id:command.target.id,requested_action:command.action,risk_tier:decision.riskTier,permission_decision:decision.allowed,confirmation_method:confirmationMethod,reason:decision.reason,correlation_id:command.commandId}}).select('id').single();
  if(error)throw error; return String(data.id);
}
export async function listSpatialAudit(orgId:string){const {data,error}=await admin().from('audit_logs').select('id,org_id,user_id,action,record_id,new_data,created_at').eq('org_id',orgId).eq('table_name','atlas_spatial_command').order('created_at',{ascending:false}).limit(100);if(error)throw error;return data||[];}
```

`errors.ts` must expose `json`, CORS headers, `optionsResponse`, and normalize errors to non-secret messages. `index.ts` must resolve context before every non-OPTIONS operation, require `spatial.read` for capabilities, `spatial.audit` for audit, parse one command for authorize, call `authorizeSpatialCommand`, write the audit row, and return `{ok:true,decision:{...decision,auditReference}}`.

- [ ] **Step 6: Add exact authenticated web helper and API wrapper**

```ts
// apps/web/src/lib/atlasSession.ts addition
export async function atlasAuthorizedFetch(path:string,init:RequestInit={}) { return authorizedFetch(path,init); }
```

```ts
// apps/web/src/modules/spatial/lib/spatialApi.ts
import { atlasAuthorizedFetch } from '../../../lib/atlasSession';
import type { SpatialCommand } from '../../../../../packages/spatial/src';
async function parse(res:Response){const body=await res.json();if(!res.ok)throw new Error(body?.error||`spatial_request_${res.status}`);return body;}
export const getSpatialCapabilities=()=>atlasAuthorizedFetch('/functions/v1/atlas-spatial-command?api=capabilities').then(parse);
export const getSpatialAudit=()=>atlasAuthorizedFetch('/functions/v1/atlas-spatial-command?api=audit').then(parse);
export const authorizeSpatialCommand=(command:SpatialCommand,confirmation_method:string)=>atlasAuthorizedFetch('/functions/v1/atlas-spatial-command?api=authorize',{method:'POST',body:JSON.stringify({command,confirmation_method})}).then(parse);
```

- [ ] **Step 7: Verify and commit**

```bash
npm run test:integration -- tests/integration/spatial-edge-contract.test.ts tests/integration/spatial-security-contract.test.ts
npm run typecheck
git add supabase/functions/atlas-spatial-command apps/web/src/lib/atlasSession.ts apps/web/src/modules/spatial/lib tests/integration/spatial-edge-contract.test.ts tests/integration/spatial-security-contract.test.ts
git commit -m "feat: authorize and audit spatial commands server-side"
```

---

### Task 8: Register every Spatial route and build the live workspace with accessible fallbacks

**Files:**
- Create: `apps/web/src/modules/spatial/SpatialRoutes.tsx`
- Create: `apps/web/src/modules/spatial/SpatialOverviewPage.tsx`
- Create: `apps/web/src/modules/spatial/SpatialWorkspacePage.tsx`
- Create: `apps/web/src/modules/spatial/SpatialSupportPages.tsx`
- Create: `apps/web/src/modules/spatial/components/{SpatialNav,CameraPanel,ObjectTree,ContextPanel,CommandStrip}.tsx`
- Create: `apps/web/src/modules/spatial/hooks/useSpatialController.ts`
- Create: `apps/web/src/modules/spatial/spatial.css`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Test: `tests/integration/spatial-routes.test.tsx`
- Test: `tests/integration/spatial-workspace.test.tsx`

**Interfaces:** Whole route family is identity-gated. `SpatialWorkspacePage` accepts optional `visionProvider?: VisionProvider` for deterministic tests and defaults to `new MediaPipeVisionProvider()` in production.

- [ ] **Step 1: Write failing route/workspace tests with concrete mocks**

```tsx
// tests/integration/spatial-routes.test.tsx
import { render,screen } from '@testing-library/react'; import { MemoryRouter } from 'react-router-dom'; import { expect,it } from 'vitest'; import { App } from '../../apps/web/src/App';
it('keeps /spatial/workspace identity-gated',()=>{render(<MemoryRouter initialEntries={['/spatial/workspace']}><App/></MemoryRouter>);expect(screen.getByRole('heading',{name:'ATLAS Identity'})).toBeInTheDocument();expect(screen.getByText('/spatial/workspace')).toBeInTheDocument();});
```

```tsx
// tests/integration/spatial-workspace.test.tsx
import { render,screen } from '@testing-library/react'; import userEvent from '@testing-library/user-event'; import { expect,it,vi } from 'vitest'; import { FakeVisionProvider } from '../../packages/spatial/src'; import { SpatialWorkspacePage } from '../../apps/web/src/modules/spatial/SpatialWorkspacePage';
it('does not request camera until Start camera',async()=>{const getUserMedia=vi.fn().mockResolvedValue({getTracks:()=>[{stop:vi.fn()}]});Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia},configurable:true});render(<SpatialWorkspacePage visionProvider={new FakeVisionProvider()}/>);expect(getUserMedia).not.toHaveBeenCalled();await userEvent.click(screen.getByRole('button',{name:'Start camera'}));expect(getUserMedia).toHaveBeenCalledTimes(1);});
it('exposes non-gesture object controls',()=>{render(<SpatialWorkspacePage visionProvider={new FakeVisionProvider()}/>);expect(screen.getByRole('tree',{name:'Spatial objects'})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Zoom in'})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Pause spatial controls'})).toBeInTheDocument();});
```

- [ ] **Step 2: Confirm RED**

```bash
npm run test:integration -- tests/integration/spatial-routes.test.tsx tests/integration/spatial-workspace.test.tsx
```

- [ ] **Step 3: Implement nested route ownership exactly**

```tsx
// apps/web/src/modules/spatial/SpatialRoutes.tsx
import { Navigate,Route,Routes } from 'react-router-dom';
import { SpatialOverviewPage } from './SpatialOverviewPage'; import { SpatialWorkspacePage } from './SpatialWorkspacePage';
import { CalibrationPage,GesturesPage,CommandsPage,DigitalTwinPage,AutomationsPage,IntegrationsPage,SessionsPage,PermissionsPage,SettingsPage } from './SpatialSupportPages';
export function SpatialRoutes(){return <Routes>
<Route index element={<SpatialOverviewPage/>}/><Route path="workspace" element={<SpatialWorkspacePage/>}/><Route path="calibration" element={<CalibrationPage/>}/><Route path="gestures" element={<GesturesPage/>}/><Route path="commands" element={<CommandsPage/>}/><Route path="digital-twin" element={<DigitalTwinPage/>}/><Route path="automations" element={<AutomationsPage/>}/><Route path="integrations" element={<IntegrationsPage/>}/><Route path="sessions" element={<SessionsPage/>}/><Route path="permissions" element={<PermissionsPage/>}/><Route path="settings" element={<SettingsPage/>}/><Route path="*" element={<Navigate to="/spatial" replace/>}/>
</Routes>}
```

In `App.tsx` add only:

```tsx
<Route path="/spatial/*" element={<RequireAtlasIdentity><SpatialRoutes /></RequireAtlasIdentity>} />
```

In `AtlasShell.tsx` add only:

```ts
{ to:'/spatial', label:'Spatial' }
```

Do not remove or rename existing Finance, Health, Hospitality, Creator or Identity routes.

- [ ] **Step 4: Implement one controller composition root and four-zone UI**

```ts
// apps/web/src/modules/spatial/hooks/useSpatialController.ts
import { useEffect,useMemo,useReducer,useState } from 'react';
import { StableGestureRecognizer,createInitialSceneState,sceneReducer,type SpatialMode,type VisionProvider } from '../../../../../packages/spatial/src';
import { useSpatialVision } from './useSpatialVision';
export function useSpatialController(provider:VisionProvider){
 const vision=useSpatialVision(provider); const [mode,setMode]=useState<SpatialMode>('navigate'); const [paused,setPaused]=useState(false); const [targetId,setTargetId]=useState<string|null>('human'); const [scene,dispatch]=useReducer(sceneReducer,undefined,createInitialSceneState); const recognizer=useMemo(()=>new StableGestureRecognizer({stableMs:180,holdMs:600,cooldownMs:350,minConfidence:.8}),[]); const [gesture,setGesture]=useState<any>(null);
 useEffect(()=>{if(!vision.lastFrame||paused)return;setGesture(recognizer.push(vision.lastFrame,targetId,mode));},[vision.lastFrame,paused,targetId,mode,recognizer]);
 useEffect(()=>{const cancel=()=>{setPaused(true);setGesture(null)};window.addEventListener('blur',cancel);return()=>window.removeEventListener('blur',cancel)},[]);
 async function privacyMode(){setPaused(true);setGesture(null);await vision.privacyLock();}
 return {vision,mode,setMode,paused,setPaused,targetId,setTargetId,scene,dispatch,gesture,privacyMode};
}
```

`SpatialWorkspacePage` renders: left `ObjectTree`, center `SpatialCanvas` + visible cursor overlay, right `ContextPanel`, bottom `CommandStrip`, plus `CameraPanel`. Open-palm or blur pauses; lost hand/low confidence clears candidate; no pending Tier 3/4 command executes in this task.

- [ ] **Step 5: Implement real support-page states, not placeholders**

`SpatialSupportPages.tsx` must render:
- Calibration: current camera state and link/button to workspace camera controls.
- Gestures: table backed by exported gesture definitions/thresholds.
- Commands: risk tier table from policy.
- Digital Twin: `No Health data attached` unless Health adapter is actually ready.
- Automations/Integrations: `defaultSpatialIntegrations()` readiness values.
- Sessions: `getSpatialAudit()` results with loading/empty/error states.
- Permissions: `getSpatialCapabilities()` result with role/permission data.
- Settings: local preference toggles labeled `Stored on this device`.

Use this storage shape only for non-sensitive preferences:

```ts
const KEY='atlas_spatial_preferences_v1';
export type SpatialPreferences={reducedMotion:boolean;cameraMirrored:boolean;gestureSensitivity:'low'|'standard'|'high'};
export const loadSpatialPreferences=():SpatialPreferences=>{try{return JSON.parse(localStorage.getItem(KEY)||'') as SpatialPreferences}catch{return{reducedMotion:false,cameraMirrored:true,gestureSensitivity:'standard'}}};
export const saveSpatialPreferences=(v:SpatialPreferences)=>localStorage.setItem(KEY,JSON.stringify(v));
```

- [ ] **Step 6: Add responsive/focus/reduced-motion CSS**

```css
.spatial-workspace{display:grid;grid-template-columns:minmax(13rem,18rem) minmax(0,1fr) minmax(15rem,20rem);grid-template-rows:minmax(32rem,1fr) auto;gap:1rem}.spatial-command-strip{grid-column:1/-1}.spatial-workspace :focus-visible{outline:2px solid currentColor;outline-offset:3px}@media(max-width:900px){.spatial-workspace{grid-template-columns:1fr;grid-template-rows:auto}.spatial-command-strip{grid-column:1}}@media(prefers-reduced-motion:reduce){.spatial-workspace *{scroll-behavior:auto!important;animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}
```

- [ ] **Step 7: Verify routes, workspace and regressions**

```bash
npm run test:integration -- tests/integration/spatial-routes.test.tsx tests/integration/spatial-workspace.test.tsx
npm run test:unit -- tests/unit/spatial-types.test.ts tests/unit/spatial-policy.test.ts tests/unit/spatial-gesture-state.test.ts tests/unit/spatial-vision.test.ts tests/unit/spatial-recognizer.test.ts tests/unit/spatial-scene.test.ts tests/unit/spatial-multimodal.test.ts tests/unit/spatial-router.test.ts
npm run typecheck
npm run build
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/components/AtlasShell.tsx apps/web/src/modules/spatial tests/integration/spatial-routes.test.tsx tests/integration/spatial-workspace.test.tsx
git commit -m "feat: add governed ATLAS Spatial workspace"
```

---

### Task 9: Add browser/E2E, accessibility, performance and readiness gates

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `playwright.config.ts`
- Create: `e2e/spatial.spec.ts`
- Create: `.github/workflows/atlas-spatial-interface-ci.yml`
- Create: `docs/qa/ATLAS_SPATIAL_INTERFACE_READINESS.md`

**Interfaces:** Adds `npm run test:e2e`; CI validates but never deploys.

- [ ] **Step 1: Install Playwright and add exact script**

```bash
npm install --save-dev @playwright/test
```

Add to root scripts:

```json
"test:e2e": "playwright test"
```

- [ ] **Step 2: Add concrete Playwright configuration**

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./e2e',use:{baseURL:'http://127.0.0.1:4173'},webServer:{command:'npm --workspace apps/web run build && npm --workspace apps/web exec -- vite preview --host 127.0.0.1 --port 4173',url:'http://127.0.0.1:4173',reuseExistingServer:false}});
```

- [ ] **Step 3: Write E2E with secret-free authenticated network fixtures**

```ts
// e2e/spatial.spec.ts
import { test,expect } from '@playwright/test';
async function authenticate(page:any){
 await page.addInitScript(()=>localStorage.setItem('atlas_access_token','e2e-token'));
 await page.route('**/rest/v1/organization_members**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{org_id:'org-e2e',role:'admin',status:'active',organizations:{id:'org-e2e',name:'E2E Org',legal_name:'E2E Org',active:true}}])}));
 await page.route('**/functions/v1/atlas-spatial-command?api=capabilities',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,organization_id:'org-e2e',role:'admin',permissions:['spatial.read','spatial.use','spatial.command','spatial.audit','spatial.admin']})}));
}
test('spatial is identity-gated without a session',async({page})=>{await page.goto('/spatial/workspace');await expect(page.getByRole('heading',{name:'ATLAS Identity'})).toBeVisible();});
test('authenticated workspace keeps camera opt-in',async({page})=>{await authenticate(page);await page.goto('/spatial/workspace');await expect(page.getByRole('button',{name:'Start camera'})).toBeVisible();await expect(page.getByRole('tree',{name:'Spatial objects'})).toBeVisible();});
test('WebGL loss preserves 2D controls',async({page})=>{await authenticate(page);await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type:any,...args:any[]){if(type==='webgl'||type==='webgl2')return null;return original.call(this,type,...args as any)} as any});await page.goto('/spatial/workspace');await expect(page.getByText(/Compatibility Mode/i)).toBeVisible();await expect(page.getByRole('button',{name:'Zoom in'})).toBeVisible();});
```

- [ ] **Step 4: Add non-deploying CI**

```yaml
# .github/workflows/atlas-spatial-interface-ci.yml
name: ATLAS Spatial Interface CI
on:
  pull_request:
    paths: ['apps/web/src/modules/spatial/**','packages/spatial/**','supabase/functions/atlas-spatial-command/**','tests/**/spatial-*','e2e/spatial.spec.ts','playwright.config.ts','apps/web/package.json','package.json','package-lock.json']
  push:
    branches: ['feat/atlas-spatial-interface']
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm audit --audit-level=high
      - run: npm run typecheck
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

- [ ] **Step 5: Create the readiness evidence document with all manual rows initially NOT VERIFIED**

```md
# ATLAS Spatial Interface Readiness

| Gate | Status | Evidence |
|---|---|---|
| Chrome desktop camera allow/deny/revoke | NOT VERIFIED | — |
| Safari desktop camera allow/deny/revoke | NOT VERIFIED | — |
| Tablet touch fallback | NOT VERIFIED | — |
| Mobile touch fallback | NOT VERIFIED | — |
| Browser blur cancels armed command | NOT VERIFIED | — |
| Privacy Mode stops every media track | NOT VERIFIED | — |
| Low-confidence/lost-hand cancellation | NOT VERIFIED | — |
| WebGL compatibility mode | NOT VERIFIED | — |
| Reduced motion | NOT VERIFIED | — |
| Keyboard-only flow | NOT VERIFIED | — |
| Screen-reader semantics | NOT VERIFIED | — |
| Tier 3/4 owner authorization fail-closed | NOT VERIFIED | — |
| Audit unavailable fail-closed where required | NOT VERIFIED | — |
| Scene resource disposal / memory | NOT VERIFIED | — |
| Finance/Health/Hospitality/Creator regression | NOT VERIFIED | — |
| Voice/Automations/Connect/Health truthful readiness | NOT VERIFIED | — |
```

- [ ] **Step 6: Run complete automated verification**

```bash
npm ci
npm audit --audit-level=high
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
npx playwright install chromium
npm run test:e2e
grep -R 'href="#"' apps/web/src/modules/spatial packages/spatial || true
grep -R 'Coming Soon' apps/web/src/modules/spatial packages/spatial || true
grep -R 'console\.log' apps/web/src/modules/spatial packages/spatial supabase/functions/atlas-spatial-command || true
git diff --check
git status --short --branch
```

Expected: automated gates PASS, grep outputs no implementation shortcuts, manual hardware rows remain NOT VERIFIED until observed.

- [ ] **Step 7: Commit hardening artifacts**

```bash
git add package.json package-lock.json playwright.config.ts e2e/spatial.spec.ts .github/workflows/atlas-spatial-interface-ci.yml docs/qa/ATLAS_SPATIAL_INTERFACE_READINESS.md
git commit -m "test: harden ATLAS Spatial Interface readiness gates"
```

---

## Final Verification Before Any Merge Request

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

Then independently verify from code and evidence:

1. Current-main routes and ATLAS Identity are preserved.
2. Spatial adds one shell entry and one identity-gated route family; it does not replace another module.
3. Raw camera frames are absent from storage, Supabase payloads, logs and audit rows.
4. `audit_logs` remains the audit source of truth.
5. Tier 3/4 cannot execute through client policy; Tier 4 cannot be approved by gesture alone.
6. Health data is not attached to the procedural human without an explicit real Health adapter.
7. Voice/Automations/Connect/Health remain `not_configured` until a real contract is wired and verified.
8. Keyboard/pointer/touch alternatives are present for meaningful gesture actions.
9. No external provider credits are consumed by tests.
10. No merge or deployment has occurred.
11. Manual camera/device/security/readiness rows are not marked PASS without observed evidence.

Only then may the branch be called **IMPLEMENTED / TESTED**. `SECURITY VERIFIED`, `PRODUCTION CANDIDATE`, `DEPLOYED`, and `POST-DEPLOY VERIFIED` require their own observed gates and separate deployment authorization.