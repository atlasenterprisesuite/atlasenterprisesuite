# ATLAS Assistant 2.0 — Intelligence Workspace Design

Date: 2026-10-06
Status: Approved design, implementation not started
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `spec/atlas-assistant-2-intelligence-workspace`
Owner: ATLAS Assistant / Intelligence Platform

## Purpose

Evolve the existing ATLAS Assistant into the canonical intelligence workspace for the suite. The goal is to unify conversational AI, long-running work, software-building workflows, research, files, connected apps, voice, artifacts, and governed actions behind one ATLAS-owned conversation surface.

This project does not clone ChatGPT source code, branding, proprietary assets, or internal implementation. ChatGPT is used only as a capability and interaction benchmark. ATLAS remains provider-neutral, tenant-scoped, auditable, and governed by its own identity, RBAC, cost, approval, and tool boundaries.

## Existing architecture to preserve

ATLAS already provides the foundations required for this project:

- `/assistant` unified chat surface;
- `atlas-copilot` authenticated intelligence gateway;
- `IntelligenceRouter` provider routing;
- provider modes including Auto, ATLAS Local, OpenAI, Bedrock, Gemini, Codex Sovereign, and Council;
- Fast, Balanced, and Deep reasoning profiles;
- persistent conversations and routing metadata;
- governed background execution through ATLAS Background Brain;
- `/work` long-running execution and Work Command Center;
- `/automations` governed agents and recurring work;
- `/work/connections` provider/app connection management;
- ATLAS Voice and translation flows;
- Writing Desk, Image Lab, Knowledge Atlas, Analytics, and Creator workflows;
- ATLAS Tool Gateway, approval gates, RBAC, audit, and cost policy boundaries;
- fail-closed provider readiness and production verification.

The implementation must extend these systems instead of introducing a parallel assistant stack.

## Scope and decomposition

The full ChatGPT-parity program spans multiple independent subsystems, so it is decomposed into phases. This specification defines the architectural contract and Phase 1 foundation only.

### Phase 1 — Intelligence Workspace Foundation

1. Add a first-class experience switcher inside the canonical assistant:
   - `Chat` — immediate conversational interaction;
   - `Work` — governed long-running execution;
   - `Build` — software/repository execution through Codex Sovereign and approved developer tooling.
2. Replace fragmented entry points with one universal composer that can express message, work, research, build, file, app, voice, and artifact intents.
3. Introduce a capability manifest that reports which actions are actually available in the active tenant/session.
4. Introduce source/context selection for project knowledge, organization knowledge, connected apps, attachments, and current module context.
5. Introduce a unified execution/result model for interactive replies, background work, build jobs, and artifact outputs.
6. Preserve provider choice, reasoning profiles, readiness, cost, approvals, and audit metadata.
7. Add truthful unavailable/gated states for capabilities that are not yet operational.

### Follow-on subprojects

These require separate implementation specs/plans after Phase 1:

- Deep Research engine with web retrieval, citation graph, evidence reconciliation, and source policy;
- secure file ingestion pipeline with malware scanning, extraction, indexing, and provenance;
- scoped Memory system (`user`, `project`, `organization`);
- Project workspace persistence for instructions, files, conversations, and artifacts;
- artifact framework for documents, spreadsheets, presentations, reports, images, and code bundles;
- richer connected-app actions;
- computer/browser operations;
- multi-agent orchestration and delegated sub-workflows.

Phase 1 must expose these as capability states but must not falsely present them as implemented.

## Product model

ATLAS Assistant becomes the canonical entry point to intelligence work.

```text
User
  -> ATLAS Assistant 2.0
  -> Intent + Context Resolution
  -> Capability Router
  -> Chat | Work | Build
  -> IntelligenceRouter / Work Orchestrator / Codex Sovereign
  -> ATLAS Tool Gateway
  -> Provider(s) / Connected Apps / ATLAS Modules
  -> Persisted Result + Artifact References + Audit
```

ATLAS always owns conversation identity, tenant scope, permissions, tool authorization, and final state.

