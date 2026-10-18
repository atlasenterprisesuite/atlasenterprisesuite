# ATLAS Stewardship Governance Design

Date: 2026-10-05  
Status: Design specification for review  
Repository: `atlasenterprisesuite/atlasenterprisesuite`  
Branch: `docs/atlas-stewardship-governance-spec-20261005`

## Objective

Establish one cross-platform governance model for ATLAS based on the sequence:

`Purpose -> Identity -> Trust -> Responsibility -> Service -> Evidence -> Legacy`

The model formalizes how people, service accounts, AI agents, automations and provider adapters receive authority, exercise it and leave verifiable evidence.

It must strengthen the existing ATLAS identity, tenant, RBAC, policy, audit and evidence controls. It must not create a second authorization system or an ideological, religious or social-status classification of users.

## Naming and product boundary

The implementation name is **ATLAS Stewardship Governance**.

The word `steward` means an actor entrusted with a bounded responsibility. It does not mean a preferred class of person and does not imply religious status, moral superiority, employment rank or permanent entitlement.

ATLAS must not:

- store or infer whether a person is spiritually or religiously "chosen";
- grant access based on religion, belief, ethnicity, politics or another protected characteristic;
- use stewardship status as a bypass around RBAC;
- create an opaque social score;
- present unverifiable trust or readiness claims.

## Existing architecture to preserve

ATLAS already establishes the canonical platform sequence:

`Identity & Tenant -> RBAC / Policy -> Audit & Evidence -> ATLAS Graph -> Data Fabric -> Knowledge -> AI -> Automation -> Security -> Apps`

This design extends that sequence rather than replacing it.

Existing authoritative controls remain authoritative:

- tenant and organization scope;
- `AtlasPermission`, `hasPermission` and `authorize` in `packages/core`;
- Supabase authentication and RLS where used;
- server-side authorization checks;
- audit events and evidence records;
- provider readiness checks;
- release and production verification gates.

## Core principle

Stewardship never creates permission by itself.

An action is executable only when all required gates pass:

`valid identity`
`AND tenant/organization scope`
`AND canonical RBAC permission`
`AND applicable stewardship policy`
`AND required evidence/assurance`
`AND provider/readiness gate when applicable`

Missing evidence for a high-risk action produces a fail-closed decision.

## Governance chain

### 1. Purpose

Every governed actor or automation has an explicit bounded purpose.

Examples:

- reconcile accounts for organization X;
- approve payroll within an assigned organization;
- execute an ATLAS AI support workflow;
- manage a production deployment;
- route a network operation;
- review a security event.

Purpose is descriptive and constraining. It does not grant authority.

### 2. Identity

Every state-changing action must resolve to a concrete actor identity.

Supported actor classes:

- human user;
- service identity;
- AI agent;
- automation/runtime;
- external provider adapter.

Each actor is bound to the existing tenant/organization model where the operation is tenant-scoped.

### 3. Trust

ATLAS represents trust as **evidence-backed assurance**, not reputation or popularity.

Initial assurance states:

- `baseline` — authenticated identity with normal RBAC evaluation;
- `verified` — additional required verification evidence exists;
- `elevated` — an explicitly governed high-assurance session or execution context exists for a limited action/window.

Assurance state must be derived from explicit evidence such as identity verification, recent re-authentication, approved service credentials, hardware/session assertions, provider verification or an approved control-plane workflow.

No numerical "trust score" is introduced in this design.

### 4. Responsibility

A responsibility binds purpose to scope and expected action boundaries.

A responsibility record may include:

- actor identifier;
- organization/tenant scope;
- purpose code;
- required canonical permission;
- risk class;
- approval or separation-of-duties requirements;
- validity window;
- evidence requirements.

Responsibility cannot broaden the actor's canonical RBAC permissions.

### 5. Service

A governed action must map to a real ATLAS capability, API, domain command or workflow.

No stewardship UI may create fake actions, placeholder execution, console-only controls or fabricated provider states.

### 6. Evidence

Sensitive decisions and state-changing actions must produce evidence sufficient to answer:

- who acted;
- for which tenant/organization;
- what purpose applied;
- which permission was required;
- which stewardship policy was evaluated;
- what decision was made;
- what evidence supported the decision;
- what resource changed;
- when the action occurred;
- which correlation/request identifier links the event to downstream systems.

Evidence references should be durable identifiers or hashes where possible. Secrets, raw tokens and sensitive authentication material must never be copied into audit records.

### 7. Legacy

Legacy is the durable accountability layer: the resulting change history, provenance and reviewable evidence that outlives a single session.

For ATLAS this maps to existing durable records such as:

