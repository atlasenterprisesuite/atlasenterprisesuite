# ATLAS Spatial Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ATLAS Spatial Interface as a governed multimodal workspace with live hand gestures, pointer/touch/keyboard fallbacks, interactive 3D manipulation, privacy controls, server-authoritative command authorization, auditability, and capability-based degradation.

**Architecture:** Add `packages/spatial` for renderer-independent domain logic, `apps/web/src/modules/spatial` for web UI/input/rendering, and `supabase/functions/atlas-spatial-command` for authoritative capabilities/authorization/audit. Vision, gesture recognition, scene manipulation, multimodal intent, policy, and owner-module readiness communicate through explicit contracts. Tier 3/4 actions fail closed until a real owner-module adapter exists; this milestone never simulates one.

**Tech Stack:** React 18.3.1, TypeScript 5.7.x, Vite 6.4.x, React Router 7.18.3, Vitest 3.2.x, Supabase Edge Functions, shared `audit_logs`, MediaPipe Tasks Vision, Three.js + React Three Fiber, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-spatial-interface-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`; canonical branch: `main`.
- Implementation branch: `feat/atlas-spatial-interface`; no merge or deploy without separate explicit approval.
- Execution uses an isolated worktree and reconciles current `main` without force-reset/force-push.
- Reuse ATLAS Identity, active organization membership, shell, Supabase, `audit_logs`, test, and CI patterns.
- Camera starts only after explicit user action. Raw frames and instantaneous landmarks are ephemeral and are never persisted.
- Gesture is additive input. Keyboard, pointer, touch, and semantic DOM alternatives remain functional.
- A single frame never executes a command. Gesture action requires temporal stability, target stability, active mode, policy, and confirmation where required.
- Tier 3 requires owner-module authorization. Tier 4 can never be authorized by gesture alone.
- Client state never grants authority.
- Do not show fake camera, microphone, Voice, Connect, Automations, Health, WebGL, backend, or provider readiness.
- Do not create a second Spatial database. Reuse canonical Supabase and `audit_logs`; non-sensitive device preferences may use labeled local storage.
- The v1 humanoid uses procedural geometry; no downloaded 3D human model is required.
- Every meaningful gesture action has a keyboard/pointer/touch equivalent.
- Task cycle: RED → minimal GREEN → focused regression → commit → independent spec review → independent quality review.

---

## File Map

### Domain
- `packages/spatial/package.json`
- `packages/spatial/src/index.ts`
- `packages/spatial/src/types.ts`
- `packages/spatial/src/capabilities.ts`
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
- `apps/web/src/modules/spatial/components/SpatialNav.tsx`
- `apps/web/src/modules/spatial/components/CameraPanel.tsx`
- `apps/web/src/modules/spatial/components/ObjectTree.tsx`
- `apps/web/src/modules/spatial/components/ContextPanel.tsx`
- `apps/web/src/modules/spatial/components/CommandStrip.tsx`
- `apps/web/src/modules/spatial/scene/SpatialCanvas.tsx`
- `apps/web/src/modules/spatial/scene/ProceduralHumanoid.tsx`
- `apps/web/src/modules/spatial/vision/MediaPipeVisionProvider.ts`
- `apps/web/src/modules/spatial/hooks/useSpatialVision.ts`
- `apps/web/src/modules/spatial/hooks/useSpatialController.ts`
- `apps/web/src/modules/spatial/lib/spatialApi.ts`
- `apps/web/src/modules/spatial/lib/browserCapabilities.ts`
- `apps/web/src/modules/spatial/lib/preferences.ts`
- `apps/web/src/modules/spatial/spatial.css`
- Modify `apps/web/src/App.tsx`, `apps/web/src/components/AtlasShell.tsx`, `apps/web/src/lib/atlasSession.ts`, `apps/web/package.json`, `package-lock.json`.

### Server
- `supabase/functions/atlas-spatial-command/_shared/context.ts`
- `supabase/functions/atlas-spatial-command/_shared/policy.ts`
- `supabase/functions/atlas-spatial-command/_shared/repository.ts`
- `supabase/functions/atlas-spatial-command/_shared/errors.ts`
- `supabase/functions/atlas-spatial-command/index.ts`

### Tests/QA
- `tests/unit/spatial-types.test.ts`
- `tests/unit/spatial-capabilities.test.ts`
- `tests/unit/spatial-policy.test.ts`
- `tests/unit/spatial-gesture-state.test.ts`
- `tests/unit/spatial-vision.test.ts`
- `tests/unit/spatial-recognizer.test.ts`
- `tests/unit/spatial-scene.test.ts`
- `tests/unit/spatial-multimodal.test.ts`
- `tests/unit/spatial-router.test.ts`
- `tests/integration/spatial-edge-contract.test.ts`
- `tests/integration/spatial-security-contract.test.ts`
- `tests/integration/spatial-routes.test.tsx`
- `tests/integration/spatial-workspace.test.tsx`
- `e2e/spatial.spec.ts`
- `playwright.config.ts`
- `.github/workflows/atlas-spatial-interface-ci.yml`
- `docs/qa/ATLAS_SPATIAL_INTERFACE_READINESS.md`

---

### Task 1: Define Spatial contracts and capability modes

**Files:**
- Create: `packages/spatial/package.json`
- Create: `packages/spatial/src/types.ts`
- Create: `packages/spatial/src/capabilities.ts`
- Create: `packages/spatial/src/index.ts`
- Test: `tests/unit/spatial-types.test.ts`
- Test: `tests/unit/spatial-capabilities.test.ts`

**Interfaces:** Produces all shared domain types plus `deriveCapabilityMode()`.

- [ ] **Step 1: Reconcile the isolated execution worktree with current main**

```bash
git fetch origin
git status --short --branch
git merge --no-ff origin/main
```

Expected: current-main functionality remains; no force update.

- [ ] **Step 2: Write failing type and capability tests**

```ts
// tests/unit/spatial-types.test.ts
import { describe, expect, it } from 'vitest';
import type { GestureDefinition, GestureEvent, SpatialCommand, SpatialMode, SpatialPermission, SpatialRiskTier } from '../../packages/spatial/src';