## Experience switcher

### Chat

Use for immediate user-facing conversation, explanation, transformation, lightweight analysis, translation, and other low-latency tasks.

Default execution mode is interactive. The existing provider and profile selectors remain valid.

### Work

Use for tasks that require multiple steps, long execution, durable status, retries, or external dependencies.

Work must reuse existing Work/Background Brain infrastructure. A Work run is represented inside the conversation through a durable execution card with status, owner, trace ID, approvals, and result links.

### Build

Use for repository and software-engineering work. Build routes through Codex Sovereign or another explicitly approved developer runtime. It must never imply repository access unless the Git/provider connection is verified.

Build jobs must preserve branch/commit/PR/CI metadata when available. Mutating repository actions remain governed by permissions and approval policy.

## Universal composer

The composer is one input surface with capability affordances rather than separate products.

It supports:

- text prompt;
- experience selection: Chat / Work / Build;
- provider mode where allowed;
- reasoning profile;
- source/context picker;
- file attachment entry point;
- connected-app entry point;
- voice input entry point;
- artifact intent entry point;
- execution preference when supported: interactive or background.

Capabilities that are unavailable must remain visible only when useful and must report a truthful disabled/gated state with the blocking dependency.

## Capability manifest

The server returns an organization/session-scoped capability manifest. The client does not infer readiness from the presence of a menu item.

```ts
type AtlasAssistantCapabilityId =
  | 'chat'
  | 'work'
  | 'build'
  | 'web-research'
  | 'attachments'
  | 'voice'
  | 'apps'
  | 'knowledge'
  | 'artifacts'
  | 'computer';

type AtlasAssistantCapabilityState =
  | 'ready'
  | 'gated'
  | 'unavailable'
  | 'configuration_required';

type AtlasAssistantCapability = {
  id: AtlasAssistantCapabilityId;
  state: AtlasAssistantCapabilityState;
  reason: string | null;
  permissions: string[];
  supports_background: boolean;
};
```

The manifest is additive to existing provider readiness. Provider readiness answers “which intelligence provider can execute?” Capability readiness answers “which user workflow can be truthfully offered?”

## Context and sources

A request may include authorized context sources. Phase 1 defines the contract but only enables sources already backed by verified ATLAS systems.

```ts
type AtlasContextSource = {
  kind: 'module' | 'knowledge' | 'app' | 'attachment' | 'conversation' | 'project';
  id: string;
  label: string;
  state: 'ready' | 'gated' | 'unavailable';
  provenance?: Record<string, unknown>;
};
```

Rules:

- module context may reuse existing route-context intelligence;
- organization knowledge may only include records the current identity can read;
- app sources require a verified connection;
- attachments remain gated until the secure ingestion pipeline is operational;
- project sources remain gated until Project persistence exists;
- no source is silently added from another tenant or unauthorized scope.

## Request contract

The client sends one normalized workspace request.

```ts
type AtlasAssistantExperience = 'chat' | 'work' | 'build';

type AtlasWorkspaceRequest = {
  experience: AtlasAssistantExperience;
  message: string;
  conversation_id?: string | null;
  mode: AssistantMode;
  profile: AssistantProfile;
  execution_mode: 'interactive' | 'background';
  source_refs: AtlasContextSource[];
  requested_capabilities: AtlasAssistantCapabilityId[];
};
```

The server validates experience, capabilities, tenant, permissions, provider readiness, cost policy, and source scope before execution.

## Unified execution result

All execution paths normalize into one result envelope.

```ts
type AtlasExecutionState =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'approval_required'
  | 'configuration_required';

type AtlasWorkspaceResult = {
  conversation_id: string;
  execution_id: string | null;
  experience: AtlasAssistantExperience;
  state: AtlasExecutionState;
  text: string | null;
  providers: string[];
  model: string | null;
  profile: AssistantProfile;
  capability_ids: AtlasAssistantCapabilityId[];
  artifact_refs: string[];
  approval_refs: string[];
  provenance: unknown[];
  error: string | null;
};
```

