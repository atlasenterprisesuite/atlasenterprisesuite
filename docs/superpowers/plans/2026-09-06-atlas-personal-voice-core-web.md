# ATLAS Personal Voice Core + Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a governed ATLAS Voice / Personal Voice web module with real browser microphone capture and quality checks, resumable non-audio session state, consent/ownership gates, provider capability enforcement, and truthful provider-unavailable behavior.

**Architecture:** Extend the current React/Vite shell instead of creating a parallel app. Generalize shared permissions in `packages/core`, add a provider-agnostic `packages/voice` domain, implement browser capture under `apps/web/src/modules/voice`, and register routes through the existing `App` and `AtlasShell`. No voice is marked generated or ready unless a real provider exists.

**Tech Stack:** TypeScript 5.7, React 18.3, React Router 7.18, Vite 6.4, Vitest 3.2, Testing Library, browser MediaDevices, MediaRecorder, and Web Audio APIs.

**Spec:** `docs/superpowers/specs/2026-09-06-atlas-personal-voice-design.md`

## Global Constraints
- Reuse existing ATLAS shell, routes, test runner, permissions, and deployment pipeline.
- Web must show `Requires ATLAS iOS app` for Apple Personal Voice.
- Never claim generation is configured unless a real provider is connected.
- Never store raw audio in audit events or localStorage.
- Captured browser audio stays memory-only until a real encrypted upload/provider path exists.
- Voice ownership belongs to the creating user; tenant access alone never grants use.
- Provider actions are enabled only when declared capabilities allow them.
- Keep Finance and Health routes working.
- Verify desktop, tablet, and mobile.

---

### Task 1: Generalize ATLAS permissions without breaking Accounting

**Files:**
- Modify: `packages/core/src/index.ts`
- Create: `tests/unit/core-permissions.test.ts`

**Produces:** `AtlasPermission`, `AccountingPermission`, `VoicePermission`, domain-aware `hasPermission`.

- [ ] **Step 1: Write failing tests**

```ts
import { expect, it } from 'vitest';
import { hasPermission } from '../../packages/core/src';

it('keeps accounting admin semantics', () => {
  expect(hasPermission(['accounting.admin'], 'accounting.post')).toBe(true);
});

it('does not let accounting admin grant voice permissions', () => {
  expect(hasPermission(['accounting.admin'], 'voice.personal.use')).toBe(false);
});

it('grants an explicit voice permission', () => {
  expect(hasPermission(['voice.personal.use'], 'voice.personal.use')).toBe(true);
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- tests/unit/core-permissions.test.ts`

Expected: FAIL because Voice permissions are not defined.

- [ ] **Step 3: Implement domain-aware permission types**

```ts
export type VoicePermission =
  | 'voice.personal.read' | 'voice.personal.create' | 'voice.personal.record'
  | 'voice.personal.generate' | 'voice.personal.use' | 'voice.personal.delete'
  | 'voice.apple.request' | 'voice.apple.use' | 'voice.integration.manage';

export type AtlasPermission = AccountingPermission | VoicePermission;

export function hasPermission(granted: readonly AtlasPermission[], required: AtlasPermission) {
  if (granted.includes(required)) return true;
  if (required.startsWith('accounting.') && granted.includes('accounting.admin')) return true;
  return false;
}
```

Update `demoAtlasContext.permissions` to `AtlasPermission[]` without changing its current accounting permission value.

- [ ] **Step 4: Run regression tests**

Run: `npm test -- tests/unit/core-permissions.test.ts tests/unit/accounting-payables.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/index.ts tests/unit/core-permissions.test.ts
git commit -m "refactor: generalize ATLAS permissions for voice"
```

---

### Task 2: Add the provider-agnostic Voice domain

**Files:**
- Create: `packages/voice/package.json`
- Create: `packages/voice/src/types.ts`
- Create: `packages/voice/src/state.ts`
- Create: `packages/voice/src/capabilities.ts`
- Create: `packages/voice/src/index.ts`
- Create: `tests/unit/voice-domain.test.ts`

