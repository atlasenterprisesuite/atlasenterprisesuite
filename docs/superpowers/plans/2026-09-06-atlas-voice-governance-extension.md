# ATLAS Voice Recording + Transcript Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the approved ATLAS Personal Voice domain with explicit recording-state governance, consent-aware recording policy, and scoped transcript provenance without duplicating the existing Voice implementation plan.

**Architecture:** This plan layers onto `docs/superpowers/plans/2026-09-06-atlas-personal-voice-core-web.md`. It consumes the shared authorization contracts from `packages/core` and the provider capability model from `packages/voice`. Recording state is evidence-driven, policy decisions are deterministic and testable, and transcript records preserve provenance and scope without placing raw audio in audit metadata.

**Tech Stack:** TypeScript 5.7, npm workspaces, Vitest 3.2, existing planned `packages/voice` domain.

**Spec:** `docs/superpowers/specs/2026-09-06-winter27-atlas-platform-controls-design.md`

## Global Constraints
- Execute after the Core Platform Controls plan establishes shared authorization.
- Reuse the existing Personal Voice domain and granular Voice permissions; do not create a second Voice package.
- Never display `recording` unless provider/device/runtime evidence confirms recording is active.
- Recording requires tenant scope, `voice.personal.record`, provider capability, applicable consent, and runtime/device readiness.
- Transcript access requires `voice.transcript.read` or an explicitly equivalent future scoped permission.
- Never store raw audio in audit events.
- Apple Personal Voice remains device-local and is not treated as server-recording capability unless a future verified API permits it.

---

### Task 1: Add explicit recording-state types and transitions

**Files:**
- Create: `packages/voice/src/recording.ts`
- Modify: `packages/voice/src/index.ts`
- Create: `tests/unit/voice-recording.test.ts`

**Interfaces:**
- Consumes: `VoiceProviderCapabilities` from `packages/voice/src/types.ts`.
- Produces: `VoiceRecordingState`, `RecordingEvidence`, `deriveRecordingState`.

- [ ] **Step 1: Write failing recording-state tests**

```ts
import { describe, expect, it } from 'vitest';
import { deriveRecordingState } from '../../packages/voice/src';

describe('voice recording state', () => {
  it('never reports recording without runtime confirmation', () => {
    expect(deriveRecordingState({
      capabilitySupported: true,
      enabledByPolicy: true,
      consentSatisfied: true,
      runtimeConfirmedRecording: false,
      paused: false,
      stopped: false,
      error: null
    })).toBe('awaiting_consent');
  });

  it('reports recording only after confirmation', () => {
    expect(deriveRecordingState({
      capabilitySupported: true,
      enabledByPolicy: true,
      consentSatisfied: true,
      runtimeConfirmedRecording: true,
      paused: false,
      stopped: false,
      error: null
    })).toBe('recording');
  });

  it('reports unsupported before all other states', () => {
    expect(deriveRecordingState({
      capabilitySupported: false,
      enabledByPolicy: true,
      consentSatisfied: true,
      runtimeConfirmedRecording: true,
      paused: false,
      stopped: false,
      error: null
    })).toBe('unsupported');
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/unit/voice-recording.test.ts`

- [ ] **Step 3: Implement exact recording state**

```ts
export type VoiceRecordingState =
  | 'unsupported' | 'disabled' | 'awaiting_consent'
  | 'recording' | 'paused' | 'stopped' | 'error';

export type RecordingEvidence = {
  capabilitySupported: boolean;
  enabledByPolicy: boolean;
  consentSatisfied: boolean;
  runtimeConfirmedRecording: boolean;
  paused: boolean;
  stopped: boolean;
  error: string | null;
};

export function deriveRecordingState(input: RecordingEvidence): VoiceRecordingState {
  if (!input.capabilitySupported) return 'unsupported';
  if (input.error) return 'error';
  if (!input.enabledByPolicy) return 'disabled';
  if (!input.consentSatisfied) return 'awaiting_consent';
  if (input.stopped) return 'stopped';
  if (input.paused) return 'paused';
  return input.runtimeConfirmedRecording ? 'recording' : 'awaiting_consent';
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/unit/voice-recording.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/voice/src/recording.ts packages/voice/src/index.ts tests/unit/voice-recording.test.ts
git commit -m "feat: add evidence-based voice recording states"
```

---

### Task 2: Add tenant-, permission-, capability-, and consent-aware recording policy

**Files:**
- Create: `packages/voice/src/recordingPolicy.ts`
- Modify: `packages/voice/src/index.ts`
- Modify: `tests/unit/voice-recording.test.ts`

**Interfaces:**
- Consumes: `AuthorizationContext`, `TenantScope`, `authorize` from `packages/core/src`.
- Produces: `RecordingPolicyInput`, `RecordingPolicyDecision`, `evaluateRecordingPolicy`.

- [ ] **Step 1: Add failing policy tests**