const mode=(v:SpatialMode)=>v; const risk=(v:SpatialRiskTier)=>v; const permission=(v:SpatialPermission)=>v;
describe('Spatial contracts',()=>{
  it('defines modes, risks, permissions and gesture motion',()=>{
    expect([mode('navigate'),mode('manipulate'),mode('command')]).toHaveLength(3);
    expect(risk(4)).toBe(4); expect(permission('spatial.use')).toBe('spatial.use');
    const def:GestureDefinition={gesture:'grab',requiredHands:1,minimumConfidence:.8,stableMs:180,holdMs:0,allowedModes:['manipulate']};
    const event:GestureEvent={eventId:'g1',sessionId:'s1',gesture:'grab',confidence:.95,startedAt:1,endedAt:250,handedness:'right',targetId:'human',mode:'manipulate',state:'confirmed',velocity:.1,motion:{dx:.1,dy:-.1,dz:0}};
    const command:SpatialCommand={commandId:'c1',sessionId:'s1',source:'gesture',sourceGesture:event,target:{id:'human',type:'scene-object',label:'Human'},action:'translate',requiredPermission:'spatial.use',riskTier:0,confirmationPolicy:'none',status:'requested'};
    expect(def.allowedModes).toContain('manipulate'); expect(command.sourceGesture?.motion?.dx).toBe(.1);
  });
});
```

```ts
// tests/unit/spatial-capabilities.test.ts
import { expect,it } from 'vitest';
import { deriveCapabilityMode } from '../../packages/spatial/src';
it('uses compatibility without WebGL',()=>expect(deriveCapabilityMode({webgl:false,camera:true,microphone:true,reducedMotion:false,hardwareConcurrency:8})).toBe('compatibility'));
it('uses reduced for constrained/reduced-motion devices',()=>expect(deriveCapabilityMode({webgl:true,camera:true,microphone:true,reducedMotion:true,hardwareConcurrency:8})).toBe('reduced'));
it('uses optimal only for capable devices',()=>expect(deriveCapabilityMode({webgl:true,camera:true,microphone:true,reducedMotion:false,hardwareConcurrency:8})).toBe('optimal'));
```

- [ ] **Step 3: Confirm RED**

```bash
npm run test:unit -- tests/unit/spatial-types.test.ts tests/unit/spatial-capabilities.test.ts
```

- [ ] **Step 4: Create the workspace and exact shared types**

```json
// packages/spatial/package.json
{"name":"@atlas/spatial","private":true,"version":"0.1.0","type":"module"}
```

```ts
// packages/spatial/src/types.ts
export type SpatialMode='navigate'|'manipulate'|'command';
export type SpatialRiskTier=0|1|2|3|4;
export type SpatialPermission='spatial.read'|'spatial.use'|'spatial.command'|'spatial.audit'|'spatial.admin';
export type SpatialInputModality='gesture'|'voice'|'gesture+voice'|'pointer'|'touch'|'keyboard';
export type SpatialCapabilityMode='optimal'|'reduced'|'compatibility';
export type GestureName='point'|'pinch'|'swipe-left'|'swipe-right'|'open-palm'|'grab'|'two-hand-spread'|'two-hand-pinch'|'hold-pinch'|'confirm';
export type GestureState='candidate'|'armed'|'confirmed'|'executed'|'cancelled';
export type SpatialCommandStatus='requested'|'awaiting_confirmation'|'authorized'|'denied'|'executing'|'succeeded'|'failed'|'cancelled';
export type SpatialConfirmationPolicy='none'|'brief'|'deliberate'|'owner-module';
export type GestureDefinition={gesture:GestureName;requiredHands:1|2;minimumConfidence:number;stableMs:number;holdMs:number;allowedModes:SpatialMode[]};
export type SpatialTarget={id:string;type:'route'|'scene-object'|'record'|'automation'|'device'|'health-layer';label:string;route?:string;ownerModule?:string};
export type GestureEvent={eventId:string;sessionId:string;gesture:GestureName;confidence:number;startedAt:number;endedAt:number;handedness:'left'|'right'|'both'|'unknown';targetId:string|null;mode:SpatialMode;state:GestureState;velocity:number;motion?:{dx:number;dy:number;dz:number};scaleDelta?:number;cursor?:{x:number;y:number}};
export type SpatialCommand={commandId:string;sessionId:string;source:SpatialInputModality;sourceGesture?:GestureEvent;voiceIntentId?:string;target:SpatialTarget;action:string;requiredPermission:SpatialPermission;riskTier:SpatialRiskTier;confirmationPolicy:SpatialConfirmationPolicy;status:SpatialCommandStatus};
export type CommandDecision={allowed:boolean;reason:string;riskTier:SpatialRiskTier;requiresOwnerAuthorization?:boolean;auditReference?:string|null};
export type SpatialSession={sessionId:string;organizationId:string;userId:string|null;deviceId:string;startedAt:string;endedAt:string|null;cameraPermission:'unknown'|'prompt'|'granted'|'denied'|'unavailable';voiceEnabled:boolean;activeScene:string;status:'active'|'paused'|'ended'};
export type IntegrationReadiness={integration:'voice'|'automations'|'connect'|'health';state:'ready'|'not_configured'|'unavailable'|'error';blocker:string|null;checkedAt:string};
export type SpatialDeviceCapabilities={webgl:boolean;camera:boolean;microphone:boolean;reducedMotion:boolean;hardwareConcurrency:number};
```

```ts
// packages/spatial/src/capabilities.ts
import type { SpatialCapabilityMode,SpatialDeviceCapabilities } from './types';
export function deriveCapabilityMode(c:SpatialDeviceCapabilities):SpatialCapabilityMode{
  if(!c.webgl)return 'compatibility';
  if(c.reducedMotion||c.hardwareConcurrency<=4)return 'reduced';
  return 'optimal';
}
```

```ts
// packages/spatial/src/index.ts
export * from './types'; export * from './capabilities';
```

- [ ] **Step 5: Verify GREEN and commit**

```bash
npm run test:unit -- tests/unit/spatial-types.test.ts tests/unit/spatial-capabilities.test.ts
npm run typecheck
git add packages/spatial tests/unit/spatial-types.test.ts tests/unit/spatial-capabilities.test.ts
git commit -m "feat: define ATLAS Spatial contracts and capabilities"
```

---

### Task 2: Implement risk policy and confirmation state machine

**Files:** `packages/spatial/src/policy.ts`, `packages/spatial/src/gesture-state.ts`, `packages/spatial/src/index.ts`, `tests/unit/spatial-policy.test.ts`, `tests/unit/spatial-gesture-state.test.ts`.

**Interfaces:** `classifySpatialRisk`, `confirmationForRisk`, `evaluateLocalSpatialPolicy`, `initialGestureMachineState`, `advanceGestureState`, `cancelGestureState`.

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/spatial-policy.test.ts
import { expect,it } from 'vitest'; import { classifySpatialRisk,confirmationForRisk,evaluateLocalSpatialPolicy } from '../../packages/spatial/src'; import type { SpatialCommand } from '../../packages/spatial/src';
const target={id:'bill',type:'record' as const,label:'Bill',ownerModule:'finance'};
it('classifies visual/navigation/sensitive/critical actions',()=>{expect(classifySpatialRisk('rotate',{id:'h',type:'scene-object',label:'Human'})).toBe(0);expect(classifySpatialRisk('open',{id:'f',type:'route',label:'Finance',route:'/finance'})).toBe(1);expect(classifySpatialRisk('finance.write.memo',target)).toBe(3);expect(classifySpatialRisk('payment.execute',target)).toBe(4)});
it('fails closed locally for Tier 3/4',()=>{const c:SpatialCommand={commandId:'c',sessionId:'s',source:'gesture',target,action:'payment.execute',requiredPermission:'spatial.command',riskTier:4,confirmationPolicy:'owner-module',status:'requested'};expect(evaluateLocalSpatialPolicy(c)).toMatchObject({allowed:false,requiresOwnerAuthorization:true});expect(confirmationForRisk(4)).toBe('owner-module')});
```

```ts
// tests/unit/spatial-gesture-state.test.ts
import { expect,it } from 'vitest'; import { advanceGestureState,cancelGestureState,initialGestureMachineState } from '../../packages/spatial/src';
it('requires hold then second pinch confirmation',()=>{let s=initialGestureMachineState();s=advanceGestureState(s,{type:'candidate',gesture:'hold-pinch',at:100,confidence:.95,targetId:'x'});s=advanceGestureState(s,{type:'stable',at:750,confidence:.96,targetId:'x'});expect(s.phase).toBe('armed');s=advanceGestureState(s,{type:'confirm',at:900,confidence:.97,targetId:'x'});expect(s.phase).toBe('confirmed')});
it('cancels on low confidence or external loss',()=>{let s={...initialGestureMachineState(),phase:'armed' as const,gesture:'hold-pinch' as const,targetId:'x',startedAt:100};expect(advanceGestureState(s,{type:'stable',at:800,confidence:.5,targetId:'x'}).phase).toBe('cancelled');expect(cancelGestureState(s,'browser_blur').phase).toBe('cancelled')});
```

- [ ] **Step 2: Confirm RED**

```bash
npm run test:unit -- tests/unit/spatial-policy.test.ts tests/unit/spatial-gesture-state.test.ts
```

- [ ] **Step 3: Implement exact policy**

```ts
// packages/spatial/src/policy.ts
import type { SpatialCommand,SpatialConfirmationPolicy,SpatialRiskTier,SpatialTarget } from './types';
const T4=new Set(['payment.execute','delete.permanent','security.change','payroll.approve','publish.external']); const T3=['finance.write','payroll.write','hr.write','health.write','permission.','communication.send'];
export function classifySpatialRisk(action:string,target:SpatialTarget):SpatialRiskTier{if(T4.has(action))return 4;if(T3.some(p=>action.startsWith(p)))return 3;if(target.type==='automation'||action.startsWith('preference.')||action.startsWith('draft.'))return 2;if(target.type==='route'||['open','back','scroll'].includes(action))return 1;return 0}
export function confirmationForRisk(r:SpatialRiskTier):SpatialConfirmationPolicy{return r<=1?'none':r===2?'brief':r===3?'deliberate':'owner-module'}
export function evaluateLocalSpatialPolicy(c:SpatialCommand){if(c.riskTier>=3)return{allowed:false,reason:'owner_authorization_required',riskTier:c.riskTier,requiresOwnerAuthorization:true} as const;return{allowed:true,reason:c.riskTier<=1?'local_low_risk':'server_confirmation_required',riskTier:c.riskTier} as const}
```

- [ ] **Step 4: Implement exact state machine**

```ts
// packages/spatial/src/gesture-state.ts
import type { GestureName } from './types';
export type GestureMachineState={phase:'idle'|'candidate'|'armed'|'confirmed'|'executed'|'cancelled';gesture:GestureName|null;targetId:string|null;startedAt:number|null;cancelReason:string|null};
export type GestureMachineInput={type:'candidate';gesture:GestureName;at:number;confidence:number;targetId:string|null}|{type:'stable'|'confirm';at:number;confidence:number;targetId:string|null}|{type:'execute';at:number};
export const initialGestureMachineState=():GestureMachineState=>({phase:'idle',gesture:null,targetId:null,startedAt:null,cancelReason:null});
export const cancelGestureState=(s:GestureMachineState,reason:string):GestureMachineState=>({...s,phase:'cancelled',cancelReason:reason});
export function advanceGestureState(s:GestureMachineState,i:GestureMachineInput):GestureMachineState{if('confidence'in i&&i.confidence<.75)return cancelGestureState(s,'low_confidence');if('targetId'in i&&s.targetId&&i.targetId!==s.targetId)return cancelGestureState(s,'target_changed');if(i.type==='candidate')return{phase:'candidate',gesture:i.gesture,targetId:i.targetId,startedAt:i.at,cancelReason:null};if(i.type==='stable'&&s.phase==='candidate'&&s.startedAt!==null){const required=s.gesture==='hold-pinch'?600:180;return i.at-s.startedAt>=required?{...s,phase:'armed'}:s}if(i.type==='confirm'&&s.phase==='armed')return{...s,phase:'confirmed'};if(i.type==='execute'&&s.phase==='confirmed')return{...s,phase:'executed'};return s}
```

- [ ] **Step 5: Export, verify, commit**

```ts
// packages/spatial/src/index.ts additions
export * from './policy'; export * from './gesture-state';
```

```bash
npm run test:unit -- tests/unit/spatial-policy.test.ts tests/unit/spatial-gesture-state.test.ts
npm run typecheck
git add packages/spatial/src tests/unit/spatial-policy.test.ts tests/unit/spatial-gesture-state.test.ts
git commit -m "feat: add spatial safety policy"
```

---

### Task 3: Add privacy-safe vision contracts and camera lifecycle

**Files:** `apps/web/package.json`, `package-lock.json`, `packages/spatial/src/vision/types.ts`, `packages/spatial/src/vision/fake.ts`, `packages/spatial/src/index.ts`, `apps/web/src/modules/spatial/hooks/useSpatialVision.ts`, `tests/unit/spatial-vision.test.ts`.

**Interfaces:** `VisionProvider`, `FakeVisionProvider`, `useSpatialVision(provider)`.

- [ ] **Step 1: Write failing provider test and confirm RED**

```ts
// tests/unit/spatial-vision.test.ts
import { expect,it,vi } from 'vitest'; import { FakeVisionProvider } from '../../packages/spatial/src';
it('stops frame delivery after stop',async()=>{const p=new FakeVisionProvider();const fn=vi.fn();await p.start({} as HTMLVideoElement,fn);p.push({timestamp:1,hands:[]});await p.stop();p.push({timestamp:2,hands:[]});expect(fn).toHaveBeenCalledTimes(1)});
```