**Produces:** `VoiceProfile`, `VoiceProviderCapabilities`, lifecycle helpers, capability checks.

- [ ] **Step 1: Write failing tests**

```ts
import { expect, it } from 'vitest';
import { canTransitionVoice, providerSupports } from '../../packages/voice/src';

it('allows recording to reviewing', () => {
  expect(canTransitionVoice('recording', 'reviewing')).toBe(true);
});

it('blocks draft to ready', () => {
  expect(canTransitionVoice('draft', 'ready')).toBe(false);
});

it('blocks unsupported telephony', () => {
  expect(providerSupports({
    localPlayback: true, audioExport: false, realtimeStream: false,
    telephony: false, serverSynthesis: false
  }, 'telephony')).toBe(false);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/unit/voice-domain.test.ts`

- [ ] **Step 3: Create exact core types**

```ts
export type VoiceProfileStatus =
  | 'draft' | 'sound_check' | 'recording' | 'reviewing'
  | 'ready_to_generate' | 'generating' | 'ready' | 'suspended' | 'deleted';

export type VoiceProviderCapabilities = {
  localPlayback: boolean;
  audioExport: boolean;
  realtimeStream: boolean;
  telephony: boolean;
  serverSynthesis: boolean;
};

export type VoiceProfile = {
  id: string;
  ownerActorId: string;
  tenantId: string;
  organizationId: string;
  name: string;
  language: string;
  providerKind: 'atlas' | 'apple_personal_voice';
  status: VoiceProfileStatus;
  capabilities: VoiceProviderCapabilities;
  createdAt: string;
};
```

Implement an explicit transition map and `providerSupports(capabilities, key)`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- tests/unit/voice-domain.test.ts && npm run typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/voice tests/unit/voice-domain.test.ts
git commit -m "feat: add ATLAS voice domain contracts"
```

---

### Task 3: Add consent, ownership, generation, repository, and deletion policy

**Files:**
- Create: `packages/voice/src/policy.ts`
- Create: `packages/voice/src/repository.ts`
- Modify: `packages/voice/src/index.ts`
- Modify: `tests/unit/voice-domain.test.ts`

**Produces:** `VoiceConsent`, `VoicePermissionGrant`, `VoiceAuditEvent`, `VoiceRepository`, `InMemoryVoiceRepository`, `canGenerateVoice`, `canUseVoice`, `deleteVoice`.

- [ ] **Step 1: Add failing policy tests**

```ts
it('requires consent and challenge before generation', () => {
  expect(canGenerateVoice({ consentAccepted: true, challengeVerified: false, sampleReviewComplete: true })).toBe(false);
  expect(canGenerateVoice({ consentAccepted: true, challengeVerified: true, sampleReviewComplete: true })).toBe(true);
});

