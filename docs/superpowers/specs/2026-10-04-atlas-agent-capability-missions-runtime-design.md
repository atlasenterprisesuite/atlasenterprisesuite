# ATLAS Agent Capability + Missions Runtime — Design Specification

Date: 2026-10-04
Status: Design approved in chat; written specification awaiting user review before implementation planning
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Design branch: `docs/agent-capability-missions-runtime`
Owner layer: ATLAS shared platform / Universal Execution Engine
Primary consumers: ATLAS Assistant, ATLAS Manager, ATLAS Connect/Carrier, domain modules, repository agents, future MCP/agent surfaces

## 1. Purpose

ATLAS already has a provider-neutral Universal Execution Engine and a telecom Carrier Control Plane. This specification adds a capability-discovery and agent-execution layer on top of those existing foundations without creating a second workflow engine.

The goal is to make ATLAS able to answer, deterministically and audibly:

1. what capabilities exist;
2. which capability is allowed for the active tenant, organization, actor, environment, and jurisdiction;
3. which tool/provider can satisfy the capability;
4. whether execution is read-only, mutating, billable, destructive, regulated, approval-gated, or externally blocked;
5. which execution workflow/run owns the action;
6. what evidence proves the result;
7. whether the final state is truly verified.

The canonical execution path is:

`INTENT -> CAPABILITY RESOLUTION -> TENANT/ORG -> AUTHN -> AUTHZ -> POLICY -> APPROVAL -> IDEMPOTENCY -> EXECUTION WORKFLOW -> TOOL/ADAPTER -> PROVIDER -> EVIDENCE -> AUDIT -> VERIFICATION -> NEXT ACTION`

This design adopts useful patterns observed in Telnyx's public AI repository — agent manifests, generated skills, multi-runtime toolkits, MCP surfaces, explicit idempotency, read-only/write-test separation, and mission/run/event observability — while keeping ATLAS provider-neutral and aligned with existing ATLAS architecture.

## 2. Existing ATLAS Baseline

This design extends existing repository assets rather than replacing them.

### 2.1 Universal Execution Engine

`packages/execution` already owns shared execution primitives including:

- adapter contracts;
- approvals;
- context;
- execution engine;
- evidence;
- progress;
- state machine;
- persistence/store contracts;
- browser execution envelopes;
- work connections.

Supabase execution persistence and the `atlas-execution` server boundary remain authoritative for workflow/task/step/evidence/audit state.

The existing Universal Execution Engine design remains governing architecture for cross-module execution. A new `mission` concept in this specification is an agent-facing execution projection and MUST map onto the canonical execution workflow/task/step model rather than creating a competing task ledger.

### 2.2 Carrier Control Plane

`docs/telecom/atlas-carrier-control-plane.md` already defines:

- provider-neutral carrier adapters;
- Telnyx as an initial adapter target, not the ATLAS core;
- fail-closed external activation;
- truthful number/eSIM lifecycle states;
- RBAC;
- webhook verification and replay protection;
- idempotency for provisioning mutations;
- immutable audit evidence;
- exact deployment-SHA verification before production truth.

The new capability layer consumes this contract. It must not bypass or duplicate it.

### 2.3 Existing Telnyx integration

ATLAS already contains Telnyx telephony readiness and webhook verification code. Existing provider probes, webhook signature verification, tenant scope, and server-side secret handling remain authoritative.

This design therefore does not introduce a direct `ATLAS -> Telnyx API` shortcut. Telnyx operations continue to pass through ATLAS-owned policy and provider-adapter boundaries.

## 3. Locked Architectural Decisions

### 3.1 No second workflow engine

ATLAS Missions are implemented as a semantic layer over the Universal Execution Engine.

Conceptual mapping:

```text
Mission       -> execution workflow
Mission Run   -> workflow execution instance / task group
Mission Step  -> execution task/step
Mission Event -> append-only execution/audit/evidence event
```

If a required execution record already exists, the missions layer references it. It does not mirror the same state into a parallel database with independent transitions.

### 3.2 Capability Registry is declarative, not proof of runtime availability

A capability declaration states that ATLAS knows how a capability should work. It does not prove that a provider, credential, entitlement, route, device, regulator, deployment, or external service is currently available.

Capability state is separated into:

- `declared` — schema/manifest exists;
- `implemented` — ATLAS implementation exists;
- `configured` — required runtime configuration exists;
- `authorized` — current tenant/actor/provider authorization permits use;
- `verified` — a fresh readiness/evidence probe passed;
- `degraded` — implementation exists but current readiness is impaired;
- `blocked` — a required dependency/approval/authorization is missing;
- `unavailable` — capability cannot be used in this environment/jurisdiction/provider context.

UI and agent responses MUST NOT collapse these into a generic `available` or `connected` label.

### 3.3 Provider-neutral capability contracts

Capabilities are ATLAS concepts, not Telnyx concepts.

Examples:

- `communications.voice.call.create`
- `communications.messaging.sms.send`
- `communications.number.search`
- `wireless.esim.order`
- `identity.verify.start`
- `ai.inference.chat`
- `finance.payment.execute`

A capability may have zero, one, or many eligible providers. Provider routing is performed after policy evaluation.

### 3.4 Policy before tool selection

The runtime never chooses a provider/tool first and asks whether it was allowed afterward.

Required ordering:

`capability -> tenant/org -> actor -> environment -> jurisdiction -> data policy -> spend/risk policy -> approval -> provider eligibility -> tool binding -> execution`

### 3.5 Reuse before create

For any operation that creates or purchases a provider resource, ATLAS follows:

`DISCOVER -> VERIFY -> REUSE -> ADOPT ONLY IF SAFE -> CREATE ONLY IF REQUIRED`

A lookup failure is not equivalent to `resource does not exist`.

A resource may be adopted/reused only when ATLAS has affirmative evidence that doing so cannot mutate or hijack a live resource incorrectly.

### 3.6 One idempotency key per logical mutation

Retries of the same logical operation reuse the same idempotency key. ATLAS does not mint a new key merely because a transport response was lost or uncertain.

An ambiguous provider outcome enters reconciliation instead of blind retry.

### 3.7 Fail closed for P0 mutations

P0 operations include at minimum:

- provisioning numbers/eSIM/SIM resources;
- carrier activation/release;
- money movement;
- credential/security changes;
- regulated identity verification;
- destructive infrastructure operations;
- production deployment/traffic changes;
- cross-tenant data mutations.

A failed P0 assertion blocks completion. `continue-on-error` is not permitted for the final P0 verification gate.

## 4. ATLAS Capability Registry

### 4.1 Canonical record

Each capability has a versioned definition similar to:

```ts
export interface AtlasCapabilityDefinition {
  id: string;
  version: number;
  domain: string;
  title: string;
  description: string;
  operation: 'read' | 'write' | 'execute' | 'stream';
  riskTier: 'P0' | 'P1' | 'P2';
  mutatesExternalState: boolean;
  mayIncurCost: boolean;
  requiresApproval: boolean;
  requiresEvidence: boolean;
  permissions: string[];
  allowedEnvironments: string[];
  inputSchemaRef: string;
  outputSchemaRef: string;
  providerBindings: AtlasProviderBinding[];
  verificationPolicy: string;
  skillRef?: string;
  guideRef?: string;
}
```

The exact TypeScript shape may evolve during implementation, but the semantic fields above are binding requirements.

### 4.2 Registry ownership

Preferred repository ownership:

```text
packages/execution
  canonical execution and mission semantics

packages/capabilities
  capability definitions, registry, provider bindings, validation

packages/events
  existing/future durable domain-event contracts where present

provider/domain packages
  provider-specific adapters

apps/web
  capability/status/mission UI projections
```

If implementation inspection shows an existing approved package better owns capability metadata, reuse it rather than creating `packages/capabilities` only for directory aesthetics.

### 4.3 Manifest generation

ATLAS should expose a generated agent-facing manifest from canonical capability definitions. The manifest is an output artifact, not the source of truth.

Potential generated surfaces:

- internal `/api/capabilities` representation;
- `agent.json`-style machine-readable manifest;
- MCP tool metadata;
- agent skills index;
- human-readable capability documentation.

All generated outputs must derive from one canonical capability definition set and fail CI when drift is detected.

## 5. Missions Runtime

### 5.1 Mission

A mission describes an intended outcome, not an isolated API call.

Required semantics:

- tenant and organization scope;
- initiating actor/system identity;
- owner module;
- requested outcome;
- capability set;
- policy context;
- current workflow reference;
- overall state;
- correlation ID;
- created/updated timestamps.

### 5.2 Run

A run represents one attempt/continuation of a mission through the existing execution engine.

Required states:

- `pending`;
- `running`;
- `paused`;
- `blocked`;
- `succeeded`;
- `failed`;
- `cancelled`.

A run cannot become `succeeded` while a required P0 verification is missing or failed.

### 5.3 Event

Every material transition emits an append-only event/evidence record.

At minimum:

- `run_started`;
- `step_started`;
- `tool_call_requested`;
- `approval_requested`;
- `approval_granted` / `approval_denied`;
- `provider_request_sent`;
- `provider_response_received`;
- `step_completed`;
- `step_failed`;
- `verification_passed`;
- `verification_failed`;
- `run_blocked`;
- `run_resumed`;
- `run_succeeded`;
- `run_failed`;
- `run_cancelled`.

Each event carries applicable lineage:

- tenant ID;
- organization ID;
- actor/agent ID;
- mission ID;
- run ID;
- workflow/task/step references;
- capability ID;
- provider;
- provider request/resource reference when safe;
- idempotency key reference/digest;
- correlation ID;
- timestamp;
- evidence digest;
- deployment SHA when production verification is involved.

Secrets and one-time activation material are excluded or irreversibly redacted.

## 6. Tool Policy Gateway

The Tool Policy Gateway is the only ATLAS-owned path from agent intent to a privileged tool/provider mutation.

Responsibilities:

1. resolve capability;
2. validate input schema;
3. resolve tenant/org/actor context server-side;
4. enforce RBAC;
5. apply jurisdiction/data-locality/provider policies;
6. determine approval requirement;
7. enforce idempotency;
8. apply cost/spend limits;
9. select an eligible provider binding;
10. execute through the provider-neutral adapter;
11. normalize provider response;
12. append audit/evidence;
13. execute verification policy;
14. return verified state or precise blocker.

Agent/MCP/CLI callers do not receive a bypass path around this gateway for privileged operations.

## 7. Provider Bindings

A provider binding connects a capability to an adapter/tool implementation.

Example conceptual structure:

```ts
export interface AtlasProviderBinding {
  provider: string;
  adapter: string;
  capabilityId: string;
  environments: string[];
  regions?: string[];
  priority: number;
  healthCheck: string;
  writePolicy?: string;
}
```

For telecom, initial bindings may include Telnyx where already supported. Future providers such as Bandwidth, MVNE/wholesale operators, satellite providers, or authorized ATLAS Direct infrastructure use the same capability interface.

No provider binding may claim authorization that ATLAS has not verified.

## 8. Skills and Documentation Generation

### 8.1 Canonical source

ATLAS Skills should be generated from canonical capability/OpenAPI/contract metadata wherever practical.

Hand-authored skills remain appropriate for:

- multi-step operational policy;
- cross-provider orchestration;
- safety/governance procedures;
- tasks that cannot be faithfully generated from an API schema alone.

### 8.2 Drift control

CI must verify:

- generated skill copies match their source;
- capability counts/indexes are current;
- provider bindings reference valid capabilities;
- skill/guide references exist;
- schemas used by toolkits match canonical capability schemas.

Generated outputs are never edited directly when a canonical generator/source exists.

## 9. MCP Architecture

ATLAS uses two MCP layers when MCP is the correct transport.

### 9.1 Generic ATLAS MCP Gateway

Purpose: expose authorized ATLAS capabilities through a standard tool surface.

It performs discovery and delegates execution to the Tool Policy Gateway. It does not contain provider secrets or provider-specific business logic.

### 9.2 Focused MCP Apps / domain servers

Focused surfaces may exist for domains where a constrained toolset improves security and usability, for example:

- Carrier Operations;
- Voice Monitor;
- Number Intelligence;
- Network Cost Explorer;
- Finance Operations;
- HR/Payroll;
- Tax;
- Health data workflows where separately approved and compliant.

Focused MCP surfaces reduce tool explosion and limit privilege exposure. They still use the same canonical capability registry and execution/evidence contracts.

## 10. Telnyx Integration Rules

Telnyx remains an adapter and upstream capability source, not an ATLAS control-plane dependency.

ATLAS may consume Telnyx through:

- existing REST/provider adapter code;
- Telnyx MCP where an authorized use case benefits from it;
- Telnyx SDK/toolkit patterns;
- Telnyx capability/skill metadata as reference input.

ATLAS must not:

- route around the ATLAS Carrier Control Plane;
- expose the Telnyx API key to browser code;
- infer ownership from number search results;
- treat a provider lookup error as absence;
- blindly retry an ambiguous paid/provisioning operation;
- represent Telnyx availability as ATLAS-owned carrier infrastructure;
- make Telnyx the only supported implementation of a generic ATLAS capability.

## 11. Data Locality and AI Provider Policy

AI inference capability definitions include policy metadata for:

- allowed providers/models;
- allowed regions/data locality;
- retention policy;
- tenant opt-in/opt-out requirements;
- sensitive-data classification;
- fallback eligibility;
- budget/cost ceilings.

A model/provider fallback may occur only when the fallback satisfies the same or stricter policy constraints. Cost or latency alone cannot override a data residency or authorization policy.

## 12. Messaging Compliance

Messaging capabilities must model compliance as execution preconditions, not documentation notes.

Examples include:

- sender/profile authorization;
- destination eligibility;
- consent/opt-in state where required;
- opt-out suppression;
- campaign/10DLC prerequisites where applicable;
- spend limits;
- rate limiting;
- delivery evidence.

An agent may generate draft messaging content without send authority, but sending uses the capability policy gateway.

## 13. Cost Controls

Every capability that can incur external cost declares `mayIncurCost = true` and a cost policy.

For provisioning and billable APIs, policy may include:

- maximum cost per operation;
- daily/monthly tenant budget;
- reuse-before-create requirement;
- explicit `force_new` permission separate from normal provisioning;
- cleanup obligation for test-created resources;
- reconciliation when provider billing/result state is ambiguous.

A failed cleanup of a billable test resource is a real exception and remains open until reconciled.

## 14. CI/CD and Verification

### 14.1 Read-only verification

Read-only provider probes may run automatically when required secrets and safe provider environments are available.

They validate:

- credentials;
- permissions;
- schemas/contracts;
- provider availability;
- discovery/list operations;
- tool parity.

### 14.2 Write + cleanup verification

Real write tests must run only in a designated sandbox/test tenant/provider scope unless a production verification contract explicitly requires otherwise.

Every real-resource write test must record:

- idempotency key;
- created resource ID;
- provider request ID when available;
- cleanup action;
- cleanup evidence;
- final reconciliation state.

### 14.3 P0/P1 policy

P0 failures block the verification result.

P1 failures may warn but must remain visible in evidence/logs.

No `continue-on-error` or equivalent may convert a failed mandatory P0 verification into a green final gate.

### 14.4 Release provenance

Where supported by registries and deployment providers, prefer short-lived OIDC/trusted publishing over long-lived publishing tokens.

Actions used in release/security-sensitive workflows should be pinned according to ATLAS supply-chain policy. The implementation plan must reconcile version-tag convenience with immutable-SHA requirements for privileged workflows.

## 15. Security Model

- Secrets remain server-side or in approved secret stores.
- Tenant/organization context is resolved from authenticated context, not trusted from browser payloads.
- Capability execution requires explicit permission.
- Provider writes are least privilege.
- High-risk capabilities require approval when policy says so.
- Webhook signatures and replay controls remain mandatory.
- Evidence and audit are append-only for protected transitions.
- Activation secrets, private keys, API keys, recovery tokens, full payment credentials, and similar secrets are never written into mission events.
- Provider error bodies are sanitized before persistence if they may contain sensitive material.

## 16. UI/Operator Experience

ATLAS surfaces capability and mission truth using separate labels for:

- implementation state;
- provider readiness;
- authorization state;
- mission/run state;
- verification state.

Examples:

- `Implemented · Provider not configured`
- `Configured · Authorization blocked`
- `Run blocked · Approval required`
- `Provider responded · Verification pending`
- `Verified active`

A rendered control or successful API request is not sufficient to display `LIVE`, `CONNECTED`, `ACTIVE`, `PAID`, `PROVISIONED`, or equivalent final-state language when the governing verification policy has not passed.

## 17. Initial Scope

The first implementation slice should prove the architecture using existing ATLAS telecom assets rather than attempting all modules simultaneously.

Recommended proof capabilities:

1. `communications.voice.readiness` — read-only;
2. `communications.number.search` — read-only discovery;
3. `communications.voice.call.create` — controlled write where authorized;
4. `communications.webhook.verify` — verification primitive;
5. one idempotent provisioning path that can prove reuse-before-create and cleanup behavior in an authorized test scope.

The mission runtime must use existing execution workflows/tasks/steps/evidence for these proofs.

