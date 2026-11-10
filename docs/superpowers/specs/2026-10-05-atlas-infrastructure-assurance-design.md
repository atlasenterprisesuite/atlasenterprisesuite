# ATLAS Infrastructure Assurance — Provider-neutral production readiness, resilience, compliance and portability

Date: 2026-10-05  
Status: Approved design — implementation planning pending  
Scope: ATLAS Manager / ATLAS Cloud / Release Control / Security / Compliance / Observability  
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`

## Objective

Convert the Supabase strategic dossier into a native ATLAS capability that continuously answers whether critical infrastructure is ready, resilient, compliant, cost-aware and portable, using evidence rather than configuration claims.

The feature MUST NOT become a standalone “Supabase Center” or another duplicate control plane. It extends the existing ATLAS Manager and provider-neutral deployment architecture, reuses Release Control, Cloud, Governance, Observability and the Master Evidence Registry, and introduces a provider-neutral Infrastructure Assurance model with Supabase as the first adapter.

The design preserves the existing production authority:

`GitHub → ATLAS Manager / Supabase control plane → Cloudflare → Production`

Supabase remains the primary backend/control-plane provider for current production, but ATLAS MUST retain business logic, policy, audit, evidence and portability above provider-specific APIs.

## Source baseline

This design incorporates the validated 18-page `ATLAS Enterprise Suite × Supabase — Dossier estratégico y técnico para reunión` dated 2026-10-05. The dossier establishes these requirements:

- Supabase Read Replicas are not equivalent to automatic cross-region disaster recovery.
- ATLAS requires explicit RTO/RPO, failover and multi-region evidence before claiming continuity.
- PITR improves recovery capability but does not guarantee instant restore or fixed RTO.
- Supabase SOC 2 / HIPAA capabilities do not make ATLAS automatically compliant; shared responsibility must be explicit.
- PrivateLink coverage must be represented by actual covered services, not as blanket private connectivity.
- Compute, Realtime, Edge Functions, connection limits, backup/restore, support, cost and portability must be measurable.
- Provider claims, commercial terms and support commitments must be represented as evidence with confidence and verification dates.
- Secrets and operational credentials must never be exposed through UI or audit artifacts.

## Existing ATLAS assets to reuse

Infrastructure Assurance MUST reuse existing current-main capabilities when available instead of introducing parallel implementations:

- `ATLAS Manager` as infrastructure control plane and deployment brain.
- `packages/core/src/deploymentControl.ts` provider-neutral deployment contracts.
- `atlas-infra-status`.
- `atlas-infra-evidence`.
- `atlas-runtime-verifier`.
- `atlas-sovereign-control-plane`.
- `atlas-platform-controls`.
- `atlas-repair-bridge`.
- `atlas-enterprise-web`.
- `atlas_release_registry`.
- `atlas_runtime_verification_runs`.
- `atlas_master_evidence_registry`.
- `atlas_approvals`.
- `atlas_integration_connections`.
- existing identity, tenancy, RBAC, RLS, audit, observability and provider-readiness controls.

No capability may be duplicated merely to satisfy the UI design in this spec.

## Product position

Infrastructure Assurance is a cross-cutting ATLAS Manager capability, surfaced through ATLAS Cloud and consumed by Release Control, Security, Compliance and executive readiness views.

Recommended protected route:

`/cloud/infrastructure-assurance`

Primary sections:

- Overview
- Providers
- Supabase
- Resilience
- Compliance
- Capacity
- Cost
- Portability
- Evidence

Release Control MUST show only the release-blocking subset of Infrastructure Assurance and link to the detailed assurance view. Release Control MUST NOT absorb the complete resilience/compliance/cost feature set.

## Core architecture

```text
Provider APIs / provider evidence / approved operator inputs
                         │
                         ▼
                 ProviderAdapter
                         │
                         ▼
                  CapabilityProbe
                         │
                         ▼
                  EvidenceNormalizer
                         │
                         ▼
                   PolicyEvaluator
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
       Readiness      Risk/Fitness   Gating
            │            │            │
            └────────────┼────────────┘
                         ▼
             Master Evidence Registry
                         │
     ┌───────────────────┼────────────────────┐
     ▼                   ▼                    ▼