it('does not grant use to another actor without a grant', () => {
  expect(canUseVoice({ ownerActorId: 'owner', actorId: 'other', grantedActorIds: [] })).toBe(false);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/unit/voice-domain.test.ts`

- [ ] **Step 3: Implement repository contract**

```ts
export interface VoiceRepository {
  getProfile(id: string): Promise<VoiceProfile | null>;
  saveProfile(profile: VoiceProfile): Promise<void>;
  listProfilesForOwner(ownerActorId: string): Promise<VoiceProfile[]>;
  saveSession(session: RecordingSession): Promise<void>;
  saveSample(sample: VoiceSample): Promise<void>;
  deleteSamplesForProfile(profileId: string): Promise<void>;
  saveConsent(consent: VoiceConsent): Promise<void>;
  replacePermissionGrants(profileId: string, grants: VoicePermissionGrant[]): Promise<void>;
  appendAudit(event: VoiceAuditEvent): Promise<void>;
}
```

`deleteVoice` must revoke grants, remove samples, mark the profile deleted, and append metadata-only audit.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/unit/voice-domain.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/voice/src tests/unit/voice-domain.test.ts
git commit -m "feat: govern voice consent ownership and deletion"
```

---

### Task 4: Implement real browser microphone adapter and deterministic quality rules

**Files:**
- Create: `apps/web/src/modules/voice/browserMicrophone.ts`
- Create: `apps/web/src/modules/voice/quality.ts`
- Create: `tests/unit/voice-quality.test.ts`

**Produces:** `MicrophoneAdapter`, `BrowserMicrophoneAdapter`, `MeasuredAudioStats`, `assessVoiceQuality`.

- [ ] **Step 1: Write failing quality tests**

```ts
it('rejects clipping', () => {
  const result = assessVoiceQuality({ peak: 0.999, rms: 0.25, silenceRatio: 0.1, noiseFloor: 0.02, volumeStdDev: 0.03 });
  expect(result.status).toBe('needs_retry');
  expect(result.reasons).toContain('clipping');
});

it('accepts a stable sample', () => {
  const result = assessVoiceQuality({ peak: 0.7, rms: 0.18, silenceRatio: 0.12, noiseFloor: 0.015, volumeStdDev: 0.04 });
  expect(result.status).toBe('accepted');
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/unit/voice-quality.test.ts`

- [ ] **Step 3: Implement auditable thresholds**

```ts
export const QUALITY_THRESHOLDS = {
  clippingPeak: 0.98,
  minimumRms: 0.04,
  maximumSilenceRatio: 0.45,
  maximumNoiseFloor: 0.08,
  maximumVolumeStdDev: 0.18
} as const;
```

- [ ] **Step 4: Implement injectable microphone API**

```ts
export interface MicrophoneAdapter {
  requestPermission(): Promise<'granted' | 'denied' | 'unavailable'>;
  start(): Promise<void>;
  stop(): Promise<{ blob: Blob; stats: MeasuredAudioStats }>;
}
```

Use `navigator.mediaDevices.getUserMedia({ audio: true })`, `MediaRecorder`, and `AudioContext`. Always stop all stream tracks after recording.

- [ ] **Step 5: Test and commit**

Run: `npm test -- tests/unit/voice-quality.test.ts && npm run typecheck`

```bash
git add apps/web/src/modules/voice/browserMicrophone.ts apps/web/src/modules/voice/quality.ts tests/unit/voice-quality.test.ts
git commit -m "feat: add browser voice capture quality checks"
```

---

### Task 5: Add resumable non-audio wizard metadata

**Files:**
- Create: `apps/web/src/modules/voice/storage.ts`
- Modify: `tests/unit/voice-domain.test.ts`

**Produces:** `LocalVoiceSessionStore`, key `atlas.voice.personal.session.v1`.

- [ ] **Step 1: Write failing storage test**

```ts
const store = new LocalVoiceSessionStore(new MapStorage());
store.save({ profileId: 'vp-1', step: 'record', consentAccepted: true });
expect(store.load()?.step).toBe('record');
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/unit/voice-domain.test.ts`

- [ ] **Step 3: Implement only non-audio storage**

```ts
export type StoredVoiceSession = {
  version: 1;
  profileId: string;
  step: 'setup' | 'sound-check' | 'record' | 'review' | 'generate';
  consentAccepted: boolean;
};
```

Invalid JSON/version returns `null` and clears corrupt state. Never serialize Blob, object URL, or audio bytes. After reload, prior audio samples are `missing` and must be recorded again.

- [ ] **Step 4: Test and commit**

Run: `npm test -- tests/unit/voice-domain.test.ts`

```bash
git add apps/web/src/modules/voice/storage.ts tests/unit/voice-domain.test.ts
git commit -m "feat: persist personal voice wizard metadata"
```

---

### Task 6: Register ATLAS Voice in the canonical shell and route graph

**Files:**
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Modify: `apps/web/src/App.tsx`
- Create: `apps/web/src/modules/voice/VoiceHomePage.tsx`
- Create: `apps/web/src/modules/voice/PersonalVoicePage.tsx`
- Create: `apps/web/src/modules/voice/AppleVoicePage.tsx`
- Create: `tests/integration/voice-routes.test.tsx`

- [ ] **Step 1: Write failing route tests**

```tsx
it('renders ATLAS Voice', () => {
  render(<MemoryRouter initialEntries={['/voice']}><App /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'ATLAS Voice' })).toBeInTheDocument();
});

it('is truthful about Apple web capability', () => {
  render(<MemoryRouter initialEntries={['/voice/personal-voice/apple']}><App /></MemoryRouter>);
  expect(screen.getByText(/requires the ATLAS iOS app/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify failures**

Run: `npm test -- tests/integration/voice-routes.test.tsx`

- [ ] **Step 3: Add navigation and routes**

Add `{ to: '/voice', label: 'Voice' }` to `AtlasShell` navigation.

Register in `App.tsx`:

```tsx
<Route path="/voice" element={<VoiceHomePage />} />
<Route path="/voice/personal-voice" element={<PersonalVoicePage />} />
<Route path="/voice/personal-voice/apple" element={<AppleVoicePage />} />
```

Keep Voice implementation out of `App.tsx`.

- [ ] **Step 4: Run Voice and existing route regressions**

Run: `npm test -- tests/integration/voice-routes.test.tsx tests/integration/health-routes.test.tsx tests/integration/payables-route.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/components/AtlasShell.tsx apps/web/src/modules/voice tests/integration/voice-routes.test.tsx
git commit -m "feat: add ATLAS Voice routes and navigation"
```

---

### Task 7: Build the governed wizard through Quality Review

**Files:**
- Create: `apps/web/src/modules/voice/PersonalVoiceWizard.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/modules/voice/PersonalVoicePage.tsx`
- Create: `tests/integration/voice-wizard.test.tsx`

- [ ] **Step 1: Write failing consent and microphone tests**

```tsx
expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
await user.click(screen.getByRole('checkbox', { name: /I own or am authorized/i }));
expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
```

Use an injected fake `MicrophoneAdapter` returning `denied` and assert `Microphone access is required`.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/integration/voice-wizard.test.tsx`

- [ ] **Step 3: Implement setup and anti-impersonation challenge**

Capture consent version plus an in-session challenge sample. `challengeVerified` must be true before generation eligibility.

- [ ] **Step 4: Implement Sound Check**

Each check renders `Pass`, `Needs attention`, or `Unavailable`. Missing browser APIs map to `Unavailable`.

- [ ] **Step 5: Implement Guided Recording**

Each phrase gets `Record`, `Stop`, `Replay`, `Accept`, `Retry`. Progress comes from accepted sample count.

- [ ] **Step 6: Implement Quality Review**

Render `Accepted`, `Needs retry`, `Rejected`, `Missing`. Retry navigates to the exact phrase.

- [ ] **Step 7: Run and commit**

Run: `npm test -- tests/integration/voice-wizard.test.tsx`

```bash
git add apps/web/src/modules/voice apps/web/src/App.tsx tests/integration/voice-wizard.test.tsx
git commit -m "feat: add governed personal voice recording wizard"
```

---

### Task 8: Add truthful generation gating and provider abstraction

**Files:**
- Create: `apps/web/src/modules/voice/providers.ts`
- Modify: `apps/web/src/modules/voice/PersonalVoiceWizard.tsx`
- Modify: `tests/integration/voice-wizard.test.tsx`

- [ ] **Step 1: Write failing unavailable-provider test**

```tsx
expect(screen.getByText(/Voice generation provider not configured/i)).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Generate Voice' })).toBeDisabled();
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/integration/voice-wizard.test.tsx`

- [ ] **Step 3: Add provider adapter**

```ts
export interface VoiceProviderAdapter {
  kind: 'atlas' | 'apple_personal_voice';
  capabilities: VoiceProviderCapabilities;
  availability(): Promise<'available' | 'unavailable' | 'authorization_required'>;
  createVoice(input: { profileId: string; sampleIds: string[] }): Promise<{ jobId: string }>;
}
```

`UnconfiguredAtlasVoiceProvider.availability()` returns `unavailable`; `createVoice()` throws `provider_unavailable`.

- [ ] **Step 4: Enforce generation gates**

Generation requires consent, challenge, reviewed samples, `voice.personal.generate`, provider availability, and `serverSynthesis=true`.

- [ ] **Step 5: Test and commit**

Run: `npm test -- tests/integration/voice-wizard.test.tsx tests/unit/voice-domain.test.ts`

```bash
git add apps/web/src/modules/voice/providers.ts apps/web/src/modules/voice/PersonalVoiceWizard.tsx tests/integration/voice-wizard.test.tsx
git commit -m "feat: gate voice generation by real provider capability"
```

---

### Task 9: Add permissions management and deletion UI

**Files:**
- Create: `apps/web/src/modules/voice/VoicePermissionsPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `tests/integration/voice-routes.test.tsx`
- Modify: `tests/unit/voice-domain.test.ts`

- [ ] **Step 1: Write failing capability-aware tests**

```tsx
expect(screen.getByRole('checkbox', { name: /ATLAS Telecom/i })).toBeDisabled();
```

when selected provider has `telephony=false`.

Also assert `Delete Voice` opens an explicit confirmation dialog.

- [ ] **Step 2: Run and verify failures**

Run: `npm test -- tests/integration/voice-routes.test.tsx tests/unit/voice-domain.test.ts`

- [ ] **Step 3: Implement scoped grants**

Require `telephony` for Telecom, `realtimeStream` for external streaming, and local playback or authorized server synthesis for assistant use.

- [ ] **Step 4: Wire deletion through domain policy**

Revoke grants first, remove sample references, mark deleted, append metadata-only audit, and never retain audio in audit.

- [ ] **Step 5: Test and commit**

Run: `npm test -- tests/integration/voice-routes.test.tsx tests/unit/voice-domain.test.ts`

```bash
git add apps/web/src/modules/voice/VoicePermissionsPage.tsx apps/web/src/App.tsx tests/integration/voice-routes.test.tsx tests/unit/voice-domain.test.ts
git commit -m "feat: manage personal voice permissions and deletion"
```

---

### Task 10: Responsive styling, accessibility, and final verification

**Files:**
- Create: `apps/web/src/modules/voice/voice.css`
- Modify: Voice components as needed for semantics and responsive classes
- Modify: Voice integration tests as needed

- [ ] **Step 1: Add semantic assertions**

Wizard progress must have an accessible label; errors use `role="alert"`; status updates use `role="status"`; disabled actions use real `disabled` attributes.

- [ ] **Step 2: Add responsive ATLAS styling**

Implement desktop, tablet, and mobile layouts; large record control; focus, selected, loading, disabled, error, success states. Reuse existing ATLAS styles/variables rather than creating a separate brand system.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run test:unit
npm run test:integration
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 4: Verify routes manually**

Check `/`, Finance, Payables, Health, `/voice`, `/voice/personal-voice`, setup, sound-check, record, review, generate, apple, permissions. Confirm no 404/500 and no false `ready`, `connected`, or Apple-native claims.

- [ ] **Step 5: Verify microphone states and responsive widths**

Test granted, denied, unavailable microphone; confirm tracks stop after recording. Check 390px, 768px, 1440px widths.

- [ ] **Step 6: Verify existing `/healthz` remains unchanged**

Use the existing production verification method.

- [ ] **Step 7: Commit fixes only if verification changed files**

```bash
git add -A
git commit -m "fix: harden ATLAS Personal Voice release candidate"
```

Do not create an empty commit.
