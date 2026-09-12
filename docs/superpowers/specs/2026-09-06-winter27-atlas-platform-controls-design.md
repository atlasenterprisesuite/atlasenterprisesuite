# Winter '27-Informed ATLAS Platform Controls Design

Date: 2026-09-06
Status: Approved in chat; repository-hardened; implementation plans complete
Repository: `atlasenterprisesuite/atlasenterprisesuite`

## 1. Purpose

Translate material Salesforce Winter '27 platform changes into provider-neutral ATLAS architecture improvements without copying Salesforce proprietary code, UI, or implementation details.

This design strengthens ATLAS in five areas:

1. shared cross-module authorization and audit contracts;
2. OAuth/OIDC-first enterprise integrations;
3. provider endpoint resolution that avoids brittle instance URLs;
4. versioned, channel-aware agent governance;
5. policy-driven ATLAS Voice recording and transcript provenance.

GitHub remains the operational source of truth and arbitration surface for ChatGPT-, Gemini-, Copilot-, and human-authored changes. No model wins by assertion; changes win by repository compatibility, security, tests, CI, and review evidence.

## 2. Architectural Principles

- Reuse existing ATLAS tenancy, permissions, audit, navigation, and provider abstractions where they already exist.
- Do not create a Salesforce-specific security architecture. Salesforce is a reference provider/adapter, not the platform authority.
- Do not introduce parallel RBAC, audit, OAuth, Voice, or agent-governance implementations.
- Preserve current Accounting behavior and the already-approved granular ATLAS Voice permission vocabulary.
- Never report `connected`, `recording`, `online`, `ready`, or similar live states unless backed by real provider/runtime evidence.
- Sensitive actions must be authorized server-side and emit audit events when they change durable or security-relevant state.
- ATLAS Manager remains the infrastructure/deployment authority and must be reused for provider state, deployment evidence, permissions, and audit where applicable.

## 3. Current-State Findings

`packages/core` currently exposes shared tenant scope utilities but its permission type is still Accounting-specific. That is insufficient for cross-module Voice, integrations, agents, CRM, Health, Finance, and Manager controls.

Existing architecture documentation already requires ATLAS Manager to reuse auth, tenancy, RBAC, audit, navigation, and provider integrations instead of duplicating them.

The existing ATLAS Personal Voice design already establishes a provider-aware Voice domain and explicitly forbids fake provider readiness. This design extends that direction with recording-policy and transcript-provenance contracts rather than replacing it.

The repository already contains `.github/workflows/atlas-consensus-ci.yml` with integration/UX, architecture/build, and security/unit-test gates. This design reuses that workflow as the GitHub evidence gate instead of creating a parallel arbitration workflow.

## 4. Shared Authorization Model

### 4.1 Goal

Create a provider-neutral authorization contract in `packages/core` that supports all ATLAS modules while retaining the existing Accounting permission strings.

### 4.2 Permission Shape

Adopt namespaced permission identifiers. Initial shared vocabulary includes:

- existing Accounting permissions, including `accounting.admin`;
- `audit.read`;
- `integrations.read`, `integrations.write`, `integrations.admin`;
- `agents.read`, `agents.write`, `agents.publish`, `agents.admin`;
- `security.admin`;
- the already-approved granular Personal Voice permissions, including `voice.personal.read`, `voice.personal.create`, `voice.personal.record`, `voice.personal.generate`, `voice.personal.use`, `voice.personal.delete`, `voice.apple.request`, `voice.apple.use`, and `voice.integration.manage`;
- `voice.transcript.read` for governed transcript access.

The implementation may expand this set only when a concrete workflow requires it.

### 4.3 Authorization Contract

Replace Accounting-only authorization helpers with generic helpers that accept shared ATLAS permissions. Preserve backward compatibility for Accounting consumers.

Authorization requirements:

- tenant and organization scope must match;
- UI visibility may depend on permissions, but backend authorization remains authoritative;
- admin wildcard behavior must be explicit and namespaced;
- privileged cross-module actions must not silently inherit from an unrelated module admin role;
- denials must be testable and auditable where appropriate.

## 5. OAuth/OIDC-First Integration Policy

### 5.1 Default Policy