```bash
npm run test:unit -- tests/unit/spatial-vision.test.ts
npm install --workspace apps/web @mediapipe/tasks-vision
```

- [ ] **Step 2: Implement normalized frame contract and fake**

```ts
// packages/spatial/src/vision/types.ts
export type HandLandmark={x:number;y:number;z:number}; export type NormalizedHand={landmarks:HandLandmark[];handedness:'left'|'right'|'unknown';confidence:number}; export type HandFrame={timestamp:number;hands:NormalizedHand[]};
export interface VisionProvider{start(video:HTMLVideoElement,onFrame:(f:HandFrame)=>void):Promise<void>;stop():Promise<void>|void;setMaxFps?(fps:number):void}
export const validateHandFrame=(f:HandFrame)=>f.hands.every(h=>h.landmarks.length===21&&h.confidence>=0&&h.confidence<=1);
```

```ts
// packages/spatial/src/vision/fake.ts
import type { HandFrame,VisionProvider } from './types'; import { validateHandFrame } from './types';
export class FakeVisionProvider implements VisionProvider{private listener:((f:HandFrame)=>void)|null=null;async start(_v:HTMLVideoElement,fn:(f:HandFrame)=>void){this.listener=fn}async stop(){this.listener=null}push(f:HandFrame){if(!validateHandFrame(f))throw new Error('invalid_hand_frame');this.listener?.(f)}}
```

- [ ] **Step 3: Implement explicit camera start, revoke handling, stop and Privacy Mode**

```ts
// apps/web/src/modules/spatial/hooks/useSpatialVision.ts
import { useRef,useState } from 'react'; import type { HandFrame,VisionProvider } from '../../../../../../packages/spatial/src';
export function useSpatialVision(provider:VisionProvider){
 const videoRef=useRef<HTMLVideoElement>(null);const streamRef=useRef<MediaStream|null>(null);const [status,setStatus]=useState<'idle'|'requesting'|'running'|'denied'|'unavailable'|'error'>('idle');const [lastFrame,setLastFrame]=useState<HandFrame|null>(null);const [error,setError]=useState<string|null>(null);
 const clearStream=async()=>{await provider.stop();const stream=streamRef.current;streamRef.current=null;if(stream)for(const t of stream.getTracks()){t.onended=null;t.stop()}if(videoRef.current)videoRef.current.srcObject=null;setLastFrame(null)};
 async function stopCamera(){await clearStream();setStatus('idle')}
 async function startCamera(){if(!navigator.mediaDevices?.getUserMedia||!videoRef.current){setStatus('unavailable');return}setStatus('requesting');setError(null);try{const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});streamRef.current=stream;for(const t of stream.getTracks())t.onended=()=>{void clearStream().finally(()=>setStatus('unavailable'))};videoRef.current.srcObject=stream;await videoRef.current.play();await provider.start(videoRef.current,setLastFrame);setStatus('running')}catch(e){await clearStream();const name=e instanceof DOMException?e.name:'camera_start_failed';setStatus(name==='NotAllowedError'?'denied':'error');setError(name)}}
 async function privacyLock(){await clearStream();setStatus('idle')}
 return{videoRef,status,lastFrame,error,startCamera,stopCamera,privacyLock};
}
```

Correct relative path note: files under `apps/web/src/modules/spatial/{hooks,vision,lib}` need **six** `..` segments to reach repository root before `packages/spatial`.

- [ ] **Step 4: Export, verify, commit**

```ts
// packages/spatial/src/index.ts additions
export * from './vision/types'; export * from './vision/fake';
```

```bash
npm run test:unit -- tests/unit/spatial-vision.test.ts
npm run typecheck
git add apps/web/package.json package-lock.json packages/spatial/src/vision packages/spatial/src/index.ts apps/web/src/modules/spatial/hooks/useSpatialVision.ts tests/unit/spatial-vision.test.ts
git commit -m "feat: add privacy-safe spatial vision lifecycle"
```

---

### Task 4: Implement all approved gestures, cursor coordinates and adaptive MediaPipe inference

**Files:** `apps/web/src/modules/spatial/vision/MediaPipeVisionProvider.ts`, `packages/spatial/src/gestures/recognizer.ts`, `packages/spatial/src/index.ts`, `tests/unit/spatial-recognizer.test.ts`.

**Interfaces:** `recognizeGesture(frame,previous,mode)`, `StableGestureRecognizer.push(frame,targetId,mode)`, `pointerFromFrame(frame)`, `MediaPipeVisionProvider.setMaxFps()`.

- [ ] **Step 1: Write deterministic failing tests for pinch, point, palm, grab, swipe, two-hand zoom, hold-pinch, cursor and cooldown**

```ts
// tests/unit/spatial-recognizer.test.ts
import { describe,expect,it } from 'vitest'; import { StableGestureRecognizer,pointerFromFrame,recognizeGesture,type HandFrame } from '../../packages/spatial/src';
const p=(x:number,y:number,z=0)=>({x,y,z}); const blank=()=>Array.from({length:21},()=>p(.5,.5));
function one(timestamp:number,configure:(lm:any[])=>void):HandFrame{const lm=blank();lm[0]=p(.5,.8);configure(lm);return{timestamp,hands:[{landmarks:lm,handedness:'right',confidence:.95}]}}
const pinch=(t:number)=>one(t,l=>{l[4]=p(.5,.4);l[8]=p(.52,.4)});
const point=(t:number)=>one(t,l=>{l[8]=p(.5,.2);l[6]=p(.5,.45);l[12]=p(.5,.7);l[10]=p(.5,.55);l[16]=p(.5,.7);l[14]=p(.5,.55);l[20]=p(.5,.7);l[18]=p(.5,.55)});
const palm=(t:number)=>one(t,l=>{for(const [tip,pip,x] of [[8,6,.35],[12,10,.45],[16,14,.55],[20,18,.65]] as const){l[tip]=p(x,.2);l[pip]=p(x,.5)}l[4]=p(.2,.45);l[5]=p(.4,.5)});
const grab=(t:number)=>one(t,l=>{for(const [tip,pip] of [[8,6],[12,10],[16,14],[20,18]] as const){l[tip]=p(.5,.68);l[pip]=p(.5,.5)}l[4]=p(.48,.62)});
function two(t:number,d:number):HandFrame{const a=blank(),b=blank();a[0]=p(.5-d/2,.6);b[0]=p(.5+d/2,.6);return{timestamp:t,hands:[{landmarks:a,handedness:'left',confidence:.95},{landmarks:b,handedness:'right',confidence:.95}]}}
describe('recognizer',()=>{
 it('recognizes approved one-hand gestures',()=>{expect(recognizeGesture(pinch(1),null,'navigate')?.gesture).toBe('pinch');expect(recognizeGesture(point(1),null,'navigate')?.gesture).toBe('point');expect(recognizeGesture(palm(1),null,'navigate')?.gesture).toBe('open-palm');expect(recognizeGesture(grab(1),null,'manipulate')?.gesture).toBe('grab')});
 it('recognizes two-hand spread/pinch from center-distance delta',()=>{expect(recognizeGesture(two(200,.45),two(100,.25),'manipulate')?.gesture).toBe('two-hand-spread');expect(recognizeGesture(two(300,.20),two(200,.45),'manipulate')?.gesture).toBe('two-hand-pinch')});
 it('derives spatial cursor from index fingertip',()=>expect(pointerFromFrame(point(1))).toEqual({x:50,y:20}));
 it('converts a command-mode stable pinch into hold-pinch only after hold time',()=>{const r=new StableGestureRecognizer({stableMs:180,holdMs:600,cooldownMs:350,minConfidence:.8});expect(r.push(pinch(100),'x','command')).toBeNull();expect(r.push(pinch(300),'x','command')).toBeNull();expect(r.push(pinch(750),'x','command')?.gesture).toBe('hold-pinch')});
});
```

- [ ] **Step 2: Confirm RED**

```bash
npm run test:unit -- tests/unit/spatial-recognizer.test.ts
```

- [ ] **Step 3: Implement geometry, motion and all approved gestures**