Interactive chat may complete synchronously. Work and Build may return `queued` or `running` and continue through existing background/work infrastructure.

## Routing rules

### Chat

`Chat -> atlas-copilot -> IntelligenceRouter -> provider adapter(s)`

### Work

`Work -> existing Work/Background Brain orchestrator -> governed tools/providers -> persisted execution`

### Build

`Build -> verified developer runtime / Codex Sovereign -> repository/tool gateway -> persisted execution`

The experience switcher is not a provider selector. A user can choose Work while ATLAS still chooses an appropriate verified provider according to policy.

Explicit provider modes retain current no-silent-fallback behavior.

## Tool and action governance

All external side effects continue to flow through ATLAS Tool Gateway or the corresponding governed Work/Build boundary.

Required controls:

- tenant validation;
- RBAC and permission checks;
- schema validation;
- tool risk classification;
- cost classification;
- idempotency / de-duplication where applicable;
- approval gates for mutating, cost-bearing, security-sensitive, or externally consequential actions;
- audit event emission;
- no provider may directly bypass these controls.

## Files and attachments

Phase 1 must not weaken the existing fail-closed attachment state.

The UI may expose an attachment control only if it reads readiness from the capability manifest. If malware scanning or secure ingestion is not verified, the control must show `configuration_required` or `gated` and must not upload bytes.

The follow-on file-ingestion project must later provide:

`upload -> malware scan -> type/size validation -> extraction -> provenance -> tenant-scoped storage -> optional indexing`

No parsing success may be claimed unless the file passed the pipeline.

## Research

Phase 1 distinguishes ordinary model reasoning from sourced research.

`web-research` is a separate capability. If the real retrieval/citation engine is not available, Researcher-style prompts may still analyze supplied content but must not claim web research or sourced evidence.

The future Deep Research subsystem will require source retrieval, citation preservation, source-quality metadata, contradiction handling, and resumable background execution.

## Memory and Projects

Phase 1 does not implement long-term memory or project persistence. It reserves the interface boundaries and keeps both capabilities gated until separate specs are implemented.

Future memory scope must be explicit:

- `user` — user-specific non-sensitive preferences/context allowed by policy;
- `project` — project instructions, sources, conversations, and artifacts;
- `organization` — approved tenant knowledge governed by RBAC.

No memory may cross tenant boundaries.

## UI architecture

The current `/assistant` route remains canonical.

Recommended component boundaries:

- `AssistantExperienceSwitcher` — Chat / Work / Build selection;
- `AssistantComposer` — text and composer controls;
- `AssistantCapabilityMenu` — sources, files, apps, voice, artifacts;
- `AssistantSourcePicker` — verified context sources;
- `AssistantExecutionCard` — queued/running/completed work or build status;
- `AssistantMessage` — conversational content and provenance;
- `AssistantReadinessPanel` — provider and capability readiness;
- existing conversation rail/history remains reusable.

The implementation should split responsibilities out of `UnifiedAIChatPage.tsx` where necessary rather than expanding the page into a larger monolith.

## Navigation

`/assistant` remains the primary destination.

Existing routes remain valid and deep-linkable:

- `/work`
- `/automations`
- `/work/connections`
- `/studio/write`
- `/studio/voice`
- `/knowledge`
- `/analytics`
- other suite routes

Assistant cards and artifacts may link into these modules without duplicating their functionality.

## Error model

Add normalized workspace errors while preserving existing provider errors:

- `capability_unavailable`
- `capability_configuration_required`
- `source_unavailable`
- `source_permission_denied`
- `build_runtime_unavailable`
- `work_runtime_unavailable`
- `attachment_pipeline_unavailable`
- `research_engine_unavailable`
- `execution_not_found`
- `execution_failed`

No failed or gated execution is rendered as completed.

## Security and privacy