Release Control     Cloud / Manager      Security / Compliance
```

Provider-specific APIs and data remain behind adapters. ATLAS-owned policy MUST NOT depend directly on Supabase response shapes.

## Normalized truth model

Every assurance fact MUST distinguish three states:

- `desired`: what ATLAS policy requires.
- `observed`: what the provider or runtime currently reports.
- `verified`: what ATLAS has independently verified with acceptable evidence.

A fact MUST NOT collapse these into one boolean.

Canonical assurance status values:

- `verified`
- `partially_verified`
- `unverified`
- `unknown`
- `blocked`
- `not_applicable`
- `degraded`
- `failed`

The UI MUST NOT render `ready`, `healthy`, `compliant`, `private`, `resilient`, `production`, `connected`, `failover_ready` or equivalent claims unless the underlying verified evidence supports that label.

## Provider model

### Provider profile

A provider profile represents a configured infrastructure provider without implying readiness.

```ts
export type InfrastructureProviderProfile = {
  providerId: string;
  providerKind: 'supabase' | 'cloudflare' | 'vercel' | 'aws' | 'self_hosted' | 'other';
  displayName: string;
  organizationId: string;
  environment: 'preview' | 'staging' | 'production';
  authoritativeFor: string[];
  optionalFor: string[];
  connectionEvidenceRef: string | null;
  lastObservedAt: string | null;
};
```

Provider presence MUST NOT imply provider readiness.

### Provider adapter contract

```ts
export interface InfrastructureAssuranceProviderAdapter {
  providerKind: InfrastructureProviderProfile['providerKind'];
  probeCapabilities(ctx: ProbeContext): Promise<ProviderCapabilitySnapshot>;
  probeResilience(ctx: ProbeContext): Promise<ProviderResilienceSnapshot>;
  probeCompliance(ctx: ProbeContext): Promise<ProviderComplianceSnapshot>;
  probeCapacity(ctx: ProbeContext): Promise<ProviderCapacitySnapshot>;
  probeCost(ctx: ProbeContext): Promise<ProviderCostSnapshot>;
  probePortability(ctx: ProbeContext): Promise<ProviderPortabilitySnapshot>;
}
```

The first adapter is `SupabaseProviderAdapter`. Future provider adapters MUST implement the same normalized boundaries rather than adding provider-specific branches throughout ATLAS.

## Supabase adapter scope

The Supabase adapter MUST normalize evidence for:

- project identity and environment binding;
- region;
- compute tier and capacity;
- direct database connections;
- pooler capacity;
- database health;
- RLS/tenant-isolation readiness evidence;
- Auth readiness;
- Storage readiness;
- Realtime limits/readiness;
- Edge Functions limits/readiness;
- backup mode;
- PITR configuration;
- restore-test evidence;
- read-replica topology;
- replication lag where available;
- regional-resilience assumptions;
- network restrictions;
- SSL enforcement;
- PrivateLink coverage by service boundary;
- platform audit logs;
- SSO/MFA governance evidence;
- support/SLA evidence when contractually available;
- compliance evidence/attestations;
- usage and cost inputs;
- migration/export/portability evidence.

Secrets MUST remain server-side. The adapter may store secret references or provider connection IDs but never raw credentials in the application database, client bundle, source control, logs or evidence payloads.

## Assurance domains

### 1. Production readiness

Answers:

- Is the required provider configured?
- Is the correct project/environment authoritative?
- Is the provider reachable?
- Is runtime health verified?
- Does observed runtime state match intended release state?

Release Control consumes this domain directly.

### 2. Tenant isolation

Required controls for shared multi-tenant Supabase workloads:

- mandatory tenant scope where appropriate;
- RLS on exposed multi-tenant tables;
- policy coverage for read/write/update/delete paths;
- server-side service-role use only;
- automated cross-tenant leakage tests;
- access logging sufficient for investigation;
- reproducible migrations;
- tenant-aware indexing where required.

High-risk or contractually isolated tenants may require dedicated projects/databases/networking. Infrastructure Assurance MUST represent isolation policy and evidence without assuming shared tenancy is always acceptable.

### 3. Resilience / HA / DR

This domain MUST model these concepts separately:

- redundancy;
- read scaling;
- backup;
- PITR;
- restore capability;
- same-region availability;
- cross-region replication;
- failover;
- failback;
- RPO;
- RTO.

Read Replicas MUST NOT satisfy `failover_ready` by themselves.

Canonical resilience checks:

```text
primary_region_known
backup_config_verified
pitr_config_verified
restore_drill_recent
restore_duration_observed
rpo_target_defined
rpo_observed_or_bounded
rto_target_defined
rto_observed_or_contractual
cross_region_topology_known
cross_region_failover_runbook_verified
service_dependency_recovery_verified
failback_runbook_verified
```

### P0 rule — cross-region failover

If the provider does not support automatic cross-region failover for the relevant workload, Infrastructure Assurance MUST report this explicitly and MUST NOT synthesize a green DR state from replica presence.

For Supabase, resilience reporting MUST account separately for Postgres, Auth, Storage, Realtime and Edge Functions. Recovery evidence for Postgres alone is insufficient to claim full application recovery.

### 4. Backup / PITR / restore

Infrastructure Assurance MUST distinguish configured backup from proven recovery.

Required evidence fields:

```ts
export type RecoveryEvidence = {
  backupMode: 'daily_backup' | 'pitr' | 'external' | 'none' | 'unknown';
  retentionDays: number | null;
  lastSuccessfulBackupAt: string | null;
  lastRestoreDrillAt: string | null;
  restoreTarget: string | null;
  observedRestoreDurationSeconds: number | null;
  declaredRpoSeconds: number | null;
  declaredRtoSeconds: number | null;
  providerContractRef: string | null;
  runbookEvidenceRef: string | null;
};
```

A configured backup without a successful restore drill MUST be rendered as backup-enabled but recovery-unverified.

### 5. Security / networking

The UI and policy engine MUST describe actual coverage, not marketing shorthand.

For Supabase PrivateLink, the model MUST distinguish covered and uncovered service paths. A database-private state MUST NOT imply that Auth, Storage, Realtime or API traffic is private unless independently proven.

Required normalized categories:

- public endpoint exposure;
- database private connectivity;
- API exposure;
- Auth exposure;
- Storage exposure;
- Realtime exposure;
- IP/network restrictions;
- TLS/SSL enforcement;
- administrator MFA;
- SSO;
- audit-log export;
- privileged-access review;
- emergency/break-glass access controls.

### 6. Compliance and shared responsibility

Infrastructure Assurance MUST separate provider evidence from ATLAS-owned control evidence.

```ts
export type SharedResponsibilityControl = {
  controlId: string;
  framework: 'SOC2' | 'ISO27001' | 'HIPAA' | 'PCI' | 'custom';
  responsibility: 'provider' | 'atlas' | 'shared';
  providerEvidenceRef: string | null;
  atlasEvidenceRef: string | null;
  status: AssuranceStatus;
  expiresAt: string | null;
};
```

Provider certification MUST NOT set ATLAS compliance status to verified by itself.

For PHI-capable workloads, ATLAS MUST remain fail-closed until the required contractual and technical controls are verified. The Supabase adapter should be able to represent BAA status, HIPAA add-on status and required project controls where evidence is available, but Infrastructure Assurance MUST NOT infer legal/compliance approval from partial configuration.

### 7. Capacity

Capacity MUST be based on measured and contractual limits, not static plan names.

Signals may include:

- CPU;
- memory;
- database connections;
- pooler saturation;
- disk size;
- IOPS/throughput;
- query latency;
- Edge Function invocation/CPU/wall-clock limits;
- Realtime concurrent connections;
- Realtime messages/sec;
- storage usage;
- egress;
- Auth MAUs;
- rate-limit responses.

ATLAS policy MUST support warning and critical thresholds before provider hard limits are reached.

Suggested normalized states:

- `<70%`: nominal
- `70–84%`: watch
- `85–94%`: warning
- `>=95%`: critical

Provider-specific exceptions may override these thresholds only through policy configuration with audit evidence.

### 8. Cost

Infrastructure Assurance MUST track cost as a first-class provider risk.

Cost drivers include:

- subscription/tier;
- compute;
- additional projects;
- disk/IOPS/throughput;
- PITR;
- egress;
- Storage;
- Edge Functions;
- Realtime;
- Auth/SSO MAUs;
- logs/drains;
- IPv4/custom domains if applicable;
- replicas;
- staging/DR environments;
- enterprise support.

Cost MUST support scenario modeling:

- current;
- 10× growth;
- enterprise-critical.

The product MAY show estimates, but estimates MUST be labeled as estimates and MUST include source date and assumptions.

### 9. Portability / vendor lock-in

Infrastructure Assurance MUST score provider dependency and document an exit path.

Portability dimensions:

- Postgres schema portability;
- data export path;
- migration tooling;
- Auth dependency;
- Storage dependency;
- Realtime dependency;
- Edge Function/runtime dependency;
- provider-specific networking dependency;
- secrets migration;
- DNS/edge migration;
- contractual termination/export support;
- estimated migration complexity.

ATLAS MUST preserve the logical boundary:

```text
ATLAS Application Layer
        ↓