```ts
// packages/spatial/src/gestures/recognizer.ts
import type { GestureEvent,GestureName,SpatialMode } from '../types'; import type { HandFrame,HandLandmark } from '../vision/types';
const dist=(a:HandLandmark,b:HandLandmark)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z); const center=(f:HandFrame,i=0)=>f.hands[i]?.landmarks[0]||null;
export const pointerFromFrame=(f:HandFrame)=>{const tip=f.hands[0]?.landmarks[8];return tip?{x:Math.round((1-tip.x)*100),y:Math.round(tip.y*100)}:null};
export type RecognizedGesture={gesture:GestureName;confidence:number;handedness:'left'|'right'|'both'|'unknown';velocity:number;motion?:{dx:number;dy:number;dz:number};scaleDelta?:number;cursor?:{x:number;y:number}};
export function recognizeGesture(f:HandFrame,prev:HandFrame|null,mode:SpatialMode):RecognizedGesture|null{
 if(f.hands.length===2&&prev?.hands.length===2){const d=dist(center(f,0)!,center(f,1)!)-dist(center(prev,0)!,center(prev,1)!);if(Math.abs(d)>=.08)return{gesture:d>0?'two-hand-spread':'two-hand-pinch',confidence:Math.min(f.hands[0].confidence,f.hands[1].confidence),handedness:'both',velocity:Math.abs(d),scaleDelta:d}}
 const h=f.hands[0];if(!h||h.confidence<.8)return null;const l=h.landmarks,previous=prev?.hands[0]?.landmarks;const motion=previous?{dx:l[0].x-previous[0].x,dy:l[0].y-previous[0].y,dz:l[0].z-previous[0].z}:undefined;const extended=(tip:number,pip:number)=>dist(l[tip],l[0])>dist(l[pip],l[0]);const folded=(tip:number,pip:number)=>!extended(tip,pip);
 if(dist(l[4],l[8])<=.055)return{gesture:'pinch',confidence:h.confidence,handedness:h.handedness,velocity:motion?Math.hypot(motion.dx,motion.dy):0,motion,cursor:pointerFromFrame(f)||undefined};
 if(mode==='manipulate'&&folded(8,6)&&folded(12,10)&&folded(16,14)&&folded(20,18))return{gesture:'grab',confidence:h.confidence,handedness:h.handedness,velocity:motion?Math.hypot(motion.dx,motion.dy):0,motion};
 if(extended(8,6)&&!extended(12,10)&&!extended(16,14)&&!extended(20,18))return{gesture:'point',confidence:h.confidence,handedness:h.handedness,velocity:0,cursor:pointerFromFrame(f)||undefined};
 if(extended(8,6)&&extended(12,10)&&extended(16,14)&&extended(20,18))return{gesture:'open-palm',confidence:h.confidence,handedness:h.handedness,velocity:0};
 if(motion&&Math.abs(motion.dx)>=.12&&Math.abs(motion.dy)<=.06)return{gesture:motion.dx>0?'swipe-right':'swipe-left',confidence:h.confidence,handedness:h.handedness,velocity:Math.abs(motion.dx),motion};
 return null;
}
export class StableGestureRecognizer{private candidate:{v:RecognizedGesture;startedAt:number;targetId:string|null;mode:SpatialMode}|null=null;private prev:HandFrame|null=null;private lastEmit=-Infinity;constructor(private c:{stableMs:number;holdMs:number;cooldownMs:number;minConfidence:number}){}push(f:HandFrame,targetId:string|null,mode:SpatialMode):GestureEvent|null{const v=recognizeGesture(f,this.prev,mode);this.prev=f;if(!v||v.confidence<this.c.minConfidence){this.candidate=null;return null}if(!this.candidate||this.candidate.v.gesture!==v.gesture||this.candidate.targetId!==targetId||this.candidate.mode!==mode){this.candidate={v,startedAt:f.timestamp,targetId,mode};return null}const commandHold=mode==='command'&&v.gesture==='pinch';const required=commandHold?this.c.holdMs:this.c.stableMs;if(f.timestamp-this.candidate.startedAt<required||f.timestamp-this.lastEmit<this.c.cooldownMs)return null;this.lastEmit=f.timestamp;return{eventId:`gesture-${f.timestamp}`,sessionId:'pending',gesture:commandHold?'hold-pinch':v.gesture,confidence:v.confidence,startedAt:this.candidate.startedAt,endedAt:f.timestamp,handedness:v.handedness,targetId,mode,state:'candidate',velocity:v.velocity,motion:v.motion,scaleDelta:v.scaleDelta,cursor:v.cursor}}}
```

Confirmation rule: once the command state machine is `armed`, a **second stable pinch** is converted by the controller to `{type:'confirm'}`; no separate unsafe gesture classifier is needed.

- [ ] **Step 4: Implement adaptive MediaPipe provider**

```ts
// apps/web/src/modules/spatial/vision/MediaPipeVisionProvider.ts
import type { HandFrame,VisionProvider } from '../../../../../../packages/spatial/src';
export class MediaPipeVisionProvider implements VisionProvider{private landmarker:any=null;private raf=0;private stopped=true;private maxFps=30;private lastDetect=0;setMaxFps(v:number){this.maxFps=Math.max(5,Math.min(30,v))}async start(video:HTMLVideoElement,onFrame:(f:HandFrame)=>void){const {FilesetResolver,HandLandmarker}=await import('@mediapipe/tasks-vision');const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm');const base:any={baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'GPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.7,minHandPresenceConfidence:.7,minTrackingConfidence:.7};try{this.landmarker=await HandLandmarker.createFromOptions(vision,base)}catch{this.landmarker=await HandLandmarker.createFromOptions(vision,{...base,baseOptions:{...base.baseOptions,delegate:'CPU'}})}this.stopped=false;const loop=(now:number)=>{if(this.stopped)return;if(!document.hidden&&now-this.lastDetect>=1000/this.maxFps){this.lastDetect=now;const r=this.landmarker.detectForVideo(video,now);const hands=(r.landmarks||[]).map((lm:any[],i:number)=>({landmarks:lm.map((v:any)=>({x:v.x,y:v.y,z:v.z})),handedness:String(r.handedness?.[i]?.[0]?.categoryName||'unknown').toLowerCase(),confidence:Number(r.handedness?.[i]?.[0]?.score||0)}));onFrame({timestamp:now,hands})}this.raf=requestAnimationFrame(loop)};this.raf=requestAnimationFrame(loop)}async stop(){this.stopped=true;cancelAnimationFrame(this.raf);this.landmarker?.close?.();this.landmarker=null}}
```

- [ ] **Step 5: Export, verify, commit**

```ts
// packages/spatial/src/index.ts addition
export * from './gestures/recognizer';
```

```bash
npm run test:unit -- tests/unit/spatial-recognizer.test.ts tests/unit/spatial-vision.test.ts
npm run typecheck
git add apps/web/src/modules/spatial/vision packages/spatial/src tests/unit/spatial-recognizer.test.ts
git commit -m "feat: recognize complete ATLAS gesture vocabulary"
```

---

### Task 5: Implement renderer-independent scene state and procedural 3D manipulation

**Files:** `apps/web/package.json`, `package-lock.json`, `packages/spatial/src/scene/reducer.ts`, `packages/spatial/src/index.ts`, `apps/web/src/modules/spatial/scene/SpatialCanvas.tsx`, `apps/web/src/modules/spatial/scene/ProceduralHumanoid.tsx`, `tests/unit/spatial-scene.test.ts`.

**Interfaces:** `createInitialSceneState`, `sceneReducer`, `SpatialCanvas({state,onTargetFocus,compatible})`.

- [ ] **Step 1: Write failing scene tests and install renderer**

```ts
// tests/unit/spatial-scene.test.ts
import { expect,it } from 'vitest'; import { createInitialSceneState,sceneReducer } from '../../packages/spatial/src';
it('clamps transform/zoom',()=>{let s=createInitialSceneState();s=sceneReducer(s,{type:'rotate',objectId:'human',delta:{x:9,y:-9}});s=sceneReducer(s,{type:'translate',objectId:'human',delta:{x:9,y:9,z:9}});s=sceneReducer(s,{type:'zoom',delta:99});expect(s.objects.human.rotation.x).toBe(Math.PI);expect(s.objects.human.position.x).toBe(2);expect(s.camera.zoom).toBe(2.5)});
it('isolation preserves registry',()=>{const s=sceneReducer(createInitialSceneState(),{type:'isolate',objectId:'torso'});expect(s.isolatedObjectId).toBe('torso');expect(s.objects.head).toBeDefined()});
```

```bash
npm run test:unit -- tests/unit/spatial-scene.test.ts
npm install --workspace apps/web three @react-three/fiber
```

- [ ] **Step 2: Implement scene reducer**

```ts
// packages/spatial/src/scene/reducer.ts
export type V3={x:number;y:number;z:number};export type SpatialObjectState={id:string;position:V3;rotation:V3;visible:boolean};export type SpatialSceneState={objects:Record<string,SpatialObjectState>;selectedObjectId:string|null;isolatedObjectId:string|null;camera:{zoom:number};compatibilityMode:boolean};export type SceneAction={type:'select';objectId:string|null}|{type:'rotate';objectId:string;delta:{x:number;y:number}}|{type:'translate';objectId:string;delta:V3}|{type:'zoom';delta:number}|{type:'isolate';objectId:string|null}|{type:'reset'}|{type:'setCompatibilityMode';value:boolean};const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));const ids=['human','head','torso','left-arm','right-arm','left-leg','right-leg'];export function createInitialSceneState():SpatialSceneState{const objects=Object.fromEntries(ids.map(id=>[id,{id,position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},visible:true}]));return{objects,selectedObjectId:'human',isolatedObjectId:null,camera:{zoom:1},compatibilityMode:false}}export function sceneReducer(s:SpatialSceneState,a:SceneAction):SpatialSceneState{if(a.type==='reset')return createInitialSceneState();if(a.type==='select')return{...s,selectedObjectId:a.objectId};if(a.type==='isolate')return{...s,isolatedObjectId:a.objectId};if(a.type==='setCompatibilityMode')return{...s,compatibilityMode:a.value};if(a.type==='zoom')return{...s,camera:{zoom:clamp(s.camera.zoom+a.delta,.6,2.5)}};const o='objectId'in a?s.objects[a.objectId]:undefined;if(!o)return s;if(a.type==='rotate')return{...s,objects:{...s.objects,[o.id]:{...o,rotation:{...o.rotation,x:clamp(o.rotation.x+a.delta.x,-Math.PI,Math.PI),y:clamp(o.rotation.y+a.delta.y,-Math.PI,Math.PI)}}}};if(a.type==='translate')return{...s,objects:{...s.objects,[o.id]:{...o,position:{x:clamp(o.position.x+a.delta.x,-2,2),y:clamp(o.position.y+a.delta.y,-2,2),z:clamp(o.position.z+a.delta.z,-2,2)}}}};return s}
```

- [ ] **Step 3: Implement procedural scene that consumes state**

```tsx
// apps/web/src/modules/spatial/scene/ProceduralHumanoid.tsx
import type { SpatialSceneState } from '../../../../../../packages/spatial/src';
const placements:Record<string,[number,number,number]>={head:[0,1.8,0],torso:[0,.8,0],'left-arm':[-.75,.8,0],'right-arm':[.75,.8,0],'left-leg':[-.28,-.65,0],'right-leg':[.28,-.65,0]};
export function ProceduralHumanoid({state,onTargetFocus}:{state:SpatialSceneState;onTargetFocus:(id:string)=>void}){return <group>{Object.entries(placements).map(([id,pos])=>{const o=state.objects[id];if(state.isolatedObjectId&&state.isolatedObjectId!==id)return null;return <mesh key={id} position={[pos[0]+o.position.x,pos[1]+o.position.y,pos[2]+o.position.z]} rotation={[o.rotation.x,o.rotation.y,o.rotation.z]} onPointerDown={()=>onTargetFocus(id)} userData={{spatialTargetId:id}}><sphereGeometry args={[id==='torso'?.62:.3,24,24]}/><meshStandardMaterial roughness={.45} metalness={.25}/></mesh>})}</group>}
```