- audit history;
- Git/GitHub change history;
- approval records;
- financial/posting history;
- provider event records;
- production release evidence;
- security incident history.

Legacy is not a new database or separate archive in phase one.

## Risk classes

Stewardship policies use simple risk classes so requirements are explicit and testable.

### R0 — read-only / low impact

Examples: permitted reads, status inspection, non-sensitive navigation.

Requirements: identity + tenant scope + canonical permission.

### R1 — normal state change

Examples: ordinary CRUD within assigned business scope.

Requirements: R0 requirements + audit event.

### R2 — sensitive state change

Examples: payroll approval, financial posting, privileged configuration, production-affecting automation, sensitive health/security workflow.

Requirements: R1 requirements + `verified` assurance and policy-specific evidence.

### R3 — critical / irreversible / cross-boundary

Examples: privileged production release, destructive security operation, large-value or irreversible financial operation, control-plane action affecting multiple tenants or infrastructure boundaries.

Requirements: R2 requirements + `elevated` assurance, explicit approval/separation-of-duties where required, and fail-closed evidence validation.

The risk class does not replace domain-specific controls. A domain may impose stricter rules.

## Authorization integration

Phase one should extend the existing `packages/core` authorization layer with a composable policy evaluation interface rather than modify every module independently.

Proposed conceptual interface:

```ts
export type StewardshipAssurance = 'baseline' | 'verified' | 'elevated';
export type StewardshipRisk = 'R0' | 'R1' | 'R2' | 'R3';

export type StewardshipContext = {
  actorId: string;
  actorType: 'human' | 'service' | 'agent' | 'automation' | 'provider';
  purpose: string;
  assurance: StewardshipAssurance;
  evidenceRefs: readonly string[];
  correlationId: string;
};

export type StewardshipRequirement = {
  risk: StewardshipRisk;
  minimumAssurance: StewardshipAssurance;
  purpose?: string;
  evidenceRequired?: boolean;
};
```

A higher-level authorization function may compose the existing `authorize(...)` result with the stewardship requirement, but the existing tenant and RBAC decision must remain a prerequisite.

Conceptually:

```ts
authorizeGovernedAction(actor, request, stewardship)
```

must evaluate in this order:

1. tenant/organization scope;
2. canonical permission;
3. purpose compatibility;
4. assurance requirement;
5. required evidence;
6. domain/provider readiness;
7. auditable decision.

A failure at any mandatory gate denies the operation.

## AI and agent governance

ATLAS AI agents use the same controls as human/service actors plus agent-specific restrictions.

Every state-changing agent action must have:

- explicit mission/purpose;
- tenant and organization scope;
- canonical agent/domain permission;
- maximum risk class allowed for autonomous execution;
- evidence/correlation identifier;
- tool/provider readiness;
- auditable outcome.

Default policy:

- R0: autonomous when authorized;
- R1: autonomous only where the workflow is explicitly enabled;
- R2: requires verified assurance and domain policy; approval may be required;
- R3: cannot be silently self-authorized by an agent and must use the domain's explicit approval/control-plane gate.

An AI agent cannot grant itself a new permission, raise its own assurance level, change its tenant scope or manufacture evidence.

## Domain application

### ATLAS Enterprise

Use stewardship policy to constrain sensitive administrative operations, cross-module automation and organization-wide configuration.

### ATLAS Finance / Accounting / Payroll

Use R2/R3 policies for posting, close, payroll approval, disbursement and other high-impact operations as determined by existing domain rules.

Stewardship is additive; accounting controls and segregation of duties remain authoritative.

### ATLAS Network / Connect

Apply policy to carrier/provider configuration, routing control, provisioning and infrastructure-affecting actions. Provider connectivity remains fail-closed until server-verified.

### ATLAS Health

Apply stewardship only to the user's authorized ATLAS Health workflows. Existing privacy, consent and access boundaries remain authoritative. Stewardship must not broaden access to health data.

### ATLAS Security

Apply R2/R3 gates to privileged security actions, destructive operations, credential/security configuration and infrastructure controls.

### ATLAS AI

Apply the agent governance rules above to tool use, automation and cross-domain actions.

## Data model direction

Phase one should avoid a broad new persistence model unless repository inspection during implementation proves it necessary.

Prefer:

- existing identity/session claims for actor identity;
- existing tenant/organization scope;
- existing permission arrays/roles;
- short-lived governed execution context for assurance and purpose;
- existing audit/evidence infrastructure for durable records.

If persistence is required, add the smallest additive schema necessary for governed responsibility assignments or evidence references. Do not duplicate users, roles, permissions or tenant membership.

## Audit event extension

Governed audit events should be capable of carrying additive metadata such as:

```ts
{
  purpose,
  stewardshipRisk,
  assurance,
  policyDecision,
  evidenceRefs,
  correlationId
}
```

This metadata must be non-secret and tenant-safe.

Denied sensitive operations should also be auditable when doing so does not expose security-sensitive detail to an unauthorized caller.

## UI and UX

No new marketing-style dashboard is required for phase one.

Where stewardship state is exposed in existing operational surfaces, the UI must show factual control state, for example:

- `Identity verified`;
- `Additional verification required`;
- `Approval required`;
- `Permission denied`;
- `Evidence unavailable`;
- `Provider not verified`.

The UI must not label a user as spiritually "chosen", superior, elite or permanently trusted.

Any future governance console must reuse ATLAS design tokens, shell, identity guard and existing navigation patterns.

## Privacy and fairness

Stewardship decisions must rely only on information relevant to authorization and operational assurance.

Do not use protected or sensitive personal characteristics as trust factors.

Do not infer behavioral morality, personality, faith, ideology or social worth.

An actor must not receive broader access merely because they have performed many actions historically.

## Failure behavior

The system fails closed when a required authorization, assurance, evidence, approval or provider-readiness check is absent or indeterminate for R2/R3 operations.

Expected denial reasons should be machine-readable and map to safe user-facing states, for example:

- `scope_mismatch`;
- `permission_denied`;
- `purpose_mismatch`;
- `assurance_insufficient`;
- `evidence_required`;
- `approval_required`;
- `provider_unverified`.

Unknown state is never converted to success.

## Compatibility and migration

The first implementation must be additive.

Existing calls to `authorize(...)` continue to work unchanged for flows not yet migrated.

Governed flows opt into the composed authorization path incrementally.

No existing module should be weakened or blocked globally simply because it has not yet adopted stewardship metadata.

## Initial implementation scope

The first implementation wave should provide the reusable core only:

1. stewardship types and deterministic policy evaluation in `packages/core`;
2. unit tests covering allow/deny behavior and failure reasons;
3. additive audit metadata types/helpers if the existing audit model requires them;
4. one representative integration with the ATLAS agentic core to prove AI-action governance without rewriting the full agent runtime;
5. documentation for domain adoption.

Full migration of Finance, Health, Network, Security and all Enterprise modules is explicitly outside wave one and should occur as separate bounded integrations after the core is verified.

## Test strategy

Implementation must follow TDD.

Required unit coverage includes:

- canonical RBAC denial cannot be overridden by stewardship;
- tenant mismatch remains denied;
- R0 baseline allow when canonical authorization passes;
- R2 denies baseline assurance;
- R2 allows verified assurance when required evidence exists;
- R3 denies absent explicit approval/elevated assurance when configured;
- missing required evidence fails closed;
- purpose mismatch denies;
- AI agent cannot self-elevate assurance through request input;
- assurance ordering is deterministic;
- denial reasons are stable and machine-readable;
- no secret values are included in emitted audit metadata.

Integration coverage should prove one real agentic-core path uses the new policy without bypassing existing permission checks.

Regression coverage must preserve current `hasPermission` and `authorize` semantics.

## Security acceptance criteria

The change is acceptable only when evidence shows:

1. no second identity store is introduced;
2. no second RBAC source of truth is introduced;
3. stewardship cannot grant a permission absent from canonical RBAC;
4. tenant isolation is preserved;
5. R2/R3 missing evidence fails closed;
6. AI agents cannot self-authorize or self-elevate;
7. audit metadata contains no credentials or secret material;
8. existing authorization tests remain green.

## Release acceptance criteria

Before production can be claimed:

1. RED tests are committed before implementation behavior;
2. focused unit/integration tests pass;
3. `npm run typecheck` passes;
4. full applicable test suite passes;
5. `npm run build` passes;
6. security/repository gates remain green;
7. the implementation PR is reviewed and merged to `main`;
8. deployed production commit matches the merged commit;
9. P0 production verification completes without a blocking failure.

Until all applicable gates have evidence, status must stop at the last verified stage.

## Non-goals for wave one

- replacing Supabase Auth or RLS;
- replacing `AtlasPermission` or canonical domain permissions;
- universal migration of every ATLAS module;
- a social/reputation score;
- religious classification or belief inference;
- a new standalone governance application;
- fabricating production/provider readiness;
- autonomous R3 approval by an AI agent.

## Success definition

ATLAS Stewardship Governance succeeds when a sensitive action can be traced through one deterministic chain:

`Purpose -> Identity -> Tenant -> RBAC -> Stewardship Policy -> Assurance/Evidence -> Domain Gate -> Action -> Audit/Evidence`

and no stewardship concept can bypass the existing ATLAS security boundaries.