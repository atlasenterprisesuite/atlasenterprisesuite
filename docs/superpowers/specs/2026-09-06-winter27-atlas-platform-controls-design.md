# Winter '27-Informed ATLAS Platform Controls Design

Date: 2026-09-06
Status: Approved in chat; hardened after repository review; pending implementation plan
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

`packages/core` currently exposes shared tenant scope utilities but its permission type is Accounting-specific. That prevents safe cross-module authorization without unsafe casts.

ATLAS Manager already requires reuse of auth, tenancy, RBAC, audit, navigation, and provider integrations instead of parallel implementations.

The existing ATLAS Personal Voice design already establishes `packages/voice`, granular Voice permissions, provider capability checks, consent, ownership, and truthful readiness rules. This design extends that architecture with runtime recording-policy and transcript-provenance contracts; it does not replace the existing Voice model.

No implemented provider-neutral agent registry/orchestration package was found in the current default-branch code search. Agent-governance implementation must therefore reuse a stronger approved package if one appears before implementation; otherwise it may create one canonical provider-neutral package during its own implementation slice.

## 4. Shared Authorization Model

### 4.1 Goal

Generalize authorization so shared ATLAS code can evaluate namespaced permissions from multiple modules without replacing module-specific vocabularies.

### 4.2 Permission Compatibility

Existing Accounting permissions remain valid:

- `accounting.read`
- `accounting.write`
- `accounting.post`
- `accounting.close`
- `accounting.admin`
- `audit.read`

Existing approved Voice permissions remain valid:

- `voice.personal.read`
- `voice.personal.create`
- `voice.personal.record`
- `voice.personal.generate`
- `voice.personal.use`
- `voice.personal.delete`
- `voice.apple.request`
- `voice.apple.use`
- `voice.integration.manage`

Additional namespaces may be introduced only for concrete workflows, for example `integrations.*`, `agents.*`, and `security.*`.

The shared core must support namespaced permission strings without forcing every module into one coarse permission set.

### 4.3 Authorization Contract

Evolve Accounting-only helpers into generic shared authorization helpers while preserving current Accounting consumers.

Requirements:

- tenant and organization scope must match;
- UI visibility may derive from permissions, but backend authorization remains authoritative;
- admin behavior must be explicit and namespaced;
- privileged actions must not silently inherit from an unrelated module-admin role;
- ownership/consent checks remain separate from permission checks where the domain requires them;
- denials must be testable and auditable where appropriate.

## 5. OAuth/OIDC-First Integration Policy

### 5.1 Default Policy

All new enterprise integrations must use OAuth 2.0, OIDC, signed service credentials, or another explicitly approved modern token flow.

Username/password-style provider authentication is forbidden by default for new integrations.

A legacy-auth exception is permitted only when:

- the provider has no safer supported alternative;
- the exception is explicitly declared in configuration;
- secrets stay outside source control;
- the exception is auditable;
- the integration is never shown as healthy until real verification succeeds.

### 5.2 Connection State

Standardize provider connection states:

- `unconfigured`
- `authorizing`
- `connected`
- `degraded`
- `expired`
- `revoked`
- `error`

`connected` requires provider evidence. UI state alone is never proof of connectivity.

## 6. Provider Endpoint Resolution

### 6.1 Goal

Prevent hard-coded or stale provider instance URLs from becoming an ATLAS platform dependency.

### 6.2 Resolver Contract

A provider-neutral endpoint resolver must be able to:

- accept an authorized base URL or provider discovery result;
- normalize scheme, host, and path safely;
- reject insecure protocols unless explicitly permitted for a controlled environment;
- handle verified redirects/provider migrations;
- persist only non-secret endpoint metadata through approved configuration channels;
- prevent feature code from embedding environment-specific provider hosts;
- expose the effective endpoint through a typed adapter boundary.

Salesforce-specific domain/instance semantics belong inside a Salesforce adapter. Shared resolver rules remain provider-neutral.

## 7. Agent Governance and Versioning

### 7.1 Agent Versions