```tsx
// apps/web/src/modules/spatial/scene/SpatialCanvas.tsx
import { Canvas } from '@react-three/fiber'; import type { SpatialSceneState } from '../../../../../../packages/spatial/src'; import { ProceduralHumanoid } from './ProceduralHumanoid';
export function SpatialCanvas({state,onTargetFocus,compatible}:{state:SpatialSceneState;onTargetFocus:(id:string)=>void;compatible:boolean}){if(!compatible)return <div role="img" aria-label="ATLAS spatial model 2D fallback">Compatibility Mode — use object controls to inspect and manipulate the model.</div>;return <div style={{transform:`scale(${state.camera.zoom})`}}><Canvas aria-hidden="true"><ambientLight intensity={1.2}/><directionalLight position={[3,4,5]} intensity={2}/><ProceduralHumanoid state={state} onTargetFocus={onTargetFocus}/></Canvas></div>}
```

- [ ] **Step 4: Export, verify, build, commit**

```ts
// packages/spatial/src/index.ts addition
export * from './scene/reducer';
```

```bash
npm run test:unit -- tests/unit/spatial-scene.test.ts
npm run typecheck
npm run build
git add apps/web/package.json package-lock.json packages/spatial/src/scene packages/spatial/src/index.ts apps/web/src/modules/spatial/scene tests/unit/spatial-scene.test.ts
git commit -m "feat: add interactive ATLAS spatial scene"
```

---

### Task 6: Implement multimodal intent, router and truthful integration readiness

**Files:** `packages/spatial/src/commands/multimodal.ts`, `packages/spatial/src/commands/router.ts`, `packages/spatial/src/integrations/registry.ts`, `packages/spatial/src/index.ts`, `tests/unit/spatial-multimodal.test.ts`, `tests/unit/spatial-router.test.ts`.

**Interfaces:** `VoiceIntent`, `ResolvedIntent`, `resolveMultimodalIntent`, `routeSpatialCommand`, `defaultSpatialIntegrations`.

- [ ] **Step 1: Write failing tests with concrete inputs**

```ts
// tests/unit/spatial-multimodal.test.ts
import { expect,it } from 'vitest'; import { resolveMultimodalIntent } from '../../packages/spatial/src';
const gesture={eventId:'g',sessionId:'s',gesture:'point' as const,confidence:.95,startedAt:1,endedAt:2,handedness:'right' as const,targetId:'invoice-1',mode:'navigate' as const,state:'confirmed' as const,velocity:0};
it('rejects contradictory voice/gesture targets',()=>expect(resolveMultimodalIntent({gesture,voice:{id:'v',action:'open',targetId:'employee-9'},activeTarget:{id:'invoice-1',type:'record',label:'Invoice',ownerModule:'finance'}}).status).toBe('ambiguous'));
```

```ts
// tests/unit/spatial-router.test.ts
import { expect,it } from 'vitest'; import { routeSpatialCommand } from '../../packages/spatial/src';
it('routes visual and sensitive intent to correct risk',()=>{expect(routeSpatialCommand({status:'resolved',action:'rotate',target:{id:'human',type:'scene-object',label:'Human'},source:'gesture'},{sessionId:'s'}).riskTier).toBe(0);expect(routeSpatialCommand({status:'resolved',action:'finance.write.memo',target:{id:'bill',type:'record',label:'Bill',ownerModule:'finance'},source:'gesture'},{sessionId:'s'}).riskTier).toBe(3)});
```

- [ ] **Step 2: Confirm RED**

```bash
npm run test:unit -- tests/unit/spatial-multimodal.test.ts tests/unit/spatial-router.test.ts
```

- [ ] **Step 3: Implement resolver/router**

```ts
// packages/spatial/src/commands/multimodal.ts
import type { GestureEvent,SpatialInputModality,SpatialTarget } from '../types';export type VoiceIntent={id:string;action:string;targetId:string|null};export type ResolvedIntent={status:'ambiguous';reason:string}|{status:'resolved';action:string;target:SpatialTarget;source:SpatialInputModality;gesture?:GestureEvent;voice?:VoiceIntent};export function resolveMultimodalIntent({gesture,voice,activeTarget}:{gesture:GestureEvent|null;voice:VoiceIntent|null;activeTarget:SpatialTarget|null}):ResolvedIntent{const gTarget=gesture?.targetId||activeTarget?.id||null;if(voice?.targetId&&gTarget&&voice.targetId!==gTarget)return{status:'ambiguous',reason:'target_conflict'};if(!activeTarget)return{status:'ambiguous',reason:'target_missing'};const action=voice?.action||(gesture?.gesture==='swipe-left'?'back':gesture?.gesture==='swipe-right'||gesture?.gesture==='pinch'?'open':'focus');return{status:'resolved',action,target:activeTarget,source:voice&&gesture?'gesture+voice':voice?'voice':'gesture',gesture:gesture||undefined,voice:voice||undefined}}
```

```ts
// packages/spatial/src/commands/router.ts
import { classifySpatialRisk,confirmationForRisk } from '../policy'; import type { SpatialCommand } from '../types'; import type { ResolvedIntent } from './multimodal';export function routeSpatialCommand(i:Extract<ResolvedIntent,{status:'resolved'}>,ctx:{sessionId:string}):SpatialCommand{const r=classifySpatialRisk(i.action,i.target);return{commandId:`${ctx.sessionId}:${i.target.id}:${i.action}`,sessionId:ctx.sessionId,source:i.source,sourceGesture:i.gesture,voiceIntentId:i.voice?.id,target:i.target,action:i.action,requiredPermission:r<=1?'spatial.use':'spatial.command',riskTier:r,confirmationPolicy:confirmationForRisk(r),status:'requested'}}
```

- [ ] **Step 4: Implement truthful integrations**

```ts
// packages/spatial/src/integrations/registry.ts
import type { IntegrationReadiness } from '../types';const off=(integration:IntegrationReadiness['integration'],blocker:string):IntegrationReadiness=>({integration,state:'not_configured',blocker,checkedAt:new Date().toISOString()});export function defaultSpatialIntegrations(){return{voice:off('voice','voice_intent_adapter_not_configured'),automations:off('automations','automation_adapter_not_configured'),connect:off('connect','device_adapter_not_configured'),health:off('health','health_data_adapter_not_configured')}}
```

- [ ] **Step 5: Export, verify, commit**

```ts
// packages/spatial/src/index.ts additions
export * from './commands/multimodal'; export * from './commands/router'; export * from './integrations/registry';
```

```bash
npm run test:unit -- tests/unit/spatial-multimodal.test.ts tests/unit/spatial-router.test.ts
npm run typecheck
git add packages/spatial/src tests/unit/spatial-multimodal.test.ts tests/unit/spatial-router.test.ts
git commit -m "feat: route multimodal spatial intent safely"
```

---

### Task 7: Add authoritative Supabase authorization and shared audit

**Files:** `supabase/functions/atlas-spatial-command/_shared/{context,policy,repository,errors}.ts`, `supabase/functions/atlas-spatial-command/index.ts`, `apps/web/src/lib/atlasSession.ts`, `apps/web/src/modules/spatial/lib/spatialApi.ts`, `tests/integration/spatial-edge-contract.test.ts`, `tests/integration/spatial-security-contract.test.ts`.

**Interfaces:** `GET ?api=capabilities`, `POST ?api=authorize`, `GET ?api=audit`; authorize records decision but never executes owner-module action.

- [ ] **Step 1: Write failing security/source tests**

```ts
// tests/integration/spatial-edge-contract.test.ts
import { readFileSync } from 'node:fs';import { expect,it } from 'vitest';const c=readFileSync('supabase/functions/atlas-spatial-command/_shared/context.ts','utf8');const r=readFileSync('supabase/functions/atlas-spatial-command/_shared/repository.ts','utf8');it('derives session/org from Supabase',()=>{expect(c).toContain('auth.getUser');expect(c).toContain("from('organization_members')")});it('reuses audit_logs',()=>{expect(r).toContain("from('audit_logs')");expect(r).toContain('atlas_spatial_command')});
```

```ts
// tests/integration/spatial-security-contract.test.ts
import { readFileSync } from 'node:fs';import { expect,it } from 'vitest';const p=readFileSync('supabase/functions/atlas-spatial-command/_shared/policy.ts','utf8');it('fails closed for Tier 3/4',()=>{expect(p).toContain('owner_authorization_required');expect(p).toContain("command.source === 'gesture'")});
```

- [ ] **Step 2: Confirm RED**

```bash
npm run test:integration -- tests/integration/spatial-edge-contract.test.ts tests/integration/spatial-security-contract.test.ts
```

- [ ] **Step 3: Implement server context and policy**

```ts
// _shared/context.ts
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';import type { SpatialPermission } from '../../../../packages/spatial/src/types.ts';const URL=Deno.env.get('SUPABASE_URL')||'';const KEY=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY')||'';const perms=(role:string):SpatialPermission[]=>['owner','admin','platform_admin'].includes(role)?['spatial.read','spatial.use','spatial.command','spatial.audit','spatial.admin']:['spatial.read','spatial.use'];export async function resolveSpatialContext(req:Request){if(!URL||!KEY)throw new Error('supabase_runtime_not_configured');const auth=req.headers.get('authorization')||'';const token=auth.replace(/^Bearer\s+/i,'');if(!token)throw new Error('authentication_required');const sb=createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:auth}}});const {data,error}=await sb.auth.getUser(token);if(error||!data.user)throw new Error('invalid_session');const {data:m,error:me}=await sb.from('organization_members').select('org_id,role,status').eq('user_id',data.user.id).eq('status','active').limit(1);if(me||!m?.[0]?.org_id)throw new Error('active_organization_required');const role=String(m[0].role||'member');return{sb,userId:data.user.id,orgId:String(m[0].org_id),role,permissions:perms(role)}}
```