All new enterprise integrations must use OAuth 2.0, OIDC, signed service credentials, or another explicitly approved modern token flow.

Username/password-style provider authentication is forbidden by default for new integrations.

Legacy authentication may exist only when all of the following are true:

- the provider has no safer supported alternative;
- the exception is explicitly declared in configuration;
- secrets are stored outside source control;
- the exception is auditable;
- the integration UI does not represent the connection as healthy unless a real verification succeeds.

### 5.2 Connection State

Standardize integration states:

- `unconfigured`
- `authorizing`
- `connected`
- `degraded`
- `expired`
- `revoked`
- `error`

A connection becomes `connected` only after provider verification.

## 6. Provider Endpoint Resolution

### 6.1 Goal

Prevent hard-coded or stale provider instance URLs from becoming a platform dependency.

### 6.2 Resolver Contract

Introduce a provider endpoint resolver that can:

- accept a provider-authorized base URL or discovery response;
- normalize host and path safely;
- reject insecure protocols where not explicitly allowed;
- update persisted endpoint metadata after verified redirects or provider migrations;
- avoid embedding environment-specific hosts directly in feature code;
- expose the effective endpoint through a typed adapter contract.

Salesforce-specific instance/domain handling should live in its adapter, while the resolver rules remain generic.

## 7. Agent Governance and Versioning

### 7.1 Agent Versions

Agent definitions must be immutable once published. Any edit creates a new version.

Each version includes:

- agent ID;
- version ID;
- parent version;
- status (`draft`, `review`, `approved`, `published`, `retired`);
- provider/model metadata;
- tool capabilities;
- permission requirements;
- channel instructions;
- created-by actor;
- created-at timestamp;
- provenance/audit metadata through the repository and publication audit event.

Publication requires the scoped `agents.publish` permission and creates audit evidence.

### 7.2 Channel-Aware Instructions

Agents may define behavior overlays for channels such as:

- web;
- mobile;
- voice;
- WhatsApp;
- email;
- internal operator console.

Channel overlays may refine presentation and interaction behavior but cannot bypass core policy, safety, authorization, or tenant constraints.

### 7.3 Compare and Merge

Agent version comparison must surface:

- instruction changes;
- tool capability changes;
- provider/model changes;
- permission changes;
- channel-specific changes.

Merge behavior must never silently choose between conflicting permission, safety, provider/model, or tool-capability changes. Those conflicts require explicit resolution.

## 8. GitHub Arbitration Rule

GitHub is the evidence and decision surface for changes proposed by ChatGPT, Gemini, Copilot, or humans.

A competing implementation is preferred only if it performs better against the following gates, in order:

1. architecture compatibility;
2. security and authorization correctness;
3. tenant/data isolation;
4. tests and CI;
5. regression safety;
6. maintainability and simplicity;
7. UX and performance.

Model identity is not a tie-breaker.

The existing `ATLAS Consensus CI` workflow remains the automated gate. Pull requests, commits, tests, CI output, and documented review evidence preserve the rationale; conversational claims alone do not.

## 9. ATLAS Voice Recording and Transcript Governance

### 9.1 Recording State

Introduce explicit recording state:

- `unsupported`
- `disabled`
- `awaiting_consent`
- `recording`
- `paused`
- `stopped`
- `error`

The runtime must not display `recording` unless the provider/device confirms it.

### 9.2 Recording Policy

A recording request must evaluate:

- tenant policy;
- user permission (`voice.personal.record`);
- provider/device capability;
- consent requirement;
- applicable channel/device state.

Recording-policy changes create metadata-only audit evidence.

No silent fallback from a denied/unsupported recording request to simulated recording is allowed.

### 9.3 Transcript Provenance

A transcript record must preserve:

- conversation/session ID;
- provider or local runtime source;
- source timestamps when available;
- generation/completion timestamp;
- whether the transcript is partial or complete;
- recording linkage when applicable;
- tenant/organization scope;
- actor/user ownership;
- audit metadata for material access or mutation.

Transcript access requires `voice.transcript.read` and emits metadata-only access audit evidence.

## 10. Module Boundaries

### `packages/core`

Owns:

- tenant scope;
- shared permission types and authorization helpers;
- audit contract primitives;
- integration connection-state primitives;
- provider endpoint resolver primitives.

