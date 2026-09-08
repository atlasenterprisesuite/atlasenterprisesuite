# ATLAS Decision Compass — Design Specification

Date: 2026-09-08
Status: Approved concept, design specification pending implementation-plan approval
Branch: `feat/atlas-decision-compass`

## Purpose

ATLAS Decision Compass is a governed reflection layer that converts a symbolic or intuitive signal into a structured review workflow without allowing that signal to become operational truth.

The governing rule is:

> Intuition may orient attention. Evidence decides state, action, and completion.

Decision Compass must never treat tarot, intuition, sentiment, or another symbolic input as evidence of an external fact. It may suggest where to look, what to question, or what risk to inspect. Any operational action must be supported by independent evidence, existing permissions, and the verification gates of the affected ATLAS module.

## Repository Alignment

The current repository already defines `TenantScope` in `packages/core/src/index.ts`. Decision Compass must reuse this tenancy boundary and must not create a separate tenant model.

ATLAS Health already contains explicit evidence-level and evidence-status concepts. Decision Compass should follow the same truth-boundary philosophy while remaining domain-neutral. It must not import biomedical evidence semantics into Finance, Telecom, Infrastructure, or other modules.

ATLAS Manager establishes Supabase `atlas-core` as the primary backend/control-plane authority. Decision Compass should therefore use Supabase for persisted records and server-side policy enforcement rather than introducing a second backend.

ATLAS Identity is already used to protect authenticated routes and active organization membership. Decision Compass must sit behind the same identity boundary.

## Approaches Considered

### A. Embed symbolic guidance inside each module

Each ATLAS module would interpret a daily reading independently.

Pros:
- Simple local UI integration.
- No new cross-cutting service.

Cons:
- Duplicates logic and policy.
- High risk of inconsistent truth states.
- Makes it easier for symbolic input to leak into operational decisions.

Decision: rejected.

### B. Create a governed cross-module Decision Compass service

A domain-neutral package owns Decision Compass records, validation, truth-state rules, and action proposals. Modules consume proposals but retain authority over execution and verification.

Pros:
- One truth boundary.
- Reusable across Finance, Health, Telecom, Infrastructure, Legal, HR, and future modules.
- Keeps symbolic inputs explicitly separate from evidence.
- Fits ATLAS governance and tenant isolation.

Cons:
- Requires a new package, route, persistence model, and tests.

Decision: selected.

### C. Treat the reading as an AI prompt only

The reading would exist only as free-form context passed to an assistant.

Pros:
- Minimal engineering.

Cons:
- No durable provenance.
- No deterministic safety rules.
- No auditability.
- No reliable separation between suggestion and verified state.

Decision: rejected.

## Core Model

The canonical flow is:

`Signal → Interpretation → EvidenceRefs → Risk → ProposedAction → VerificationGate → TruthState`

### Signal

A signal is the original reflective input. Examples:
- daily tarot reading;
- intuition note;
- strategic observation;
- user-entered concern;
- AI-generated reflection prompt.

A signal has no evidentiary weight by itself.

### Interpretation

An interpretation converts the signal into one or more neutral questions or areas of attention.

Example:
- Signal: `The Moon`
- Interpretation: `Check for incomplete or contradictory information before acting.`

The interpretation must be phrased as a review instruction, not a factual prediction.

### EvidenceRefs

Evidence references point to independently verifiable ATLAS records or external-source records already governed by the owning module.

Examples:
- GitHub workflow run;
- Supabase row or audit event;
- Gmail message ID;
- government document record;
- verified transaction;
- production health check;
- approved clinical evidence record.

A Decision Compass record may have zero evidence refs while it is only a reflection. It cannot advance to an actionable verified state without appropriate evidence.

### Risk

Risk is an explicit assessment of what could go wrong if the proposed action is taken or ignored.

Initial risk levels:
- `low`
- `medium`
- `high`
- `critical`

Risk does not grant permission. It only affects review priority and required gates.

### ProposedAction

A proposed action is a recommendation for the owning ATLAS module.

