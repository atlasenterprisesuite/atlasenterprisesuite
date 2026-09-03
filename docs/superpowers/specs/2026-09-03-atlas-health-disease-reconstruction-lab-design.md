# ATLAS Health — Disease Reconstruction Lab Design

Date: 2026-09-03
Status: Approved architecture, awaiting written-spec review before implementation
Repository: `atlasenterprisesuite/atlasenterprisesuite`

## 1. Objective

Build the first production-oriented foundation of ATLAS Enterprise Suite around a reusable enterprise shell and the initial ATLAS Health research subsystem:

`ATLAS Enterprise Suite → ATLAS Health → Research & Innovation → Health Frontiers → Disease Reconstruction Lab`

The module must function as a governed biomedical research workspace that links diseases, mechanisms, evidence, contradictions, therapeutic vulnerabilities, relapse/escape routes, repair needs, and durable surveillance concepts without presenting hypotheses as cures or clinical recommendations.

## 2. Initial Scope

The first implementation milestone includes:

- Enterprise application shell and responsive navigation.
- ATLAS Health landing route.
- Research & Innovation workspace.
- Health Frontiers workspace.
- Disease Reconstruction Lab.
- Disease workspaces for HIV, cancers/leukemias, type 1 diabetes and autoimmune disease, fibrosis, Alzheimer’s disease, Parkinson’s disease, and an extensible persistent-disease category.
- ATLAS Health Neural Graph.
- Evidence Registry.
- Falsification Engine.
- Reconstruction Vulnerability Engine.
- Curability Index.
- Local development persistence only until an authorized production datastore is configured.
- Tests for navigation, evidence-state rules, graph data integrity, falsification behavior, and responsive flows.

Out of scope for this milestone:

- Patient diagnosis, treatment recommendations, medication dosing, or clinical decision support.
- Live EHR/FHIR/HL7 data.
- Live hospital metrics.
- Autonomous experimentation or laboratory protocols.
- Claims of cure without reproducible human evidence.
- Production identity, billing, or external healthcare integrations unless separately configured and validated.

## 3. Repository Architecture

Use a monorepo-style structure from the start to avoid future module fragmentation:

```text
apps/
  web/
    app/
      health/
        research/
          frontiers/
            disease-reconstruction/
packages/
  core/
    auth-contracts/
    rbac/
    audit/
    tenancy/
    ui/
    validation/
  health/
    evidence/
    neural-graph/
    falsification/
    reconstruction/
    curability/
    disease-registry/
data/
  research/
    diseases/
    evidence/
    graph/
tests/
  unit/
  integration/
  e2e/
```

The first implementation may use a single web application and shared packages, but route ownership and domain boundaries must follow this structure.

## 4. Navigation

Primary navigation:

`ATLAS Enterprise Suite`
→ `Health`
→ `Research & Innovation`
→ `Health Frontiers`
→ `Disease Reconstruction Lab`

Inside Disease Reconstruction Lab:

- Overview
- Diseases
- Neural Graph
- Evidence Registry
- Falsification
- Vulnerability Engine
- Curability Index
- Research Updates
- Settings

Disease workspace depth:

`Disease → Mechanisms → Evidence → Reconstruction System → Vulnerabilities → Therapies → Failures / Contradictions → Surveillance`

All navigation elements must have real routes or functional state transitions. No placeholder links or `href="#"`.

## 5. Core Data Model

### Disease

- id
- slug
- name
- category
- description
- active_research_status
- curability_level
- created_at
- updated_at

### EvidenceRecord

- id
- disease_ids[]
- title
- source_type
- source_name
- source_url or source_identifier
- publication_date
- evidence_level
- study_design
- population_or_model
- sample_size
- finding
- limitations
- safety_signals
- replication_status
- regulatory_status
- confidence
- status

Allowed `evidence_level` values:

- human_randomized
- human_interventional
- human_observational
- human_case_report
- preclinical_animal
- preclinical_organoid
- in_vitro
- mechanistic
- hypothesis

Allowed `status` values:

- active
- supported
- mixed
- contradicted
- falsified
- retracted
- superseded

### GraphNode

- id
- type
- label
- description
- disease_ids[]
- evidence_record_ids[]
- confidence
- status

Initial node types include:

- seed
- reservoir
- niche
- target_state
- pathological_memory
- reconstruction_capacity
- visibility
- therapeutic_access
- selection_history
- immune_escape
- mechanical_memory
- maladaptive_repair
- pathological_inertia
- regulatory_balance
- sentinel_fitness
- surveillance_cost
- pathological_delegation
- repairability
- host_state
- therapeutic_state

### GraphEdge

- id
- source_node_id
- target_node_id
- relation_type
- direction
- evidence_record_ids[]
- confidence
- status
- falsification_notes

### FalsificationRecord

- id
- hypothesis_or_edge_id
- challenge_type
- counterexample
- contradictory_evidence_ids[]
- escape_route
- safety_limitation
- relapse_evidence
- conclusion
- resulting_status

### VulnerabilityProfile

Per disease:

- seed_score
- visibility_score
- reservoir_score
- niche_score
- adaptation_score
- repairability_score
- therapeutic_access_score
- relapse_risk_score
- sentinel_fitness_dependency
- surveillance_cost_score
- selection_history_score
- delegation_burden_score
- reconstruction_risk

Scores are research-model outputs, not clinical risk scores. They must be labeled as research-only and show their evidence basis.

## 6. Reconstruction Vulnerability Engine

The engine answers research questions rather than prescribing treatment:

1. What biological state can seed or reconstruct the disease?
2. Which states are visible or invisible to current interventions?
3. Which anatomical or cellular niches protect them?
4. What adaptation routes are documented?
5. What costs or dependencies are created by adaptation?
6. What damage remains after source control?
7. What repair is biologically required?
8. What form of surveillance could detect recurrence or reconstruction?

The first version must use transparent rule-based calculations based on stored evidence metadata. No opaque AI-generated numeric score may be displayed as scientific truth.

## 7. Falsification Engine

Every hypothesis, graph edge, and proposed cross-disease connection must support an explicit falsification panel.

Required fields:

- strongest supporting evidence
- strongest contradictory evidence
- known counterexamples
- failed or negative trials
- safety limitations
- escape routes
- relapse or rebound evidence
- alternative explanations
- evidence gaps
- current verdict

A connection cannot be labeled `supported` solely from correlation. Causal language requires appropriate evidence.

## 8. Curability Index

ATLAS uses a research classification rather than a binary cure label:

- C0: no established disease-modifying therapy
- C1: symptom control
- C2: disease progression can be modified
- C3: remission possible
- C4: durable treatment-free remission documented in selected patients
- C5: reproducible individual cure in a defined disease/subtype
- C6: population-level elimination achievable
- C7: global eradication

Each level must link to evidence and may vary by disease subtype.

The UI must never upgrade a disease to C5-C7 based on a single case report, preclinical model, hypothesis, or biomarker response.

## 9. Neural Graph UX

The graph is a research navigation surface, not decorative visualization.

Users must be able to:

- filter by disease
- filter by evidence level
- filter by status
- inspect a node
- inspect an edge
- open supporting evidence
- open contradictory evidence
- compare the same mechanism across diseases
- view confidence and uncertainty
- identify unsupported hypotheses
- trace reconstruction paths

Initial reconstruction path model:

`Seed → State → Niche → Adaptation → Reconstruction → Relapse`

Cross-cutting modifiers:

`Host State`, `Selection History`, `Regulatory Balance`, `Therapeutic State`, `Repairability`, `Surveillance Cost`.

## 10. Disease Workspaces

### HIV

Focus on reservoir competence, rebound, immune selection, therapeutic access, escape, host state, treatment-free remission evidence, and surveillance.

### Cancer and Leukemias

Focus on clonal heterogeneity, minimal residual disease, target loss, resistant populations, metabolic dependencies, microenvironment, immune escape, relapse, and lineage reconstruction.

### Type 1 Diabetes / Autoimmunity

Focus on autoreactive memory, beta-cell state, pathogenic lineage coverage, tolerance rebuilding, replacement-cell survival, immune surveillance, and recurrence.

### Fibrosis

Focus on mechanical memory, pathological matrix feedback, fibroblast/stromal state, intercellular signaling, maladaptive repair, and reversibility.

### Alzheimer’s Disease

Focus on pre-pathology states, amyloid/tau context, microglia, oligodendrocytes, network maintenance, resilience, pathological payload, and irreversible damage.

### Parkinson’s Disease

Focus on mechanistic subtypes, alpha-synuclein state/proteoforms, mitochondrial/proteostasis failure, neuronal vulnerability, payload clearance, and resilience.

## 11. Security and Governance

Apply ATLAS security principles from the first commit:

- least privilege
- no secrets in source
- clear dev/staging/production separation
- audit-ready mutation events
- tenant-aware contracts even before multi-tenant production storage exists
- no fabricated integration state
- no patient-identifiable data in seed/demo datasets
- provenance for every evidence record
- explicit research-only labeling

## 12. UI Direction

Use the approved ATLAS visual language:

- dark blue/black enterprise background
- restrained cyan/blue accents
- metallic/technical visual hierarchy
- glass-like panels where appropriate
- minimal text density on dashboard surfaces
- richer detail views for research records
- responsive desktop, tablet, and mobile layouts

No copied proprietary UI, logos, or backend behavior from external products.

## 13. Empty, Loading, Error, and Safety States

Every major surface must implement:

- loading
- empty
- partial-data
- validation error
- fetch/storage error
- unsupported-evidence state
- contradicted/falsified state
- no-production-integration-configured state

No fake metrics should fill empty dashboards.

## 14. Testing Gates

Before completion claims:

- build succeeds
- type checks pass
- lint passes
- unit tests pass
- route tests pass
- graph integrity tests pass
- evidence-state rules pass
- falsification status transitions pass
- Curability Index guardrails pass
- no route returns 404/500 in supported flows
- responsive views verified
- no placeholder actions
- no secrets committed
- no unsupported cure claims in seed data or UI

## 15. Production Gates

Production status requires evidence of:

1. successful build
2. successful tests
3. authorized hosting configuration
4. authorized datastore configuration
5. health endpoint / deployment verification
6. no fabricated live integrations
7. explicit environment separation

Until those gates are met, the module must be labeled development/staging rather than production.

## 16. First Implementation Milestone

The first code milestone will deliver:

- monorepo foundation
- enterprise shell
- `/health`
- `/health/research`
- `/health/research/frontiers`
- `/health/research/frontiers/disease-reconstruction`
- disease registry
- evidence registry
- interactive Neural Graph MVP
- Falsification Engine MVP
- Reconstruction Vulnerability Engine MVP
- Curability Index MVP
- deterministic demo data clearly labeled as research/demo content
- automated tests

The milestone is complete only after the full navigation path works end-to-end and the evidence/safety guardrails are enforced by code, not just documentation.