### `packages/voice`

Owns:

- Voice profile/provider contracts;
- recording state and policy evaluation;
- transcript provenance types;
- provider capability adaptation.

### `packages/agents`

Because no implemented orchestration package currently exists, create one provider-neutral governance package rather than embedding agent versioning in `apps/web`.

It owns:

- immutable agent versions;
- lifecycle/publication rules;
- channel overlays;
- compare/merge contracts;
- publication audit evidence.

### `apps/web`

Consumes domain contracts. It must not become the source of truth for permissions, recording state, provider connection state, or agent publication rules.

## 11. Data and Persistence Rules

- Do not invent production metrics or connection states.
- Provider tokens/secrets never live in repository files or browser-persisted plaintext.
- Persistent records must include tenant and organization scope.
- Agent publication, integration credential changes, recording-policy changes, and transcript-sensitive actions emit audit events when implemented.
- Any future Supabase schema must preserve tenant isolation and apply server-side authorization/RLS where appropriate.

## 12. Failure Handling

Expected explicit failure states include:

- OAuth authorization failure;
- expired/revoked token;
- provider endpoint migration failure;
- permission denied;
- tenant mismatch;
- unsupported recording capability;
- missing recording consent;
- incomplete transcript;
- conflicting agent-version merge;
- provider unavailable.

Errors must be surfaced as real states, not replaced with fabricated success content.

## 13. Testing Strategy

### Core authorization

- preserve existing Accounting permission behavior;
- authorize correct namespaced permissions;
- deny unrelated module-admin privilege escalation;
- reject tenant/organization mismatch.

### OAuth/integrations

- reject unsupported legacy auth by default;
- verify state semantics;
- prevent `connected` before provider verification;
- handle expiry/revocation in adapters when added.

### Endpoint resolution

- normalize valid endpoints;
- reject insecure/invalid hosts;
- accept verified provider migration/redirect behavior;
- ensure feature code does not require hard-coded instance URLs.

### Agent governance

- valid lifecycle transitions;
- permission-gated publication;
- immutable published versions;
- publication audit evidence;
- channel overlay inheritance;
- compare output correctness;
- explicit conflict handling for permissions/safety/provider/model/tool changes.

### Voice

- recording permission enforcement;
- consent gating;
- capability enforcement;
- recording-policy audit evidence;
- transcript provenance completeness;
- transcript read authorization/audit;
- no fake recording/connected states.

### Regression gates

- existing Accounting tests remain passing;
- typecheck;
- build;
- affected unit/integration tests;
- no secrets committed;
- no duplicate RBAC/provider state implementations introduced.

## 14. Delivery Sequence

Implementation proceeds in this order:

1. `docs/superpowers/plans/2026-09-06-atlas-core-platform-controls.md`;
2. `docs/superpowers/plans/2026-09-06-atlas-agent-governance.md`;
3. existing `docs/superpowers/plans/2026-09-06-atlas-personal-voice-core-web.md`, skipping its superseded permission Task 1;
4. `docs/superpowers/plans/2026-09-06-atlas-voice-governance-extension.md`;
5. adapters/UI consumers only after the provider-neutral contracts are passing;
6. `ATLAS Consensus CI` and PR review;
7. deployment only after repository gates and ATLAS production rules permit it.

## 15. Non-Goals

This design does not:

- clone Salesforce UI or proprietary code;
- make Salesforce the ATLAS platform authority;
- activate a Salesforce integration without credentials and verification;
- redesign all of ATLAS Orchestrator in one change;
- replace stronger existing functionality;
- authorize production deployment before tests and repository gates pass.

## 16. Acceptance Criteria

The design is ready for execution when:

- shared authorization is provider/module neutral while preserving Accounting compatibility;
- OAuth/OIDC-first policy is explicit;
- endpoint resolution eliminates hard-coded provider-instance dependence;
- agent versions are immutable and channel-aware;
- publication is scoped, permission-gated, and auditable;
- merge conflicts for sensitive agent changes require explicit resolution;
- Voice recording and transcript states are evidence-based, permission-aware, and auditable;
- GitHub arbitration is test/CI/review driven;
- no duplicate architecture is introduced.