Examples:
- inspect a failed workflow;
- review a deadline-bearing government notice;
- verify a billing failure;
- compare a configuration against production state.

Decision Compass never executes privileged actions directly.

### VerificationGate

The owning module defines the evidence required before the action can be marked complete.

Examples:
- Infrastructure: tests + build + deployment evidence + `/healthz`.
- Finance: reconciled transaction evidence + approval + audit event.
- Telecom: carrier/modem confirmation + read-back + real call test.
- Health: domain-appropriate evidence and governance validation.

### TruthState

Decision Compass uses domain-neutral truth states:

- `reflection` — symbolic or intuitive input only.
- `needs_evidence` — a review question exists but evidence is insufficient.
- `evidence_found` — relevant evidence exists but no conclusion has been verified.
- `action_proposed` — an action is recommended to the owning module.
- `blocked` — required evidence, access, approval, or dependency is missing.
- `verified` — the owning module's verification gate passed.
- `rejected` — evidence contradicted the proposed interpretation or action.
- `superseded` — a newer record replaces this decision context.

Only evidence and module verification may move a record to `verified`.

## Data Contracts

Decision Compass should live in a new domain package, proposed as `packages/decision-compass`.

Conceptual TypeScript contracts:

```ts
export type DecisionTruthState =
  | 'reflection'
  | 'needs_evidence'
  | 'evidence_found'
  | 'action_proposed'
  | 'blocked'
  | 'verified'
  | 'rejected'
  | 'superseded';

export type DecisionRisk = 'low' | 'medium' | 'high' | 'critical';

export type DecisionSignalKind =
  | 'symbolic'
  | 'intuition'
  | 'observation'
  | 'user-note'
  | 'ai-reflection';

export type DecisionEvidenceRef = {
  kind: string;
  sourceModule: string;
  sourceId: string;
  label: string;
  verifiedAt?: string;
};

export type DecisionCompassRecord = TenantScope & {
  id: string;
  createdBy: string;
  createdAt: string;
  signalKind: DecisionSignalKind;
  signalLabel: string;
  signalText: string;
  interpretation: string;
  targetModule: string | null;
  evidenceRefs: DecisionEvidenceRef[];
  risk: DecisionRisk;
  proposedAction: string | null;
  verificationGate: string[];
  truthState: DecisionTruthState;
  verifiedBy: string | null;
  verifiedAt: string | null;
};
```

The package must provide pure validation functions for allowed truth-state transitions. UI code must not be able to directly set arbitrary truth states.

## Persistence

Persist records in Supabase `atlas-core`.

Proposed tables:

### `decision_compass_records`

Fields:
- `id uuid primary key`
- `tenant_id text not null`
- `organization_id text not null`
- `created_by uuid not null`
- `created_at timestamptz not null default now()`
- `signal_kind text not null`
- `signal_label text not null`
- `signal_text text not null`
- `interpretation text not null`
- `target_module text null`
- `risk text not null`
- `proposed_action text null`
- `verification_gate jsonb not null default '[]'`
- `truth_state text not null`
- `verified_by uuid null`
- `verified_at timestamptz null`

### `decision_compass_evidence_refs`

Fields:
- `id uuid primary key`
- `record_id uuid not null references decision_compass_records(id)`
- `source_module text not null`
- `source_kind text not null`
- `source_id text not null`
- `label text not null`
- `verified_at timestamptz null`

### RLS requirements

- Every read/write must be constrained to the active organization membership.
- A user cannot attach a record from another tenant or organization.
- `verified` transitions require a server-side validated verification result or an authorized reviewer path.
- Service-role operations remain server-side only.

## Permissions

Introduce domain-specific permissions rather than reusing Accounting permissions:

- `decision.read`
- `decision.create`
- `decision.review`
- `decision.verify`
- `decision.admin`

The initial authenticated owner can receive all permissions through the existing ATLAS Identity/organization membership model. Future users must be granted only what their role requires.

## UI

Primary route:

`/governance/decision-compass`

Protected by `RequireAtlasIdentity` or the current canonical identity guard.

### Main page sections