Published agent definitions are immutable. Any modification creates a new version.

Each version records:

- agent ID;
- version ID;
- parent version;
- status: `draft`, `review`, `approved`, `published`, or `retired`;
- provider/model metadata;
- tool capabilities;
- permission requirements;
- channel instructions;
- created-by actor;
- created-at timestamp;
- provenance/audit metadata.

### 7.2 Channel-Aware Instructions

Agent behavior may include overlays for channels such as web, mobile, voice, WhatsApp, email, or an internal operator console.

Channel overlays may refine presentation and interaction behavior but may not bypass shared policy, safety, authorization, ownership, consent, or tenant constraints.

### 7.3 Compare and Merge

Version comparison must surface changes to:

- instructions;
- tool capabilities;
- provider/model configuration;
- permissions;
- channel overlays.

Merge must never silently resolve conflicts involving permissions, safety, ownership/consent, or tool capabilities. Those require explicit resolution and auditable evidence.

## 8. GitHub Arbitration Rule

GitHub is the evidence and decision surface for competing changes proposed by ChatGPT, Gemini, Copilot, or humans.

A competing implementation is preferred only when it performs better against these gates, in order:

1. architecture compatibility;
2. security and authorization correctness;
3. tenant/data isolation;
4. tests and CI;
5. regression safety;
6. maintainability and simplicity;
7. UX and performance.

Model identity is never a tie-breaker.

Rationale must survive in repository evidence such as commits, PRs, tests, CI results, or review notes rather than conversational claims.

## 9. ATLAS Voice Recording and Transcript Governance

### 9.1 Relationship to Existing Voice Design

`packages/voice` remains the owner of Voice profiles, recording sessions, provider capabilities, consent, ownership, permissions, and Voice audit events.

The security gate remains:

`Identity → Tenant Scope → User Ownership → Permission → Consent Scope → Provider Capability → Audit`

This design adds runtime recording state and transcript provenance to that existing domain.

### 9.2 Recording Runtime State

A recording session may expose:

- `unsupported`
- `disabled`
- `awaiting_consent`
- `recording`
- `paused`
- `stopped`
- `error`

The runtime must not display `recording` unless the actual provider/device confirms it.

### 9.3 Recording Policy

A recording request evaluates:

- tenant policy;
- user ownership where applicable;
- existing granular Voice permission, including `voice.personal.record` for personal-voice capture or a future explicitly approved call-recording permission for call workflows;
- consent scope;
- provider capability;
- channel/device state.

No denied or unsupported request may fall back to simulated recording.

### 9.4 Transcript Provenance

A transcript record preserves:

- conversation/session ID;
- provider or local runtime source;
- source timestamps when available;
- completion timestamp;
- partial/complete state;
- recording linkage when applicable;
- tenant/organization scope;
- actor/user ownership;
- access policy reference;
- audit metadata for sensitive access or mutation.

A dedicated transcript permission must be added only when the concrete transcription/calls workflow is implemented; until then, access must follow the owning Voice workflow's approved permission/ownership/consent contract rather than inventing an incompatible permission name.

## 10. Module Boundaries

### `packages/core`

Owns shared primitives that already belong to core, including:

- tenant scope;
- generic namespaced-permission types/helpers;
- shared authorization result contracts;
- provider connection-state primitives if no stronger canonical integration package exists;
- endpoint-resolver primitives if no stronger canonical integration package exists.

If the approved ATLAS Manager `packages/governance` or `packages/integrations` structure is implemented before this work, permission/audit/integration responsibilities move to those canonical packages rather than being duplicated in `packages/core`.

### `packages/voice`

Owns:

- Voice profile/provider contracts;
- recording session/runtime state;
- recording policy evaluation;
- transcript provenance;
- consent/ownership integration;
- provider capability adaptation.

### Agent governance

Reuse an existing canonical orchestration/agent-registry package if implemented before this slice. If none exists, introduce one provider-neutral canonical package only after the implementation plan fixes its exact location.

It will own:

- immutable agent versions;
- channel overlays;
- compare/merge contracts;
- publication-state transitions.

### `apps/web`

Consumes domain contracts. It must not become the source of truth for permissions, recording state, provider connectivity, or agent publication rules.

### ATLAS Manager

Owns deployment/provider operational state and production verification. This design does not create a parallel deployment mechanism.

## 11. Data and Persistence Rules

- Do not invent production metrics or connection states.
- Tokens/secrets never live in repository files or browser-persisted plaintext.
- Persistent domain records include tenant/organization scope where applicable.
- Agent publication, integration credential/configuration changes, recording-policy changes, and transcript-sensitive actions emit audit events when the underlying domain marks them sensitive.
- Future Supabase persistence must preserve tenant isolation and server-side authorization/RLS where appropriate.
- Raw Voice audio must never be written into audit events.

## 12. Failure Handling

Expected explicit failures include:

- OAuth authorization failure;
- expired/revoked token;
- provider endpoint migration failure;
- permission denied;
- tenant mismatch;
- ownership/consent failure;
- unsupported recording capability;
- incomplete transcript;
- conflicting agent-version merge;
- provider unavailable.

Errors are represented truthfully and never replaced with fabricated success states.

## 13. Testing Strategy

### Core authorization

- preserve existing Accounting permission behavior;
- accept existing granular Voice permission vocabulary;
- authorize correct namespaced permissions;
- deny unrelated module-admin privilege escalation;
- reject tenant/organization mismatch.

### OAuth/integrations

- reject unsupported legacy auth by default;
- verify connection-state transitions;
- prevent `connected` before provider verification;
- handle expiry/revocation.

### Endpoint resolution

- normalize valid endpoints;
- reject insecure/invalid endpoints;
- support verified provider migration/redirect behavior;
- ensure feature code does not require hard-coded instance URLs.

### Agent governance

- immutable published versions;
- channel-overlay inheritance;
- compare output correctness;
- explicit conflict handling for permissions/safety/ownership/tool-capability changes.

### Voice

- preserve Personal Voice permission/consent/ownership contracts;
- recording-state evidence requirements;
- provider capability enforcement;
- transcript provenance completeness;
- no fake recording/connected states.

### Regression gates

- existing Accounting tests pass;
- existing Voice design assumptions remain valid;
- typecheck passes;
- production build passes;
- affected unit/integration tests pass;
- no secrets are committed;
- no duplicate RBAC, integration-state, or Voice-governance architecture is introduced.

## 14. Delivery Sequence

Implementation planning should order work as:

1. shared namespaced authorization evolution with Accounting compatibility;
2. provider connection-state and endpoint-resolution primitives in the canonical package boundary;
3. OAuth/OIDC policy contracts;
4. agent versioning/channel/merge contracts;
5. Voice recording-runtime and transcript-provenance extensions;
6. provider adapters and UI consumers;
7. tests and CI hardening;
8. GitHub review/arbitration and merge;
9. deployment only after ATLAS Manager and production gates permit it.

## 15. Non-Goals

This design does not:

- clone Salesforce UI or proprietary code;
- make Salesforce the ATLAS platform authority;
- activate Salesforce without credentials and real verification;
- redesign all ATLAS Orchestrator/Manager in one change;
- replace stronger existing functionality;
- weaken granular ATLAS Voice ownership/consent/permission rules;
- authorize production deployment before repository and ATLAS Manager gates pass.

## 16. Acceptance Criteria

The design is ready for implementation planning when:

- shared authorization is module/provider neutral while preserving Accounting and Voice permission compatibility;
- OAuth/OIDC-first policy is explicit;
- endpoint resolution removes hard-coded provider-instance dependence;
- agent versions are immutable and channel-aware;
- sensitive merge conflicts require explicit resolution;
- Voice recording/transcript states are evidence-, ownership-, consent-, and permission-aware;
- GitHub arbitration is test/CI/review driven;
- ATLAS Manager remains the deployment authority;
- no parallel security, integration, agent, or Voice architecture is introduced.