```ts
// _shared/policy.ts
import { classifySpatialRisk } from '../../../../packages/spatial/src/policy.ts';import type { SpatialCommand,SpatialPermission } from '../../../../packages/spatial/src/types.ts';export function authorizeSpatialCommand(ctx:{permissions:SpatialPermission[]},command:SpatialCommand,confirmationMethod:string){const riskTier=classifySpatialRisk(command.action,command.target);const has=(p:SpatialPermission)=>ctx.permissions.includes(p)||ctx.permissions.includes('spatial.admin');if(riskTier<=1)return{allowed:has('spatial.use'),reason:has('spatial.use')?'authorized':'permission_denied',riskTier};if(riskTier===2)return{allowed:has('spatial.command')&&confirmationMethod!=='none',reason:has('spatial.command')&&confirmationMethod!=='none'?'authorized':'confirmation_or_permission_required',riskTier};if(riskTier===4&&command.source==='gesture')return{allowed:false,reason:'owner_authorization_required',riskTier};return{allowed:false,reason:'owner_authorization_required',riskTier}}
```

- [ ] **Step 4: Implement audit repository; audit failure prevents successful authorization response**

```ts
// _shared/repository.ts
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';const URL=Deno.env.get('SUPABASE_URL')||'';const SECRET=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';const admin=()=>{if(!SECRET)throw new Error('server_secret_not_configured');return createClient(URL,SECRET,{auth:{persistSession:false,autoRefreshToken:false}})};export async function writeSpatialAudit(orgId:string,userId:string,command:any,decision:any,confirmationMethod:string){const {data,error}=await admin().from('audit_logs').insert({org_id:orgId,user_id:userId,action:`spatial.command.${decision.allowed?'authorized':'denied'}`,table_name:'atlas_spatial_command',record_id:command.commandId,new_data:{session_id:command.sessionId,source_modality:command.source,gesture_id:command.sourceGesture?.eventId??null,voice_intent_id:command.voiceIntentId??null,target_type:command.target.type,target_id:command.target.id,requested_action:command.action,risk_tier:decision.riskTier,permission_decision:decision.allowed,confirmation_method:confirmationMethod,reason:decision.reason,correlation_id:command.commandId}}).select('id').single();if(error)throw error;return String(data.id)}export async function listSpatialAudit(orgId:string){const {data,error}=await admin().from('audit_logs').select('id,org_id,user_id,action,record_id,new_data,created_at').eq('org_id',orgId).eq('table_name','atlas_spatial_command').order('created_at',{ascending:false}).limit(100);if(error)throw error;return data||[]}
```

- [ ] **Step 5: Implement CORS/errors and thin router**

```ts
// _shared/errors.ts
const headers=(origin:string|null)=>({'content-type':'application/json','access-control-allow-origin':origin||'*','access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'GET,POST,OPTIONS'});export const json=(body:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(body),{status,headers:headers(origin)});export const optionsResponse=(origin:string|null)=>new Response(null,{status:204,headers:headers(origin)});export const errorResponse=(e:unknown,origin:string|null)=>{const m=e instanceof Error?e.message:'unknown_error';const safe=['authentication_required','invalid_session','active_organization_required','supabase_runtime_not_configured','server_secret_not_configured','not_found','method_not_allowed','invalid_json'].includes(m)?m:'spatial_request_failed';return json({ok:false,error:safe},safe==='authentication_required'||safe==='invalid_session'?401:safe==='not_found'?404:500,origin)};
```

```ts
// index.ts
import type { SpatialCommand } from '../../../packages/spatial/src/types.ts';import { resolveSpatialContext } from './_shared/context.ts';import { authorizeSpatialCommand } from './_shared/policy.ts';import { listSpatialAudit,writeSpatialAudit } from './_shared/repository.ts';import { errorResponse,json,optionsResponse } from './_shared/errors.ts';
Deno.serve(async(req)=>{const origin=req.headers.get('origin');if(req.method==='OPTIONS')return optionsResponse(origin);try{const url=new URL(req.url);const api=url.searchParams.get('api');const ctx=await resolveSpatialContext(req);const has=(p:string)=>ctx.permissions.includes(p as any)||ctx.permissions.includes('spatial.admin');if(api==='capabilities'&&req.method==='GET'){if(!has('spatial.read'))throw new Error('forbidden');return json({ok:true,organization_id:ctx.orgId,role:ctx.role,permissions:ctx.permissions},200,origin)}if(api==='audit'&&req.method==='GET'){if(!has('spatial.audit'))throw new Error('forbidden');return json({ok:true,audit:await listSpatialAudit(ctx.orgId)},200,origin)}if(api==='authorize'&&req.method==='POST'){const body=await req.json();const command=body?.command as SpatialCommand;if(!command?.commandId||!command?.target?.id)throw new Error('invalid_json');const decision=authorizeSpatialCommand(ctx,command,String(body?.confirmation_method||'none'));const auditReference=await writeSpatialAudit(ctx.orgId,ctx.userId,command,decision,String(body?.confirmation_method||'none'));return json({ok:true,decision:{...decision,auditReference}},200,origin)}throw new Error('not_found')}catch(e){return errorResponse(e,origin)}});
```

- [ ] **Step 6: Reuse existing authenticated fetch/refresh path**

```ts
// apps/web/src/lib/atlasSession.ts addition
export async function atlasAuthorizedFetch(path:string,init:RequestInit={}){return authorizedFetch(path,init)}
```

```ts
// apps/web/src/modules/spatial/lib/spatialApi.ts
import { atlasAuthorizedFetch } from '../../../lib/atlasSession';import type { SpatialCommand } from '../../../../../../packages/spatial/src';const parse=async(r:Response)=>{const b=await r.json();if(!r.ok)throw new Error(b?.error||`spatial_request_${r.status}`);return b};export const getSpatialCapabilities=()=>atlasAuthorizedFetch('/functions/v1/atlas-spatial-command?api=capabilities').then(parse);export const getSpatialAudit=()=>atlasAuthorizedFetch('/functions/v1/atlas-spatial-command?api=audit').then(parse);export const authorizeSpatialCommand=(command:SpatialCommand,confirmation_method:string)=>atlasAuthorizedFetch('/functions/v1/atlas-spatial-command?api=authorize',{method:'POST',body:JSON.stringify({command,confirmation_method})}).then(parse);
```

- [ ] **Step 7: Verify and commit**

```bash
npm run test:integration -- tests/integration/spatial-edge-contract.test.ts tests/integration/spatial-security-contract.test.ts
npm run typecheck
git add supabase/functions/atlas-spatial-command apps/web/src/lib/atlasSession.ts apps/web/src/modules/spatial/lib/spatialApi.ts tests/integration/spatial-edge-contract.test.ts tests/integration/spatial-security-contract.test.ts
git commit -m "feat: authorize and audit spatial commands server-side"
```

---

### Task 8: Register identity-gated routes, capability detection and truthful support pages

**Files:** `apps/web/src/modules/spatial/SpatialRoutes.tsx`, `SpatialOverviewPage.tsx`, `SpatialSupportPages.tsx`, `components/SpatialNav.tsx`, `lib/browserCapabilities.ts`, `lib/preferences.ts`, `spatial.css`, modify `apps/web/src/App.tsx`, `AtlasShell.tsx`, test `tests/integration/spatial-routes.test.tsx`.

- [ ] **Step 1: Write failing route and capability UI tests**

```tsx
// tests/integration/spatial-routes.test.tsx
import { render,screen } from '@testing-library/react';import { MemoryRouter } from 'react-router-dom';import { expect,it } from 'vitest';import { App } from '../../apps/web/src/App';
it('keeps Spatial identity-gated',()=>{render(<MemoryRouter initialEntries={['/spatial/workspace']}><App/></MemoryRouter>);expect(screen.getByRole('heading',{name:'ATLAS Identity'})).toBeInTheDocument();expect(screen.getByText('/spatial/workspace')).toBeInTheDocument()});
```

- [ ] **Step 2: Confirm RED**

```bash
npm run test:integration -- tests/integration/spatial-routes.test.tsx
```

- [ ] **Step 3: Implement browser capability measurement**

```ts
// lib/browserCapabilities.ts
import { deriveCapabilityMode,type SpatialDeviceCapabilities } from '../../../../../../packages/spatial/src';export function detectBrowserCapabilities(){const canvas=document.createElement('canvas');const webgl=Boolean(canvas.getContext('webgl2')||canvas.getContext('webgl'));const c:SpatialDeviceCapabilities={webgl,camera:Boolean(navigator.mediaDevices?.getUserMedia),microphone:Boolean(navigator.mediaDevices?.getUserMedia),reducedMotion:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false,hardwareConcurrency:navigator.hardwareConcurrency||2};return{capabilities:c,mode:deriveCapabilityMode(c),visionFps:deriveCapabilityMode(c)==='optimal'?30:15}}
```

- [ ] **Step 4: Implement device-only preference store**

```ts
// lib/preferences.ts
const KEY='atlas_spatial_preferences_v1';export type SpatialPreferences={reducedMotion:boolean;cameraMirrored:boolean;gestureSensitivity:'low'|'standard'|'high';manipulationTool:'move'|'rotate'};const defaults:SpatialPreferences={reducedMotion:false,cameraMirrored:true,gestureSensitivity:'standard',manipulationTool:'move'};export const loadSpatialPreferences=()=>{try{return{...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')} as SpatialPreferences}catch{return defaults}};export const saveSpatialPreferences=(v:SpatialPreferences)=>localStorage.setItem(KEY,JSON.stringify(v));
```