1. **Today's Signal**
   - signal kind;
   - label;
   - original text;
   - explicit badge: `Reflection, not evidence`.

2. **Interpretation**
   - neutral review question;
   - target ATLAS module;
   - no predictive language presented as fact.

3. **Evidence**
   - linked evidence records;
   - source module;
   - provenance status;
   - empty state: `No evidence attached`.

4. **Risk & Proposed Action**
   - risk level;
   - proposed next action;
   - owning module.

5. **Verification Gate**
   - checklist of required evidence;
   - state of each gate;
   - no automatic completion from symbolic input.

6. **Truth State**
   - visible current state;
   - transition history;
   - actor and timestamp for verified transitions.

### Daily mapping example

For the approved 2026-09-08 reading:

- `The Strength` → review governance, permissions, and stability.
- `Nine of Pentacles` → inspect financial independence and resource efficiency.
- `The Chariot` → prioritize a small number of execution-critical items.
- `Queen of Swords` → demand explicit evidence before conclusions.
- `Six of Cups` → check reusable prior work before rebuilding.
- `The Moon` → flag uncertainty and incomplete information.
- `The World` → close only after verification gates pass.

These mappings remain reflection metadata. They cannot themselves satisfy an evidence reference or verification gate.

## Action Boundary

Decision Compass may:
- create review questions;
- prioritize investigation;
- attach existing evidence references;
- propose an action;
- show missing gates;
- record the owning module's verified result.

Decision Compass may not directly:
- approve or send payments;
- deploy production code;
- alter infrastructure;
- send email or external communications;
- make clinical decisions;
- change legal filings;
- enable telecom forwarding;
- change payroll;
- mark any external state as verified without independent confirmation.

All privileged execution remains with the owning ATLAS module and its existing approval/audit rules.

## Error Handling

- Missing evidence must produce `needs_evidence`, not an inferred conclusion.
- Failed evidence retrieval must produce `blocked`, not `no evidence exists`.
- Scope mismatch must hard-fail.
- Invalid truth-state transitions must hard-fail.
- A revoked or expired identity session must block the route and writes.
- Supabase failures must remain visible and must never be replaced by demo success states.

## Auditability

Every state transition should record:
- record ID;
- previous state;
- next state;
- actor ID;
- timestamp;
- evidence references involved;
- reason;
- target module.

The audit record is immutable after creation.

## Testing Strategy

### Unit tests

- allowed truth-state transitions;
- forbidden direct `reflection → verified` transition;
- risk validation;
- tenant-scope validation;
- evidence-ref validation;
- verification-gate evaluation.

### Integration tests

- protected route requires ATLAS Identity;
- active organization membership is required;
- one tenant cannot read another tenant's records;
- symbolic signal alone cannot create `verified` state;
- attaching evidence can move to `evidence_found` but not automatically to `verified`;
- verification requires gate completion;
- Supabase failure is surfaced truthfully.

### Database tests

- RLS tenant isolation;
- server-side transition enforcement;
- invalid enum/state rejection;
- immutable audit entries.

### Production verification

No production-ready claim until:
- migration applied to the intended Supabase project;
- RLS verified with positive and negative tests;
- authenticated route verified;
- frontend build passes;
- relevant CI gates pass;
- deployed route is reachable through the approved production path;
- production health evidence is recorded.

## Implementation Boundaries

First implementation milestone:
- `packages/decision-compass` domain model and transition engine;
- Supabase migration + RLS;
- repository adapter;
- protected `/governance/decision-compass` route;
- daily record creation/review UI;
- evidence references;
- gate checklist;
- audit events;
- tests.

Out of scope for the first milestone:
- automatic tarot generation;
- autonomous privileged actions;
- cross-module write execution;
- predictive scoring from symbolic inputs;
- replacing any owning module's evidence or approval process.

## Success Criteria

The milestone is successful when a signed-in ATLAS user can create a daily reflection, map it to a target module, attach independent evidence, see risk and proposed actions, and advance the record only through valid evidence-gated truth states.

The system must make it impossible for a symbolic signal alone to become `verified` or to trigger a privileged operation.