```ts
import { evaluateRecordingPolicy } from '../../packages/voice/src';

const actor = {
  scope: { tenantId: 't1', organizationId: 'o1' },
  permissions: ['voice.personal.record'] as const
};

it('denies recording across tenant scope', () => {
  expect(evaluateRecordingPolicy({
    actor,
    resourceScope: { tenantId: 't2', organizationId: 'o1' },
    providerSupportsRecording: true,
    consentRequired: true,
    consentSatisfied: true,
    runtimeReady: true
  })).toEqual({ allowed: false, reason: 'scope_mismatch' });
});

it('denies when consent is required but missing', () => {
  expect(evaluateRecordingPolicy({
    actor,
    resourceScope: actor.scope,
    providerSupportsRecording: true,
    consentRequired: true,
    consentSatisfied: false,
    runtimeReady: true
  })).toEqual({ allowed: false, reason: 'consent_required' });
});

it('allows only when every gate passes', () => {
  expect(evaluateRecordingPolicy({
    actor,
    resourceScope: actor.scope,
    providerSupportsRecording: true,
    consentRequired: true,
    consentSatisfied: true,
    runtimeReady: true
  })).toEqual({ allowed: true });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/unit/voice-recording.test.ts`

- [ ] **Step 3: Implement policy evaluator**

```ts
import { authorize, type AuthorizationContext, type TenantScope } from '../../core/src';

export type RecordingPolicyInput = {
  actor: AuthorizationContext;
  resourceScope: TenantScope;
  providerSupportsRecording: boolean;
  consentRequired: boolean;
  consentSatisfied: boolean;
  runtimeReady: boolean;
};

export type RecordingPolicyDecision =
  | { allowed: true }
  | { allowed: false; reason: 'scope_mismatch' | 'permission_denied' | 'unsupported' | 'consent_required' | 'runtime_not_ready' };

export function evaluateRecordingPolicy(input: RecordingPolicyInput): RecordingPolicyDecision {
  const auth = authorize(input.actor, { scope: input.resourceScope, permission: 'voice.personal.record' });
  if (!auth.ok) return { allowed: false, reason: auth.reason };
  if (!input.providerSupportsRecording) return { allowed: false, reason: 'unsupported' };
  if (input.consentRequired && !input.consentSatisfied) return { allowed: false, reason: 'consent_required' };
  if (!input.runtimeReady) return { allowed: false, reason: 'runtime_not_ready' };
  return { allowed: true };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- tests/unit/voice-recording.test.ts && npm run typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/voice/src/recordingPolicy.ts packages/voice/src/index.ts tests/unit/voice-recording.test.ts
git commit -m "feat: enforce governed voice recording policy"
```

---

### Task 3: Add transcript provenance contracts and validation

**Files:**
- Create: `packages/voice/src/transcripts.ts`
- Modify: `packages/voice/src/index.ts`
- Create: `tests/unit/voice-transcripts.test.ts`

**Interfaces:**
- Produces: `TranscriptCompleteness`, `TranscriptSource`, `VoiceTranscript`, `validateTranscriptProvenance`.

- [ ] **Step 1: Write failing transcript tests**

```ts
import { expect, it } from 'vitest';
import { validateTranscriptProvenance } from '../../packages/voice/src';

it('accepts a scoped complete transcript with source provenance', () => {
  expect(validateTranscriptProvenance({
    id: 'tr-1',
    sessionId: 'session-1',
    scope: { tenantId: 't1', organizationId: 'o1' },
    ownerActorId: 'user-1',
    source: { kind: 'provider', providerId: 'voice-provider-a' },
    completeness: 'complete',
    generatedAt: '2026-09-06T18:00:00.000Z',
    recordingId: 'rec-1',
    sourceStartedAt: '2026-09-06T17:59:00.000Z',
    sourceEndedAt: '2026-09-06T18:00:00.000Z'
  })).toEqual({ ok: true });
});

it('rejects missing provider identity', () => {
  expect(validateTranscriptProvenance({
    id: 'tr-2', sessionId: 'session-2',
    scope: { tenantId: 't1', organizationId: 'o1' }, ownerActorId: 'user-1',
    source: { kind: 'provider', providerId: '' }, completeness: 'partial',
    generatedAt: '2026-09-06T18:00:00.000Z'
  })).toEqual({ ok: false, reason: 'invalid_source' });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/unit/voice-transcripts.test.ts`

- [ ] **Step 3: Implement provenance model**

