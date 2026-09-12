# ATLAS Universal Execution Core — Design Specification

Status: Approved direction, canonical design pending implementation plan
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/atlas-universal-execution-core`
Owner: ATLAS Core / Orchestrator
Dependent modules: Studio, Finance, Accounting, Tax, ATLAS Pay, Weather, Hospitality, Health, Ride, Security, ATLAS Assistant

## 1. Purpose

ATLAS must execute work consistently across modules instead of growing as isolated feature screens. The Universal Execution Core is the shared runtime that turns user intent into permission-aware, persistent, auditable, evidence-backed execution.

Universal flow:

`INTENT → OWNER MODULE → CONTEXT → CURRENT STATE → GOAL → DEPENDENCIES → PERMISSIONS → MICROACTIONS → EXECUTION → VALIDATION → NEXT ACTION`

Universal user-facing states:

- `now`
- `next`
- `blocked`
- `awaiting_approval`
- `completed`

`completed` is permitted only when the workflow's completion policy is satisfied and required evidence is attached. An operation that ran but cannot be verified must not be represented as completed.

## 2. Architectural Principle

The shared infrastructure is:

`Task Engine + Workflow Engine + ATLAS Assistant + Approval Center + Audit Trail + Evidence Registry + Provider Registry + Usage/Cost Governance + Persistent State`

Module code owns domain rules. The Universal Execution Core owns orchestration semantics, task state, dependencies, approvals, tool/provider execution boundaries, evidence, audit, retries, resumability and cross-module context.

ATLAS must reuse the repository's existing tenant/organization session model, Supabase backend, RBAC patterns, Edge Functions, audit conventions and Creator/Accounting modules. It must not create a parallel truth source when an existing canonical source is available.

## 3. Canonical Workflow Contract

Every workflow persists at minimum:

```ts
export type AtlasWorkflowStatus =
  | 'now'
  | 'next'
  | 'blocked'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AtlasWorkflow = {
  task_id: string;
  workflow_type: string;
  module: string;
  tenant_id: string;
  organization_id: string;
  owner_id: string;
  status: AtlasWorkflowStatus;
  priority: 'low' | 'normal' | 'high' | 'critical';
  current_step: string | null;
  next_action: string | null;
  dependencies: string[];
  blocked_reason: string | null;
  permissions_required: string[];
  evidence_ids: string[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};
```

History is append-only and stored separately as immutable events rather than repeatedly rewriting a JSON audit blob.

## 4. Task Engine

The Task Engine decomposes a workflow into independently executable steps.

Each task step contains:

- stable step ID
- workflow/task ID
- module
- action type
- execution class
- dependencies
- required permissions
- required approval policy
- retry policy
- timeout policy
- idempotency key when the step can mutate external state
- input references rather than duplicated sensitive payloads
- result references
- evidence requirements
- timestamps and attempt history

Execution classes:

1. `observe` — read-only retrieval or inspection.
2. `prepare` — builds a draft, proposal or pending mutation but does not apply an external effect.
3. `execute` — performs an authorized mutation or provider action.
4. `validate` — independently verifies a claimed result.

High-impact actions must never skip directly from intent to `execute` without policy evaluation.

## 5. Workflow Engine

The Workflow Engine coordinates task steps, dependencies and transitions.

Required behaviors:

- deterministic state transitions
- dependency graph validation
- cycle rejection
- retries with bounded backoff for retryable provider errors
- no automatic retry for ambiguous financial, tax, payment or filing mutations unless idempotency can be proven
- pause/resume after logout, refresh, timeout or provider interruption
- explicit blocked reasons
- next-action calculation
- cancellation with audit record
- human-readable progress for ATLAS Assistant
- cross-module handoff without losing task identity

A workflow must survive browser refreshes and device changes because canonical execution state lives in the backend, not React component state.

## 6. Universal RBAC

`packages/core` must evolve from accounting-only permission types to a domain-neutral permission contract while preserving tenant and organization scope.

Permissions follow `<domain>.<action>` naming, for example:

- `accounting.read`
- `accounting.post`
- `creator.generate`
- `creator.publish`
- `agent.execute`
- `workflow.read`
- `workflow.manage`
- `workflow.approve`
- `tax.prepare`
- `tax.review`
- `tax.file`
- `pay.card.add`
- `pay.card.manage`
- `weather.read`
- `audit.read`

Administrative permissions do not implicitly grant unrelated domain permissions unless explicitly defined by policy.

Every mutation revalidates authorization server-side. UI visibility is not authorization.

## 7. Approval Center

The Approval Center is the universal gate for sensitive actions.

Approval requests contain:

- approval ID
- workflow/task/step IDs
- module and organization
- actor requesting execution
- action summary
- risk class
- requested permissions
- intended external effect
- target/provider reference
- proposed values with sensitive fields redacted
- evidence supporting the action
- expiration time when relevant
- status
- approver identity and timestamp
- denial/cancellation reason

Risk classes:

- `low`: informational or reversible internal preparation
- `moderate`: meaningful internal changes
- `high`: external side effects, money movement, publishing, production infrastructure mutations
- `regulated`: tax filing, financial account/card actions, sensitive health or other regulated workflows

High and regulated actions require explicit approval unless a separately approved policy grants a narrower preauthorization. Provider credit spend also passes policy checks and can require approval when budget thresholds are exceeded.

Approval never stores secrets or raw card credentials in audit text.

## 8. Agent Runtime

ATLAS Assistant is the user-facing operator; the Agent Runtime is its governed execution layer.

Runtime cycle:

`OBSERVE → REASON → PLAN → POLICY CHECK → ACT → VALIDATE → RECORD → NEXT`

The runtime must expose capabilities through a Tool Registry rather than permitting arbitrary model-produced commands.

Each tool definition declares:

- capability ID
- input schema
- result schema
- execution class
- required permission
- approval policy
- tenant boundary rules
- idempotency behavior
- evidence producer
- provider dependencies

The LLM may choose among allowed tools but cannot redefine permission requirements, bypass approvals or fabricate tool results.

## 9. Provider Registry

Provider readiness is centralized instead of duplicated per module.

Canonical provider states:

- `not_configured`
- `configured_unverified`
- `probing`
- `verified`
- `degraded`
- `unavailable`

A provider record includes capabilities, models/services, secret requirements, region constraints, rate limits, cost metadata, last probe time, last successful verification and error state.

No UI may display `live`, `connected`, `ready` or equivalent unless the provider state supports that claim for the requested capability.

The existing OpenAI path in `atlas-copilot` becomes one adapter behind the registry. Gemini, Codex or other providers are added only when separate adapters and successful probes exist.

## 10. Evidence Registry

Evidence makes execution verifiable.

Evidence types include:

- database row reference
- provider transaction/reference ID
- API response digest
- generated artifact reference
- source document citation
- test run
- deployment/commit SHA
- production route check
- user confirmation
- independent validation result

Evidence records contain provenance, timestamp, producing task/step, source type, immutable digest where appropriate, verification state and visibility scope.

Sensitive evidence stores secure references; audit logs receive redacted metadata only.

## 11. Audit Trail and Traceability

Every workflow receives a `trace_id` propagated through:

`Intent → Workflow → Task Step → Agent → Provider/Tool → Approval → Result → Evidence`

Audit is append-only and records:

- actor
- organization/tenant
- action
- timestamp
- workflow/task/step
- authorization decision
- approval state
- result state
- evidence references
- error category

Secrets, raw payment credentials, access tokens and unredacted sensitive tax data must not be written to general audit logs.

## 12. Cost and Usage Governance

Every external AI/media/provider invocation records, when available:

- organization
- user
- workflow/task/step
- provider
- model/service
- capability
- unit usage
- estimated cost before execution when possible
- actual cost after execution when returned
- currency
- budget policy decision
- approval reference when required

ATLAS must support per-user, per-organization and per-provider budgets. Running out of budget produces `blocked`, not a fake successful result.

## 13. Document Intelligence

Document Intelligence is a shared service for Tax, Accounting, HR, Finance and Legal.

Every extracted field retains:

```ts
export type ExtractedField<T = string> = {
  field_key: string;
  original_value: string | null;
  normalized_value: T | null;
  source_document_id: string;
  source_page: number | null;
  source_region: string | null;
  extractor: string;
  confidence: number | null;
  verification_state: 'unverified' | 'machine_checked' | 'human_verified' | 'rejected';
};
```

The system keeps correction history and never silently replaces source values.

Sensitive documents use restricted storage policies, signed access, retention controls and access logging.

## 14. Finance Modeling Agent

Owner: ATLAS Finance Intelligence.

The agent may understand instructions and propose structures, but numeric model execution must be deterministic and reproducible.

Required capabilities:

- Excel/CSV ingestion
- workbook/sheet metadata
- formula graph and dependency inspection
- assumptions registry
- scenario/version snapshots
- DCF and forecast primitives
- ratio calculations
- units/currency handling
- circular-reference detection
- model comparison
- export with provenance

The model distinguishes user inputs, imported formulas, AI-proposed assumptions and approved assumptions.

## 15. Tax Execution Agent

Owner: ATLAS Tax, integrated with Document Intelligence and the Universal Execution Core.

Workflow:

`DOCUMENTS → EXTRACT → VALIDATE → NORMALIZED TAX FACTS → CALCULATE → DRAFT RETURN → REVIEW → APPROVAL → EXPORT/E-FILE ADAPTER → VALIDATE RECEIPT`

Required boundaries:

- version rules by tax year
- preserve federal/state jurisdiction separately
- provenance for every material fact
- explicit distinction between `prepared`, `reviewed`, `approved`, `submitted` and `accepted`
- filing never occurs from model output alone
- signature/consent and filing provider requirements remain explicit external dependencies
- amendments are separate workflows linked to the original return

## 16. ATLAS Pay / Wallet & Cards

ATLAS Pay is a separate regulated domain consuming the Universal Execution Core.

Required states include:

- `draft`
- `issuer_verification_required`
- `verification_in_progress`
- `active`
- `suspended`
- `revoked`
- `failed`

A card can show `active` only from verified issuer/provider state.

ATLAS stores provider/token references, not raw PAN/CVV in application tables or logs. Wallet provisioning and device tokenization require supported provider adapters. Lost-device, revocation, retry, dispute and audit behavior must be designed before production mutation is enabled.

The Apple Wallet screenshots are interaction references only; ATLAS must not copy Apple branding or falsely claim Apple Wallet provisioning.

## 17. Studio Music / Suno

Owner: ATLAS Studio.

Reuse `/studio/create?type=music` and the existing Creator architecture.

Music generation becomes executable only when a compatible authorized provider adapter is configured and verified. Until then the existing configuration-required behavior remains correct.

Workflow:

`BRIEF → VALIDATE → COST/POLICY → PROVIDER → GENERATION → RESULT INGEST → STORAGE → PROVENANCE → LIBRARY`

Generated assets enter Creator Library only after an actual provider result is saved.

## 18. ATLAS Director

ATLAS Director remains under the existing approved Director design/plan and consumes the new shared Provider Registry, Cost Governance, Approval Center and Evidence Registry rather than inventing local equivalents.

This design does not replace the Director feature plan.

## 19. Weather Context Service

Weather is a shared context service, not a standalone duplicated application.

Normalized capabilities:

- current conditions
- hourly/daily forecast
- severe-weather alerts when supported
- provider/source attribution
- observation/forecast timestamp
- location precision level
- units
- freshness/expiry
- provider status

Location access follows consent and minimization. Consumers such as Dashboard, Ride and Hospitality receive normalized data; they do not embed provider-specific response formats.

## 20. Recovery and Resumability

Long workflows must recover after:

- refresh
- logout/login
- device switch
- provider timeout
- transient server error
- temporary rate limit

On return, ATLAS Assistant summarizes:

- what completed
- what is currently running or paused
- what failed
- what is blocked
- what requires approval
- the next actionable step

## 21. Error Semantics

Canonical error classes:

- `invalid_input`
- `unauthenticated`
- `forbidden`
- `approval_required`
- `provider_not_configured`
- `provider_unverified`
- `provider_unavailable`
- `rate_limited`
- `budget_blocked`
- `dependency_blocked`
- `validation_failed`
- `ambiguous_external_result`
- `internal_error`

Errors preserve trace IDs and never expose provider secrets.

## 22. Data and Security Requirements

- Tenant and organization boundaries are enforced server-side.
- RLS applies to workflow, task, approval, evidence, usage and sensitive-document records.
- Service-role credentials never reach the browser.
- Secrets remain in authorized secret storage.
- PII is minimized in prompts and logs.
- Sensitive document access is logged.
- Provider payloads are normalized before persistence.
- External mutations use idempotency where supported.
- High-impact ambiguous results require reconciliation rather than automatic replay.

## 23. Shared Data Model

The first implementation milestone should introduce scoped tables equivalent to:

- `atlas_workflows`
- `atlas_workflow_steps`
- `atlas_workflow_events`
- `atlas_approval_requests`
- `atlas_evidence`
- `atlas_provider_registry`
- `atlas_provider_probes`
- `atlas_usage_events`
- `atlas_document_sources`
- `atlas_document_fields`

Domain-specific tables remain inside their modules.

## 24. User Experience Contract

All participating modules expose the same operational concepts:

- **Now** — work the system can execute or the user can act on immediately.
- **Next** — queued work with dependencies satisfied or nearly satisfied.
- **Blocked** — cannot proceed; show the exact blocker.
- **Awaiting approval** — a decision is required and linked to Approval Center.
- **Completed** — verified according to the workflow's completion policy.

ATLAS Assistant is contextual across modules and always shows a concrete next action instead of only explaining a problem.

## 25. Testing Strategy

Required layers:

1. Unit tests for workflow transitions, policy decisions, permissions, retries, idempotency and evidence completion rules.
2. Database tests for RLS isolation across organizations and users.
3. Integration tests for workflow → approval → execution → evidence.
4. Provider adapter contract tests with unconfigured, verified, degraded and failed states.
5. Recovery tests for refresh/resume and retry behavior.
6. Security tests proving forbidden users cannot read or mutate another organization's workflows, approvals or sensitive document fields.
7. Domain tests for Tax, Finance, Pay, Music and Weather adapters.
8. Production verification only after build/test/deploy evidence exists.

## 26. Implementation Sequence

The approved dependency order is:

1. Universal Execution Core data/contracts/state machine.
2. Universal RBAC and server-side policy enforcement.
3. Approval Center.
4. Agent Runtime + Tool Registry + Provider Registry.
5. Evidence, Audit and Cost/Usage governance.
6. Recovery/resumability and ATLAS Assistant progress surfaces.
7. Studio Music and shared Creator Library persistence.
8. Financial Modeling + Document Intelligence.
9. Tax Execution Agent.
10. ATLAS Pay / Wallet & Cards.
11. Weather Context Service.
12. Secondary module integrations.

ATLAS Director continues on its own approved feature branch/plan but should adopt these shared contracts when compatible.

## 27. Explicit Non-Goals for the Core Milestone

The core milestone does not:

- fake provider connectivity
- automatically file taxes
- issue cards
- move money
- bypass explicit approvals
- replace Director's existing feature plan
- invent metrics or generated assets
- claim production readiness before verification
- store raw payment secrets in application persistence

## 28. Acceptance Criteria

The Universal Execution Core is ready for dependent-module adoption when all of the following are verified:

- workflows persist across sessions and devices
- state transitions are deterministic and tested
- tenant and organization isolation is proven
- universal permissions are server-enforced
- Approval Center gates configured sensitive actions
- tools/providers expose verified readiness states
- execution generates audit events and evidence
- cost/usage is attributable to user, organization and task
- failed/ambiguous external mutations do not replay unsafely
- ATLAS Assistant can report Now / Next / Blocked / Awaiting Approval / Completed from real persisted state
- no provider or module reports fake connected/live/completed states

## 29. Design Decision

ATLAS will prioritize execution infrastructure over additional isolated UI modules. New capabilities must integrate with this execution contract unless an approved exception documents why they cannot.