After the telecom proof is stable, capability registration can expand to Finance, HR/Payroll, Accounting, Tax, AI provider routing, and other ATLAS modules.

## 18. Acceptance Criteria

The design is implemented successfully only when automated tests and runtime evidence prove all applicable items:

1. capability definitions are versioned and schema-validated;
2. generated manifest/skill metadata cannot drift silently from canonical definitions;
3. a caller without required permission cannot invoke a protected capability;
4. cross-tenant execution is rejected;
5. provider selection occurs only after policy evaluation;
6. an unavailable provider cannot be represented as ready;
7. a provider lookup error is distinguishable from a confirmed empty result;
8. a repeated logical mutation reuses its idempotency key;
9. a materially different payload using the same key is rejected as an idempotency conflict;
10. an ambiguous provider write does not trigger a blind duplicate write;
11. reuse-before-create prevents duplicate paid resources when a verified reusable resource exists;
12. P0 write tests fail the final gate when write, cleanup, tenant isolation, RBAC, or verification fails;
13. mission/run/event projections reference the canonical execution workflow/task/step state rather than a second state machine;
14. every material provider mutation has durable audit/evidence lineage;
15. secrets are absent from manifest, skills, logs, mission events, and browser bundles;
16. Telnyx can be disabled/replaced without changing generic ATLAS capability IDs;
17. production truth labels require the governing verification policy to pass;
18. the telecom proof passes unit, contract, integration, and authorized E2E verification appropriate to the environment.

## 19. Non-Goals

This specification does not:

- replace the Universal Execution Engine;
- replace ATLAS Manager;
- replace the Carrier Control Plane;
- make Telnyx the ATLAS carrier;
- import all Telnyx skills into ATLAS;
- expose hundreds of tools to every agent session;
- grant autonomous agents unrestricted production write permission;
- create new production carrier relationships or regulatory authorizations;
- claim a real eSIM/number/call is active without authenticated provider evidence;
- implement every ATLAS domain in the first slice;
- bypass existing human/provider approval requirements that are legally, financially, or operationally mandatory.

## 20. Required Implementation Planning Constraints

The implementation plan created after written-spec approval must:

1. inspect the current `packages/execution` and Supabase execution schema before selecting files;
2. reuse existing state machine, evidence, approval, adapter, and audit primitives;
3. add tests before implementation changes where practical;
4. avoid creating a second mission database model if existing execution tables can represent the required lineage;
5. define a minimal canonical capability schema before generating manifests/skills;
6. start with the telecom proof slice;
7. include provider-offline, missing-secret, permission-denied, rate-limited, ambiguous-write, duplicate-retry, cleanup-failure, and cross-tenant tests;
8. keep production deployment separate from provider activation truth;
9. preserve existing release and production verification gates;
10. require exact evidence before marking the capability/runtime complete.

## 21. Self-Review

### Placeholder scan

No `TBD`, `TODO`, invented provider state, fake production credential, or unresolved placeholder is intentionally present.

### Internal consistency

The design treats Missions as an agent-facing semantic projection over the Universal Execution Engine. Capability discovery, policy enforcement, provider routing, execution, and verification therefore share one authoritative execution/audit model.

### Scope check

The architecture is broad, but implementation is deliberately constrained to a telecom proof before cross-module expansion. This keeps the first plan executable and avoids a simultaneous rewrite of all ATLAS modules.

### Ambiguity resolution

- Capability declaration does not equal runtime readiness.
- Telnyx is a provider binding, not the capability owner.
- Provider lookup failure does not equal confirmed absence.
- One logical write keeps one idempotency key through retries/recovery.
- P0 mandatory verification cannot be converted to success with warning-only behavior.
- Mission state does not become a second state machine.
- Manifest and skills are generated projections where canonical metadata exists.
- Final UI truth comes from verified evidence, not optimistic client state.

### Compatibility check

This design is intended to extend:

- `docs/superpowers/specs/2026-09-12-atlas-universal-execution-engine-design.md`;
- `docs/superpowers/specs/2026-09-06-atlas-copilot-agent-control-plane-design.md`;
- `docs/telecom/atlas-carrier-control-plane.md`;
- the existing `packages/execution` implementation;
- existing Telnyx readiness/webhook code.

If implementation inspection finds a stronger currently merged contract, that stronger contract wins and the implementation must adapt rather than duplicate it.
