# ATLAS Decision Compass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an authenticated, evidence-gated ATLAS Decision Compass that stores reflective signals, maps them to review questions, links independent evidence, proposes actions, and allows `verified` only after explicit verification gates pass.

**Architecture:** Add a domain-neutral `packages/decision-compass` transition engine that reuses Core `TenantScope`; persist records in Supabase with RLS and immutable audit history; expose the feature through a protected `/governance/decision-compass` React route using the existing ATLAS Identity and Supabase session client. Symbolic signals never satisfy evidence or verification gates and never execute privileged actions.

**Tech Stack:** TypeScript 5.7, React 18, React Router, Vitest, Testing Library, Supabase Postgres/RLS, existing ATLAS Identity client.

**Spec:** `docs/superpowers/specs/2026-09-08-atlas-decision-compass-design.md`

## Global Constraints

- Reuse `TenantScope` from `packages/core/src/index.ts`; do not create a second tenancy model.
- Use Supabase `atlas-core` as persistence/control-plane authority.
- Protect the route with the current `RequireAtlasIdentity` guard.
- Symbolic, intuitive, and AI-reflection signals have zero evidentiary weight by themselves.
- A record cannot transition directly from `reflection` to `verified`.
- `verified` requires completed verification gates and at least one independent evidence reference.
- Decision Compass cannot execute payments, deployments, infrastructure mutations, clinical decisions, legal filings, telecom changes, payroll changes, or external communications.
- Failed evidence retrieval must remain visible as blocked/error state and must never be represented as success.

---

### Task 1: Domain truth-state engine

**Files:**
- Create: `tests/unit/decision-compass.test.ts`
- Create: `packages/decision-compass/index.ts`

**Interfaces:**
- Consumes: `TenantScope` from `packages/core/src/index.ts`.
- Produces: `DecisionTruthState`, `DecisionRisk`, `DecisionSignalKind`, `DecisionEvidenceRef`, `VerificationGateItem`, `DecisionCompassRecord`, `canTransitionDecision`, `transitionDecision`, `evaluateVerificationGate`.

- [ ] **Step 1: Write failing unit tests**

```ts
import { describe, expect, it } from 'vitest';
import { evaluateVerificationGate, transitionDecision } from '../../packages/decision-compass';

const base = {
  tenantId: 'tenant-1', organizationId: 'org-1', id: 'd-1', createdBy: 'u-1', createdAt: '2026-09-08T00:00:00Z',
  signalKind: 'symbolic' as const, signalLabel: 'The Moon', signalText: 'Check uncertainty',
  interpretation: 'Review incomplete information before acting.', targetModule: 'governance', evidenceRefs: [],
  risk: 'medium' as const, proposedAction: null, verificationGate: [{ id: 'g1', label: 'Independent evidence attached', passed: false }],
  truthState: 'reflection' as const, verifiedBy: null, verifiedAt: null
};

it('forbids reflection to verified even when requested', () => {
  expect(() => transitionDecision(base, 'verified', { actorId: 'u-1' })).toThrow('invalid_truth_state_transition');
});

it('requires evidence and every gate before verified', () => {
  const withEvidence = { ...base, truthState: 'action_proposed' as const, evidenceRefs: [{ kind: 'workflow', sourceModule: 'github', sourceId: 'run-1', label: 'CI run' }], verificationGate: [{ id: 'g1', label: 'CI passed', passed: true }] };
  expect(evaluateVerificationGate(withEvidence)).toEqual({ ready: true, missing: [] });
  expect(transitionDecision(withEvidence, 'verified', { actorId: 'u-2', at: '2026-09-08T01:00:00Z' }).truthState).toBe('verified');
});
```

- [ ] **Step 2: Run `npm run test:unit -- tests/unit/decision-compass.test.ts` and verify RED**
Expected: FAIL because `packages/decision-compass` does not exist.

- [ ] **Step 3: Implement the minimal transition engine**

```ts
import type { TenantScope } from '../core/src';

export type DecisionTruthState = 'reflection' | 'needs_evidence' | 'evidence_found' | 'action_proposed' | 'blocked' | 'verified' | 'rejected' | 'superseded';
export type DecisionRisk = 'low' | 'medium' | 'high' | 'critical';
export type DecisionSignalKind = 'symbolic' | 'intuition' | 'observation' | 'user-note' | 'ai-reflection';
export type DecisionEvidenceRef = { kind: string; sourceModule: string; sourceId: string; label: string; verifiedAt?: string };
export type VerificationGateItem = { id: string; label: string; passed: boolean; evidenceRefIds?: string[] };
export type DecisionCompassRecord = TenantScope & { id: string; createdBy: string; createdAt: string; signalKind: DecisionSignalKind; signalLabel: string; signalText: string; interpretation: string; targetModule: string | null; evidenceRefs: DecisionEvidenceRef[]; risk: DecisionRisk; proposedAction: string | null; verificationGate: VerificationGateItem[]; truthState: DecisionTruthState; verifiedBy: string | null; verifiedAt: string | null };
```

Implement an explicit allowed-transition map. `verified` must hard-fail unless `evaluateVerificationGate(record).ready` is true. `evaluateVerificationGate` is ready only when at least one evidence ref exists, the gate list is non-empty, and every item is passed.