- [ ] **Step 5: Implement all approved routes**

```tsx
// SpatialRoutes.tsx
import { Navigate,Route,Routes } from 'react-router-dom';import { SpatialOverviewPage } from './SpatialOverviewPage';import { SpatialWorkspacePage } from './SpatialWorkspacePage';import { CalibrationPage,GesturesPage,CommandsPage,DigitalTwinPage,AutomationsPage,IntegrationsPage,SessionsPage,PermissionsPage,SettingsPage } from './SpatialSupportPages';export function SpatialRoutes(){return <Routes><Route index element={<SpatialOverviewPage/>}/><Route path="workspace" element={<SpatialWorkspacePage/>}/><Route path="calibration" element={<CalibrationPage/>}/><Route path="gestures" element={<GesturesPage/>}/><Route path="commands" element={<CommandsPage/>}/><Route path="digital-twin" element={<DigitalTwinPage/>}/><Route path="automations" element={<AutomationsPage/>}/><Route path="integrations" element={<IntegrationsPage/>}/><Route path="sessions" element={<SessionsPage/>}/><Route path="permissions" element={<PermissionsPage/>}/><Route path="settings" element={<SettingsPage/>}/><Route path="*" element={<Navigate to="/spatial" replace/>}/></Routes>}
```

In current `App.tsx` import `SpatialRoutes` and add only:

```tsx
<Route path="/spatial/*" element={<RequireAtlasIdentity><SpatialRoutes/></RequireAtlasIdentity>} />
```

In current `AtlasShell.tsx` add only:

```ts
{to:'/spatial',label:'Spatial'}
```

- [ ] **Step 6: Implement support pages from real contracts**

`SpatialOverviewPage` displays measured mode (`Optimal`, `Reduced`, `Compatibility`) from `detectBrowserCapabilities()`, plus links to all subroutes.

`SpatialSupportPages.tsx` uses these exact sources:
- Calibration → `detectBrowserCapabilities()` plus camera state explanation; no auto camera start.
- Gestures → exported `GESTURE_DEFINITIONS` from Task 4.
- Commands → risk tier table using `confirmationForRisk`.
- Digital Twin → `No Health data attached` unless `defaultSpatialIntegrations().health.state === 'ready'`.
- Automations/Integrations → `defaultSpatialIntegrations()`; no fake readiness.
- Sessions → current in-memory session summary supplied by workspace context if present plus `getSpatialAudit()` governed history; show loading/empty/error truthfully.
- Permissions → `getSpatialCapabilities()`; display server role/permissions only.
- Settings → `loadSpatialPreferences()`/`saveSpatialPreferences()` and visible text `Stored on this device`.
- Command strip/mic status in later workspace must show `Microphone OFF · Voice not configured` unless a real Voice adapter becomes ready.

- [ ] **Step 7: Add SpatialNav and responsive/reduced-motion CSS, verify and commit**

`SpatialNav` uses `NavLink` for every route; no `href="#"`.

```css
.spatial-layout{display:grid;grid-template-columns:minmax(13rem,18rem) minmax(0,1fr);gap:1rem}.spatial-workspace{display:grid;grid-template-columns:minmax(13rem,18rem) minmax(0,1fr) minmax(15rem,20rem);grid-template-rows:minmax(32rem,1fr) auto;gap:1rem}.spatial-command-strip{grid-column:1/-1}.spatial-layout :focus-visible,.spatial-workspace :focus-visible{outline:2px solid currentColor;outline-offset:3px}@media(max-width:900px){.spatial-layout,.spatial-workspace{grid-template-columns:1fr;grid-template-rows:auto}.spatial-command-strip{grid-column:1}}@media(prefers-reduced-motion:reduce){.spatial-layout *, .spatial-workspace *{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
```

```bash
npm run test:integration -- tests/integration/spatial-routes.test.tsx
npm run typecheck
npm run build
git add apps/web/src/App.tsx apps/web/src/components/AtlasShell.tsx apps/web/src/modules/spatial tests/integration/spatial-routes.test.tsx
git commit -m "feat: register ATLAS Spatial routes and capability states"
```

---

### Task 9: Compose Live Workspace, all gesture→scene mappings, Privacy Lock and non-gesture equivalents

**Files:** `SpatialWorkspacePage.tsx`, `components/{CameraPanel,ObjectTree,ContextPanel,CommandStrip}.tsx`, `hooks/useSpatialController.ts`, `spatial.css`, `tests/integration/spatial-workspace.test.tsx`.

**Interfaces:** `SpatialWorkspacePage({visionProvider?})`; `useSpatialController(provider,capabilityMode,preferences)` is the only composition root.

- [ ] **Step 1: Write failing workspace tests**

```tsx
// tests/integration/spatial-workspace.test.tsx
import { render,screen } from '@testing-library/react';import userEvent from '@testing-library/user-event';import { expect,it,vi } from 'vitest';import { FakeVisionProvider } from '../../packages/spatial/src';import { SpatialWorkspacePage } from '../../apps/web/src/modules/spatial/SpatialWorkspacePage';
it('never auto starts camera',async()=>{const stop=vi.fn();const gum=vi.fn().mockResolvedValue({getTracks:()=>[{stop,onended:null}]});Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:gum},configurable:true});render(<SpatialWorkspacePage visionProvider={new FakeVisionProvider()}/>);expect(gum).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Start camera'})).toBeInTheDocument()});
it('offers keyboard/pointer equivalents',()=>{render(<SpatialWorkspacePage visionProvider={new FakeVisionProvider()}/>);expect(screen.getByRole('tree',{name:'Spatial objects'})).toBeInTheDocument();for(const name of ['Move','Rotate','Zoom in','Zoom out','Isolate','Reset','Pause spatial controls'])expect(screen.getByRole('button',{name})).toBeInTheDocument()});
it('Privacy mode locks controls and stops camera tracks',async()=>{const stop=vi.fn();const gum=vi.fn().mockResolvedValue({getTracks:()=>[{stop,onended:null}]});Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:gum},configurable:true});render(<SpatialWorkspacePage visionProvider={new FakeVisionProvider()}/>);await userEvent.click(screen.getByRole('button',{name:'Start camera'}));await userEvent.click(screen.getByRole('button',{name:'Privacy mode'}));expect(stop).toHaveBeenCalled();expect(screen.getByText('Spatial controls locked')).toBeInTheDocument()});
```

- [ ] **Step 2: Confirm RED**

```bash
npm run test:integration -- tests/integration/spatial-workspace.test.tsx
```

- [ ] **Step 3: Implement controller with session, capability FPS, cursor, blur/visibility cancellation and Privacy Lock**

```ts
// hooks/useSpatialController.ts
import { useEffect,useMemo,useReducer,useRef,useState } from 'react';import { StableGestureRecognizer,createInitialSceneState,initialGestureMachineState,advanceGestureState,cancelGestureState,sceneReducer,type SpatialCapabilityMode,type SpatialMode,type VisionProvider } from '../../../../../../packages/spatial/src';import type { SpatialPreferences } from '../lib/preferences';import { useSpatialVision } from './useSpatialVision';
export function useSpatialController(provider:VisionProvider,modeCapability:SpatialCapabilityMode,prefs:SpatialPreferences){const vision=useSpatialVision(provider);const sessionId=useRef(crypto.randomUUID()).current;const [mode,setMode]=useState<SpatialMode>('navigate');const [paused,setPaused]=useState(false);const [locked,setLocked]=useState(false);const [targetId,setTargetId]=useState<string|null>('human');const [scene,dispatch]=useReducer(sceneReducer,undefined,createInitialSceneState);const [machine,setMachine]=useState(initialGestureMachineState);const [gesture,setGesture]=useState<any>(null);const [cursor,setCursor]=useState<{x:number;y:number}|null>(null);const recognizer=useMemo(()=>new StableGestureRecognizer({stableMs:180,holdMs:600,cooldownMs:350,minConfidence:.8}),[]);useEffect(()=>provider.setMaxFps?.(modeCapability==='optimal'?30:15),[provider,modeCapability]);useEffect(()=>{if(!vision.lastFrame||paused||locked)return;const e=recognizer.push(vision.lastFrame,targetId,mode);if(!e)return;e.sessionId=sessionId;setGesture(e);if(e.cursor)setCursor(e.cursor);if(e.gesture==='open-palm'){setPaused(true);setMachine(s=>cancelGestureState(s,'open_palm'));return}if(e.gesture==='hold-pinch'){setMachine(s=>advanceGestureState(s,{type:'candidate',gesture:'hold-pinch',at:e.startedAt,confidence:e.confidence,targetId:e.targetId}));setMachine(s=>advanceGestureState(s,{type:'stable',at:e.endedAt,confidence:e.confidence,targetId:e.targetId}));return}if(e.gesture==='pinch'&&machine().phase==='armed'){setMachine(s=>advanceGestureState(s,{type:'confirm',at:e.endedAt,confidence:e.confidence,targetId:e.targetId}));return}if(mode==='manipulate'&&e.gesture==='grab'&&e.motion){dispatch(prefs.manipulationTool==='rotate'?{type:'rotate',objectId:targetId||'human',delta:{x:e.motion.dy*4,y:e.motion.dx*4}}:{type:'translate',objectId:targetId||'human',delta:{x:e.motion.dx*2,y:-e.motion.dy*2,z:e.motion.dz*2}})}if(mode==='manipulate'&&e.gesture==='two-hand-spread')dispatch({type:'zoom',delta:.1});if(mode==='manipulate'&&e.gesture==='two-hand-pinch')dispatch({type:'zoom',delta:-.1})},[vision.lastFrame,paused,locked,targetId,mode,recognizer,sessionId,prefs.manipulationTool]);useEffect(()=>{const cancel=(reason:string)=>{setPaused(true);setGesture(null);setCursor(null);setMachine(s=>cancelGestureState(s,reason))};const blur=()=>cancel('browser_blur');const visibility=()=>{if(document.hidden)cancel('visibility_hidden')};window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);return()=>{window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility)}},[]);async function privacyMode(){setLocked(true);setPaused(true);setGesture(null);setCursor(null);setMachine(s=>cancelGestureState(s,'privacy_mode'));await vision.privacyLock()}return{sessionId,vision,mode,setMode,paused,setPaused,locked,setLocked,targetId,setTargetId,scene,dispatch,gesture,cursor,machineState:machine,privacyMode}}
```