- credentials remain server-side;
- provider and app tokens never enter client-visible telemetry;
- tenant/user scope is resolved server-side;
- source references are re-authorized server-side before use;
- arbitrary remote URL fetching is not enabled by model output alone;
- arbitrary shell/JavaScript execution is not enabled by model output alone;
- Build requires a verified developer runtime and repository authorization;
- attachment processing remains fail-closed;
- memory/project context cannot cross tenants;
- capability readiness is server-authored, not client-assumed.

## Observability and audit

Each request should expose or persist, when applicable:

- conversation ID;
- execution ID / trace ID;
- selected experience;
- requested/used capabilities;
- provider(s) and model actually used;
- profile;
- source references and provenance identifiers;
- approvals required/granted;
- latency and usage;
- terminal state and normalized error.

Private chain-of-thought is never stored or exposed as audit data.

## Testing strategy

### Unit

- capability manifest mapping;
- Chat/Work/Build routing intent;
- source gating;
- explicit provider no-fallback behavior;
- normalized workspace result/error mapping;
- permission/readiness/cost gates;
- disabled attachment/research/build controls when dependencies are unavailable.

### Integration

- one conversation survives switching among Chat, Work, and Build;
- Work/background execution returns durable status and reconciles results;
- Build refuses execution when repository/runtime readiness is absent;
- provider and capability readiness are independently enforced;
- source references are re-authorized server-side;
- existing voice/translator flows remain interactive;
- existing conversation history remains readable.

### UI

- responsive desktop/tablet/mobile workspace;
- keyboard navigation and screen-reader labels;
- experience switcher state;
- universal composer behavior;
- truthful gated/unavailable capability states;
- execution cards for queued/running/completed/failed states;
- no regression in existing Assistant history/provider/profile interactions.

### Production verification

The route family must remain included in ATLAS production verification. Phase 1 is not considered deployed until `/assistant` and any newly introduced API/runtime health dependencies pass the configured P0/P1 verification policy.

## Acceptance criteria — Phase 1

1. `/assistant` is the canonical intelligence workspace and presents Chat, Work, and Build experiences.
2. Existing provider selection and Fast/Balanced/Deep profiles continue to work.
3. One conversation can contain interactive chat turns and durable Work/Build execution cards without creating a second conversation product.
4. The client consumes a server-authored capability manifest and does not infer operational readiness from UI presence.
5. Files, research, apps, Build, and other capabilities show truthful ready/gated/configuration-required states.
6. Existing attachment fail-closed behavior is preserved until secure ingestion is implemented.
7. Work reuses existing Work/Background Brain orchestration.
8. Build uses only a verified developer/repository runtime and cannot claim access otherwise.
9. Source references are tenant-scoped and re-authorized server-side.
10. Provider credentials and app tokens remain server-side.
11. Tool actions continue through existing permission/risk/cost/approval gates.
12. Existing Assistant history, provider modes, profile controls, voice/translation flows, and responsive behavior do not regress.
13. Focused unit/integration/UI tests pass before merge.
14. Full typecheck/build/relevant CI pass before merge.
15. Production deployment is not marked verified without fresh route/runtime evidence.

## Non-goals — Phase 1

- implementing full Deep Research;
- enabling arbitrary web browsing from model output;
- enabling attachment uploads before malware scanning and ingestion are verified;
- implementing long-term user/project/org memory;
- implementing Project persistence;
- replacing Work OS, Knowledge Atlas, Writing Desk, Image Lab, Voice, Analytics, or Automations;
- copying OpenAI UI assets, trademarks, proprietary source, or internal implementation;
- weakening ATLAS approval, tenant, RBAC, audit, cost, or provider-readiness controls.

## Rollout

Phase 1 should be introduced behind ATLAS's existing authenticated experience and verification boundaries. If a newly unified capability is not ready, the workspace must degrade to the existing working Assistant functions rather than simulate a successful integration.

The rollout order should be:

1. capability manifest and contracts;
2. experience switcher + universal composer;
3. Work execution card integration;
4. Build readiness/execution contract;
5. source/context picker using already verified sources;
6. readiness/error UX;
7. regression and production verification.

Follow-on capabilities are implemented through separate approved specs/plans so each subsystem remains independently testable and reviewable.