ATLAS Security / Data / Audit / Orchestration Abstraction
        ↓
Provider Adapter
        ↓
Provider Services
```

Business logic MUST remain ATLAS-owned.

## Provider Fitness Score

The dossier decision scorecard becomes a first-class `Provider Fitness Score`.

Default weighting:

| Area | Weight |
| --- | ---: |
| Reliability / regional resilience | 20% |
| Security | 15% |
| Compliance | 15% |
| Scalability | 15% |
| Operational support | 10% |
| Cost predictability | 10% |
| Portability | 10% |
| Developer velocity | 5% |

Score interpretation:

- `>= 4.25`: strong strategic fit
- `3.50–4.24`: viable with mitigations
- `2.75–3.49`: selective use; preserve stronger abstraction/multi-provider plan
- `< 2.75`: do not deepen dependency until gaps are resolved

The score MUST show its evidence freshness, missing evidence and confidence. A high score with stale or unknown evidence MUST NOT be presented as current verified readiness.

## Evidence model

Every normalized assurance claim MUST point to evidence.

```ts
export type InfrastructureAssuranceEvidence = {
  evidenceId: string;
  organizationId: string;
  providerId: string;
  domain: string;
  claim: string;
  observedValue: unknown;
  status: AssuranceStatus;
  sourceType: 'provider_api' | 'runtime_probe' | 'contract' | 'document' | 'operator_attestation' | 'test_run';
  sourceRef: string | null;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  observedAt: string;
  expiresAt: string | null;
  supersedesEvidenceId: string | null;
};
```

Evidence SHOULD persist in or reference `atlas_master_evidence_registry` rather than creating a second provenance system.

Evidence rules:

- append-only provenance;
- supersession instead of silent overwrite;
- immutable source timestamps;
- no secrets in evidence payloads;
- confidence and source type visible;
- stale evidence degrades readiness;
- contract claims require a document/evidence reference;
- operator attestation alone cannot satisfy technical P0 gates when a machine-verifiable probe is expected.

## Policy model

Policies determine whether evidence satisfies ATLAS requirements.

Example:

```ts
export type InfrastructureAssurancePolicy = {
  policyId: string;
  organizationId: string;
  environment: 'staging' | 'production';
  domain: string;
  requirement: string;
  severity: 'P0' | 'P1' | 'P2';
  requiredStatus: AssuranceStatus;
  maxEvidenceAgeSeconds: number | null;
  blocking: boolean;
};
```

Examples of P0 policies:

- production provider identity verified;
- runtime health verified;
- tenant isolation verified for exposed multi-tenant data;
- backup configured;
- restore evidence within policy window for critical workloads;
- RPO/RTO defined for critical workloads;
- no fabricated cross-region failover claim;
- required compliance contractual gates complete before regulated workloads;
- exact release/runtime SHA verified when used as a deployment gate;
- required secrets remain server-side.

## UI design

### Overview

The Overview shows:

- production provider profile;
- global assurance state;
- Provider Fitness Score;
- P0/P1 blockers;
- evidence freshness;
- resilience posture;
- compliance posture;
- capacity pressure;
- current and projected cost;
- portability risk;
- last verification timestamp.

No decorative green state may appear without evidence.

### Supabase view

The Supabase view shows normalized ATLAS facts, not a raw provider-console clone:

- project/region/compute;
- connection headroom;
- database/runtime health;
- Auth/Storage/Realtime/Functions readiness;
- backups/PITR;
- replicas;
- DR readiness;
- networking coverage;
- audit/governance controls;
- compliance evidence;
- cost drivers;
- provider limits;
- open risks;
- next recommended actions.

### Resilience view

Must clearly separate:

- Backup configured
- Restore tested
- Replica available
- Cross-region recovery designed
- Failover tested
- Failback tested

These states MUST never be merged into one “HA enabled” badge.

### Compliance view

Displays a responsibility matrix with Provider / ATLAS / Shared controls and their evidence state.

### Capacity view

Displays measured headroom, policy thresholds, provider limits, trend and predicted exhaustion where sufficient data exists.

### Cost view

Displays current spend inputs, estimated scenarios, highest-risk cost drivers and confidence/assumption labels.

### Portability view

Displays provider-specific coupling and the documented migration/exit path by subsystem.

### Evidence view

Allows authorized users to inspect:

- claim;
- evidence source;
- timestamp;
- confidence;
- supersession chain;
- related policy;
- verification result.

The UI MUST redact all secret material.

## Release Control integration

Release Control consumes only assurance facts that are release-relevant.

Example release gate summary:

```text
Infrastructure Assurance
├─ Provider identity               VERIFIED
├─ Runtime health                  VERIFIED
├─ Required capacity               VERIFIED
├─ Tenant isolation                VERIFIED
├─ Backup readiness                VERIFIED
├─ Recovery evidence               WARNING / BLOCKED by policy
├─ Required compliance gates       VERIFIED / BLOCKED
└─ Evidence freshness              VERIFIED
```

Release Control MUST link to the detailed Infrastructure Assurance evidence instead of duplicating it.

Infrastructure Assurance MUST NOT weaken current exact-SHA, CI, production-readiness or fail-closed release rules.

## Security model

- RBAC and tenant isolation reuse canonical ATLAS identity and permissions.
- Provider credentials remain server-side in approved secret stores.
- Service-role credentials are never sent to browser code.
- Audit evidence records action metadata, not secret values.
- Sensitive provider documents require authorization and retention policy.
- Contractual/compliance documents require access logging.
- Admin actions with infrastructure impact should use existing ATLAS approvals/governance where risk level requires it.
- P0 policy overrides require auditable authorization; overrides do not rewrite historical evidence.

## Disclosure policy

The platform MUST explicitly prevent sensitive meeting/support artifacts from exposing:

- service-role keys;
- database passwords;
- API secrets;
- JWT secrets;
- private keys;
- production tokens;
- customer data;
- PHI;
- payment credentials;
- CI/CD credentials;
- unnecessary internal exploit/vulnerability details.

External reports should include logical architecture and requirements, not live secrets.

## Error handling

Provider and probe failures MUST be classified, not flattened into `false`.

Failure categories:

- `provider_unconfigured`
- `provider_auth_failed`
- `provider_unreachable`
- `provider_rate_limited`
- `probe_timeout`
- `unsupported_capability`
- `insufficient_permissions`
- `stale_evidence`
- `contract_evidence_missing`
- `policy_failure`
- `runtime_failure`
- `unknown_failure`

Rules:

- A failed probe MUST NOT erase the last known evidence.
- Last known evidence may remain visible but MUST become stale/degraded according to policy.
- Provider outage and ATLAS application failure MUST remain distinguishable.
- Rate limits MUST use backoff/backpressure and MUST NOT trigger noisy repeated probes.
- Unsupported capabilities MUST render as unsupported/unknown, never green.

## Observability

Infrastructure Assurance SHOULD emit normalized metrics/events for:

- probe duration;
- probe failures;
- provider rate limits;
- evidence age;
- assurance state changes;
- P0/P1 blockers;
- restore-test age;
- capacity threshold crossings;
- cost threshold crossings;
- provider fitness score changes;
- operator overrides;
- compliance evidence expiry.

These SHOULD feed existing ATLAS Observability rather than introducing a separate monitoring stack.

## Data persistence

Implementation planning should prefer additive tables or extension of existing infrastructure/evidence tables rather than parallel truth stores.

Potential additive concepts if current schema cannot represent them cleanly:

- `atlas_infrastructure_provider_profiles`
- `atlas_infrastructure_assurance_policies`
- `atlas_infrastructure_assurance_snapshots`
- `atlas_infrastructure_capacity_metrics`
- `atlas_infrastructure_cost_snapshots`

Evidence provenance SHOULD remain centralized through `atlas_master_evidence_registry` or a compatible extension.

All new provider/assurance tables require organization/tenant RLS and least-privilege grants.

## API boundaries

Browser clients MUST consume authenticated ATLAS APIs, not provider admin APIs directly.

Example logical endpoints:

```text
GET  /api/infrastructure-assurance/overview
GET  /api/infrastructure-assurance/providers
GET  /api/infrastructure-assurance/providers/:providerId
GET  /api/infrastructure-assurance/resilience
GET  /api/infrastructure-assurance/compliance
GET  /api/infrastructure-assurance/capacity
GET  /api/infrastructure-assurance/cost
GET  /api/infrastructure-assurance/portability
GET  /api/infrastructure-assurance/evidence
POST /api/infrastructure-assurance/probes/:domain/run
```

Mutating actions MUST require appropriate RBAC and governance approval based on risk.

## Testing strategy

Implementation MUST follow TDD.

### Unit tests

Cover:

- desired/observed/verified state separation;
- policy evaluation;
- evidence freshness;
- confidence handling;
- provider adapter normalization;
- Provider Fitness Score weighting;
- unsupported capability handling;
- secret redaction;
- resilience-state separation;
- cost-estimate confidence labels.

### Contract tests

Supabase adapter contract tests MUST prove:

- provider-specific payloads normalize correctly;
- missing provider fields do not become green defaults;
- Read Replica presence does not imply failover readiness;
- PrivateLink database coverage does not imply full-service private connectivity;
- backup configuration does not imply restore verification;
- compliance provider evidence does not imply ATLAS compliance.

### Database/RLS tests

Prove:

- cross-organization isolation;
- least-privilege grants;
- evidence immutability/supersession behavior;
- policy access controls;
- cost/capacity data tenant isolation.

### UI tests

Prove:

- unknown/unverified/blocked states render distinctly;
- stale evidence is visible;
- P0 blockers cannot render as ready;
- detailed evidence links work;
- secret values never render;
- release view only consumes release-relevant assurance facts.

### E2E tests

Prove end-to-end:

1. provider configured → probe → normalized evidence → policy result → UI;
2. stale evidence degrades readiness;
3. failed restore evidence blocks applicable P0 policy;
4. replica-only topology remains non-failover-ready;
5. regulated workload remains blocked until required compliance gates are verified;
6. Release Control consumes assurance without duplicating provider truth;
7. current production provider failures remain distinguishable from optional provider failures.

## Initial rollout

### Wave 1 — Supabase evidence foundation

- provider profile;
- normalized Supabase adapter;
- compute/capacity facts;
- backup/PITR facts;
- replica/resilience facts;
- security/networking facts;
- evidence persistence;
- protected Overview + Supabase + Evidence views.

### Wave 2 — Policy and release gates

- assurance policies;
- P0/P1 blocker evaluation;
- Release Control integration;
- evidence freshness;
- readiness summaries.

### Wave 3 — Recovery assurance

- restore-drill evidence;
- RPO/RTO model;
- DR runbook evidence;
- service-by-service regional recovery state;
- failover/failback verification model.

### Wave 4 — Compliance assurance

- provider/ATLAS/shared responsibility matrix;
- SOC 2 evidence mapping;
- HIPAA/BAA gating where applicable;
- evidence expiry and review reminders.

### Wave 5 — Cost and capacity intelligence

- threshold policies;
- trend/history;
- scenario modeling;
- cost-risk alerts;
- projected capacity exhaustion.

### Wave 6 — Portability and multi-provider

- provider coupling score;
- migration/exit evidence;
- Cloudflare/Vercel/AWS/self-hosted adapters as justified;
- provider comparison using the same normalized assurance model.

## Non-goals

This design does not authorize:

- replacing Supabase immediately;
- purchasing or upgrading to Enterprise automatically;
- claiming SOC 2, ISO 27001 or HIPAA compliance for ATLAS without ATLAS-owned evidence;
- claiming cross-region automatic failover when the provider does not support/prove it;
- building a second release control plane;
- building a second audit/evidence ledger;
- storing provider secrets in source or client-side state;
- auto-negotiating or accepting provider contracts;
- fabricating SLA, support or commercial terms not represented by written evidence.

## Success criteria

Infrastructure Assurance is successful when ATLAS can answer, with current evidence and without provider-console guesswork:

- Are we production-ready now?
- Which provider facts are observed vs independently verified?
- What happens if the primary region fails?
- What is our actual or contractually bounded RPO/RTO?
- Has recovery been tested recently?
- Which compliance controls are provider-owned, ATLAS-owned or shared?
- Which P0/P1 infrastructure risks block release?
- Which provider limit are we approaching?
- What are the highest cost risks?
- Can ATLAS migrate this workload without rebuilding the product?
- Which claims are stale, unknown or unsupported?

No answer may be labeled verified without corresponding evidence.

## Implementation gate

This document defines architecture and product behavior only. It does not authorize implementation beyond documentation.

The next allowed step is a detailed implementation plan created from this spec. Implementation may begin only after the written spec is reviewed and explicitly approved.