Implementation note for the code above: React state is read as `machine`, not called as a function. Before commit, use `machine.phase === 'armed'`; the test must catch any accidental callable-state typo. Keep this note in the task because it is a required code-review check, not a placeholder.

- [ ] **Step 4: Implement workspace four-zone composition and command strip**

`SpatialWorkspacePage` creates the default `MediaPipeVisionProvider` once with `useMemo` when no injected provider is supplied, calls `detectBrowserCapabilities()`, loads device preferences, and renders:
- left `ObjectTree` (`role="tree"`) with `human`, `head`, `torso`, arms, legs;
- center `SpatialCanvas` plus `.spatial-cursor` positioned from `controller.cursor`;
- right `ContextPanel` with buttons `Move`, `Rotate`, `Zoom in`, `Zoom out`, `Isolate`, `Reset` wired to preference/scene reducer;
- bottom `CommandStrip` with exact text for mode, recognized gesture, confidence percentage, camera state, `Microphone OFF`, Voice readiness, pending confirmation, paused/locked state;
- `CameraPanel` with `Start camera`, `Stop camera`, `Privacy mode`.

The cursor style is:

```css
.spatial-cursor{position:absolute;left:calc(var(--cursor-x)*1%);top:calc(var(--cursor-y)*1%);width:1rem;height:1rem;border:2px solid currentColor;border-radius:50%;pointer-events:none;transform:translate(-50%,-50%)}
```

Low-confidence/lost-hand behavior: if `lastFrame` becomes null or contains no hands while a machine state is `candidate`/`armed`, cancel with `tracking_lost`; no command may remain armed.

Only Tier 0 scene transforms and Tier 1 route navigation execute locally. Tier 2 calls `authorizeSpatialCommand()` and treats response success only after audit succeeded server-side. Tier 3/4 are shown as denied/owner authorization required and never invoke owner actions in this milestone.

- [ ] **Step 5: Wire non-gesture equivalents through the same reducer/router**

Buttons use the same scene actions; route links use React Router. `Escape` pauses/cancels pending interaction. Touch/pointer target selection calls `setTargetId`. Changing `Move`/`Rotate` updates `preferences.manipulationTool` and persists with `saveSpatialPreferences()`.

- [ ] **Step 6: Verify all workspace and regression tests**

```bash
npm run test:integration -- tests/integration/spatial-workspace.test.tsx tests/integration/spatial-routes.test.tsx
npm run test:unit -- tests/unit/spatial-types.test.ts tests/unit/spatial-capabilities.test.ts tests/unit/spatial-policy.test.ts tests/unit/spatial-gesture-state.test.ts tests/unit/spatial-vision.test.ts tests/unit/spatial-recognizer.test.ts tests/unit/spatial-scene.test.ts tests/unit/spatial-multimodal.test.ts tests/unit/spatial-router.test.ts
npm run typecheck
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/modules/spatial tests/integration/spatial-workspace.test.tsx
git commit -m "feat: compose governed ATLAS Spatial live workspace"
```

---

### Task 10: Add E2E, CI, accessibility/performance/security evidence gates

**Files:** modify `package.json`, `apps/web/package.json`, `package-lock.json`; create `playwright.config.ts`, `e2e/spatial.spec.ts`, `.github/workflows/atlas-spatial-interface-ci.yml`, `docs/qa/ATLAS_SPATIAL_INTERFACE_READINESS.md`.

- [ ] **Step 1: Install Playwright and add preview/test scripts**

```bash
npm install --save-dev @playwright/test
```

Root `package.json` adds:

```json
"test:e2e":"playwright test"
```

`apps/web/package.json` adds:

```json
"preview":"vite preview"
```

- [ ] **Step 2: Add exact Playwright config**

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';export default defineConfig({testDir:'./e2e',use:{baseURL:'http://127.0.0.1:4173'},webServer:{command:'npm --workspace apps/web run build && npm --workspace apps/web run preview -- --host 127.0.0.1 --port 4173',url:'http://127.0.0.1:4173',reuseExistingServer:false}});
```

- [ ] **Step 3: Write E2E with secret-free identity/server fixtures**

```ts
// e2e/spatial.spec.ts
import { test,expect } from '@playwright/test';
async function authenticate(page:any){await page.addInitScript(()=>localStorage.setItem('atlas_access_token','e2e-token'));await page.route('**/rest/v1/organization_members**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{org_id:'org-e2e',role:'admin',status:'active',organizations:{id:'org-e2e',name:'E2E Org',legal_name:'E2E Org',active:true}}])}));await page.route('**/functions/v1/atlas-spatial-command?api=capabilities',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,organization_id:'org-e2e',role:'admin',permissions:['spatial.read','spatial.use','spatial.command','spatial.audit','spatial.admin']})}))}
test('identity gate remains active',async({page})=>{await page.goto('/spatial/workspace');await expect(page.getByRole('heading',{name:'ATLAS Identity'})).toBeVisible()});
test('authenticated workspace keeps camera opt-in and alternatives',async({page})=>{await authenticate(page);await page.goto('/spatial/workspace');await expect(page.getByRole('button',{name:'Start camera'})).toBeVisible();await expect(page.getByRole('tree',{name:'Spatial objects'})).toBeVisible();await expect(page.getByRole('button',{name:'Zoom in'})).toBeVisible()});
test('WebGL loss yields Compatibility Mode without losing controls',async({page})=>{await authenticate(page);await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type:any,...args:any[]){if(type==='webgl'||type==='webgl2')return null;return original.call(this,type,...args as any)} as any});await page.goto('/spatial/workspace');await expect(page.getByText(/Compatibility Mode/i)).toBeVisible();await expect(page.getByRole('button',{name:'Zoom in'})).toBeVisible()});
```

- [ ] **Step 4: Add non-deploying feature CI**

```yaml
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
        with: {node-version: '22', cache: 'npm'}
      - run: npm ci
      - run: npm audit --audit-level=high
      - run: npm run typecheck
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

No deploy job, workflow-call to production, or provider-credit call is permitted.

- [ ] **Step 5: Create readiness document with no pre-claimed evidence**

```md
# ATLAS Spatial Interface Readiness

| Gate | Status | Evidence |
|---|---|---|
| Chrome desktop camera allow/deny/revoke | NOT VERIFIED | — |
| Safari desktop camera allow/deny/revoke | NOT VERIFIED | — |
| Tablet touch fallback | NOT VERIFIED | — |
| Mobile touch fallback | NOT VERIFIED | — |
| Browser blur/visibility cancels armed command | NOT VERIFIED | — |
| Privacy Mode stops every media track and locks execution | NOT VERIFIED | — |
| Lost-hand/low-confidence cancellation | NOT VERIFIED | — |
| Idle-motion false-positive observation | NOT VERIFIED | — |
| No Tier 3/4 false-positive execution | NOT VERIFIED | — |
| Optimal/Reduced/Compatibility mode accuracy | NOT VERIFIED | — |
| WebGL compatibility mode | NOT VERIFIED | — |
| Reduced motion | NOT VERIFIED | — |
| Keyboard-only flow | NOT VERIFIED | — |
| Screen-reader semantics | NOT VERIFIED | — |
| Tier 3/4 owner authorization fail-closed | NOT VERIFIED | — |
| Audit unavailable prevents governed success | NOT VERIFIED | — |
| Scene unmount/resource disposal/memory | NOT VERIFIED | — |
| Finance/Health/Hospitality/Creator regression | NOT VERIFIED | — |
| Voice/Automations/Connect/Health truthful readiness | NOT VERIFIED | — |
```

- [ ] **Step 6: Run complete automated verification and shortcut scan**

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

Expected: automated gates PASS; manual/hardware rows remain `NOT VERIFIED` until observed.

- [ ] **Step 7: Commit**

```bash
git add package.json apps/web/package.json package-lock.json playwright.config.ts e2e/spatial.spec.ts .github/workflows/atlas-spatial-interface-ci.yml docs/qa/ATLAS_SPATIAL_INTERFACE_READINESS.md
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

Then independently verify from code and observed evidence:

1. Current-main routes and ATLAS Identity remain intact.
2. Spatial adds one shell entry and one identity-gated route family; it replaces nothing.
3. Raw camera frames are absent from local storage, Supabase payloads, logs, and audit rows.
4. `audit_logs` remains the audit source of truth.
5. Point, pinch, swipe left/right, open palm, grab, two-hand spread/pinch, hold-pinch, second-pinch confirmation, and gesture cursor are tested.
6. Grab drives real move/rotate based on visible manipulation tool; two-hand spread/pinch drives real zoom.
7. Browser blur, visibility loss, tracking loss, camera revoke, and Privacy Mode disarm pending interaction.
8. Tier 3/4 cannot execute through client policy; Tier 4 cannot be approved by gesture alone.
9. Health data is not attached to the procedural human without a real Health adapter.
10. Voice/Automations/Connect/Health remain `not_configured` until real verified adapters exist.
11. `Optimal`, `Reduced`, and `Compatibility` reflect measured capability; reduced mode lowers vision inference rate.
12. Keyboard/pointer/touch alternatives exist for meaningful gesture actions.
13. No external provider credits are consumed by tests.
14. No merge or deployment has occurred.
15. Manual camera/device/security/readiness rows are not marked PASS without observed evidence.

Only then may the branch be described as **IMPLEMENTED / TESTED**. `SECURITY VERIFIED`, `PRODUCTION CANDIDATE`, `DEPLOYED`, and `POST-DEPLOY VERIFIED` require their own observed gates and separate deployment authorization.