- [ ] **Step 4: Run unit tests and verify GREEN**
Run: `npm run test:unit -- tests/unit/decision-compass.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
`git commit -m "feat: add Decision Compass truth-state engine"`

### Task 2: Supabase persistence, RLS, transition enforcement, audit

**Files:**
- Create: `tests/integration/decision-compass-migration.test.ts`
- Create: `supabase/migrations/20260908_decision_compass.sql`

**Interfaces:**
- Consumes: `public.organizations`, `public.organization_members`, `public.is_org_member(org_id)` already present in atlas-core.
- Produces: `decision_compass_records`, `decision_compass_evidence_refs`, `decision_compass_audit`, `decision_compass_transition(...)` RPC.

- [ ] **Step 1: Write failing source-contract tests**
Test that the migration contains: RLS enabled on all three tables; `public.is_org_member(org_id)` on record/evidence/audit reads; no grants to `anon`; a transition function rejecting `reflection -> verified`; a verified guard requiring evidence count > 0 and every JSON gate item passed; an audit insert for every accepted transition; no update/delete grant on audit.

- [ ] **Step 2: Run the migration contract test and verify RED**
Expected: FAIL because migration is missing.

- [ ] **Step 3: Implement migration**
Create the three tables with `org_id uuid not null references public.organizations(id)`, check constraints for risk/signal/truth-state values, indexes on `(org_id, created_at desc)`, RLS, and authenticated policies using `public.is_org_member(org_id)`.

Grant authenticated users `select, insert` on records/evidence and `select` on audit. Do not grant direct record state update; expose state transitions through a `security invoker` SQL/PLpgSQL function `public.decision_compass_transition(record_id uuid, next_state text, reason text)` that verifies org membership, validates the transition map, checks evidence + gates for `verified`, updates state, and appends an immutable audit row.

- [ ] **Step 4: Run migration contract tests and verify GREEN**
Run: `npm run test:integration -- tests/integration/decision-compass-migration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
`git commit -m "feat: add Decision Compass Supabase governance"`

### Task 3: Supabase client adapter

**Files:**
- Create: `tests/unit/decision-compass-client.test.ts`
- Modify: `apps/web/src/lib/atlasSession.ts`

**Interfaces:**
- Consumes: `getActiveAtlasOrganization`, authenticated Supabase session, domain types.
- Produces: `listDecisionCompassRecords`, `createDecisionCompassRecord`, `addDecisionEvidence`, `transitionDecisionCompassRecord`.

- [ ] **Step 1: Write failing tests**
Stub `fetch` and assert that list/create calls first resolve active organization, all REST requests include the resolved `org_id`, create always starts at `reflection`, and transitions call `/rest/v1/rpc/decision_compass_transition` rather than directly patching `truth_state`.

- [ ] **Step 2: Run tests and verify RED**
Expected: FAIL because functions do not exist.

- [ ] **Step 3: Implement minimal client functions**
Reuse the existing `authorizedFetch` and `parseResponse` internally. Keep the raw session helpers private; export only the four domain operations. Creation body must omit `verified_by`/`verified_at` and force `truth_state: 'reflection'`.

- [ ] **Step 4: Run unit tests and verify GREEN**
Run: `npm run test:unit -- tests/unit/decision-compass-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
`git commit -m "feat: connect Decision Compass to Supabase"`

### Task 4: Protected Decision Compass route and truthful UI

**Files:**
- Create: `tests/integration/decision-compass-route.test.tsx`
- Create: `apps/web/src/modules/governance/DecisionCompassPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/AtlasShell.tsx`

**Interfaces:**
- Consumes: domain types + client adapter + `RequireAtlasIdentity`.
- Produces: `/governance/decision-compass` route and Governance nav entry.

- [ ] **Step 1: Write failing integration tests**
Cover: unauthenticated route redirects to ATLAS Identity with the return target; authenticated member sees heading `Decision Compass`; page shows `Reflection, not evidence`; creation form fields for signal kind/label/text/interpretation/target module/risk; empty evidence state says `No evidence attached`; no button or code path claims symbolic input is verified; failed Supabase load renders an explicit error state; nav contains Governance.

- [ ] **Step 2: Run route test and verify RED**
Expected: FAIL because route/page/nav are missing.

- [ ] **Step 3: Implement page and route**
Use existing page/card CSS classes. Page loads records after identity guard. Provide a compact create form and record cards showing signal, interpretation, evidence count, risk, proposed action, verification checklist, and truth-state badge. Do not implement privileged action execution. Add route:

```tsx
<Route path="/governance/decision-compass" element={<RequireAtlasIdentity><DecisionCompassPage /></RequireAtlasIdentity>} />
```

Add `{ to: '/governance/decision-compass', label: 'Governance' }` to `AtlasShell` nav.

- [ ] **Step 4: Run route + full integration suite and verify GREEN**
Run: `npm run test:integration`
Expected: PASS.

- [ ] **Step 5: Commit**
`git commit -m "feat: add governed Decision Compass workspace"`

### Task 5: Final verification and PR readiness

**Files:**
- Modify only if verification exposes defects.

**Interfaces:**
- Consumes all prior tasks.
- Produces verified branch evidence; no merge/deploy unless separately verified.

- [ ] **Step 1: Run typecheck**
`npm run typecheck`
Expected: PASS.

- [ ] **Step 2: Run unit tests**
`npm run test:unit`
Expected: PASS.

- [ ] **Step 3: Run integration tests**
`npm run test:integration`
Expected: PASS.

- [ ] **Step 4: Run build**
`npm run build`
Expected: PASS.

- [ ] **Step 5: Inspect PR diff**
Confirm no secrets, no user-specific tarot text hard-coded as operational truth, no direct privileged action path, no cross-tenant access path, and no direct `reflection -> verified` path.

- [ ] **Step 6: Verify GitHub Actions for the current PR head**
Do not reuse a workflow result from an older SHA. If CI fails before tests because of an external runner/audit-service problem, record it as an external verification blocker and do not claim full CI green.

- [ ] **Step 7: Update PR description with exact verification evidence**
Keep PR draft unless all required evidence is green. Do not merge or deploy from this plan.