```ts
import type { TenantScope } from '../../core/src';

export type TranscriptCompleteness = 'partial' | 'complete';
export type TranscriptSource =
  | { kind: 'provider'; providerId: string }
  | { kind: 'local_runtime'; runtimeId: string };

export type VoiceTranscript = {
  id: string;
  sessionId: string;
  scope: TenantScope;
  ownerActorId: string;
  source: TranscriptSource;
  completeness: TranscriptCompleteness;
  generatedAt: string;
  recordingId?: string;
  sourceStartedAt?: string;
  sourceEndedAt?: string;
};

export function validateTranscriptProvenance(transcript: VoiceTranscript) {
  if (!transcript.scope.tenantId || !transcript.scope.organizationId) {
    return { ok: false as const, reason: 'invalid_scope' as const };
  }
  if (transcript.source.kind === 'provider' && !transcript.source.providerId) {
    return { ok: false as const, reason: 'invalid_source' as const };
  }
  if (transcript.source.kind === 'local_runtime' && !transcript.source.runtimeId) {
    return { ok: false as const, reason: 'invalid_source' as const };
  }
  return { ok: true as const };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/unit/voice-transcripts.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/voice/src/transcripts.ts packages/voice/src/index.ts tests/unit/voice-transcripts.test.ts
git commit -m "feat: add voice transcript provenance"
```

---

### Task 4: Enforce transcript access with shared authorization and audit evidence

**Files:**
- Create: `packages/voice/src/transcriptAccess.ts`
- Modify: `packages/voice/src/index.ts`
- Modify: `tests/unit/voice-transcripts.test.ts`

**Interfaces:**
- Consumes: `authorize`, `createAuditEvent` from `packages/core/src`.
- Produces: `authorizeTranscriptRead`.

- [ ] **Step 1: Add failing access test**

```ts
import { authorizeTranscriptRead } from '../../packages/voice/src';

it('requires voice.transcript.read within the same scope', () => {
  const transcript = {
    id: 'tr-1', sessionId: 's1', scope: { tenantId: 't1', organizationId: 'o1' },
    ownerActorId: 'owner', source: { kind: 'local_runtime' as const, runtimeId: 'ios-1' },
    completeness: 'complete' as const, generatedAt: '2026-09-06T18:00:00.000Z'
  };
  expect(authorizeTranscriptRead({
    actorId: 'reviewer',
    actor: { scope: transcript.scope, permissions: ['voice.transcript.read'] },
    transcript,
    occurredAt: '2026-09-06T18:01:00.000Z'
  }).allowed).toBe(true);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/unit/voice-transcripts.test.ts`

- [ ] **Step 3: Implement authorization result plus metadata-only audit**

```ts
import { authorize, createAuditEvent, type AuthorizationContext } from '../../core/src';
import type { VoiceTranscript } from './transcripts';

export function authorizeTranscriptRead(input: {
  actorId: string;
  actor: AuthorizationContext;
  transcript: VoiceTranscript;
  occurredAt: string;
}) {
  const decision = authorize(input.actor, {
    scope: input.transcript.scope,
    permission: 'voice.transcript.read'
  });
  return {
    allowed: decision.ok,
    audit: createAuditEvent({
      scope: input.transcript.scope,
      actorId: input.actorId,
      action: 'voice.transcript.read',
      resource: `transcript:${input.transcript.id}`,
      result: decision.ok ? 'success' : 'denied',
      occurredAt: input.occurredAt
    })
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/unit/voice-transcripts.test.ts tests/unit/core-permissions.test.ts tests/unit/core-audit.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/voice/src/transcriptAccess.ts packages/voice/src/index.ts tests/unit/voice-transcripts.test.ts
git commit -m "feat: govern transcript access and audit"
```

---

### Task 5: Verify Voice governance against existing Personal Voice rules

**Files:**
- Test: `tests/unit/voice-recording.test.ts`
- Test: `tests/unit/voice-transcripts.test.ts`
- Regression: existing Voice tests from `2026-09-06-atlas-personal-voice-core-web.md` once implemented.

- [ ] **Step 1: Run focused governance tests**

Run: `npm test -- tests/unit/voice-recording.test.ts tests/unit/voice-transcripts.test.ts`

Expected: PASS.

- [ ] **Step 2: Run all Voice tests**

Run: `npm test -- tests/unit/voice-*.test.ts`

Expected: PASS after the Personal Voice core plan has landed.

- [ ] **Step 3: Run core permission/audit regression tests**

Run: `npm test -- tests/unit/core-permissions.test.ts tests/unit/core-audit.test.ts`

Expected: PASS.

- [ ] **Step 4: Run repository typecheck and build**

Run: `npm run typecheck && npm run build`

Expected: PASS.

- [ ] **Step 5: Verify no fake recording state is hard-coded in UI/domain code**

Run: `git grep -n "recording" -- apps/web packages/voice | grep -E "(true|connected|ready)" || true`

Expected: no unconditional production recording/readiness claim; every live state must derive from runtime/provider evidence.

- [ ] **Step 6: Commit compatibility corrections only if needed**

```bash
git add packages/voice tests/unit apps/web
git commit -m "test: verify ATLAS voice governance"
```

Do not create an empty commit if no correction was needed.
