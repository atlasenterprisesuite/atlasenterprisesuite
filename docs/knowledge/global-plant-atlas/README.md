# ATLAS Global Plant Atlas — foundation contract

Status: **foundation / P0 guarded**. This document defines the first executable vertical slice. It is not a claim of global botanical coverage.

## Canonical ownership

Global Plant Atlas is a specialized surface of **Knowledge Atlas**. It reuses ATLAS Identity, Work, Universal Execution, audit and evidence controls instead of introducing a second orchestration stack.

Canonical route: `/knowledge/plants`.

## RUN semantics

The UI **RUN** button creates a canonical ATLAS Work workflow owned by `knowledge` with:

- execution mode: `hybrid`
- autonomy: `autonomous`
- runtime preference: `auto`
- external budget: `$0`
- authorized connection references: none by default

RUN is a launch control, not an approval bypass. Identity, tenant scope, permissions, provider readiness, action sensitivity, evidence requirements and approvals remain server-authoritative and fail closed.

## Scientific assertion model

The target architecture stores versioned assertions rather than a mutable “plant fact” record. Assertions must preserve source, source release, retrieval time, license, attribution, taxon concept, evidence stage, confidence, review state and supersession history.

The Human–Plant Relationship Graph connects plants with humans, animals, microbiome, food, medicines, compounds, genes, receptors, diseases, toxicology, culture, climate and geography.

### Medical and safety boundary

The system must keep **traditional use**, in-vitro evidence, animal evidence, human observational evidence, human intervention evidence, synthesis and regulatory status separate.

Absence of a toxicity record means **unknown/not assessed**, not safe. A traditional use is not clinical efficacy. High-risk claims require stricter evidence and expert review before publication.

## P0 acceptance criteria

1. Route is identity-gated.
2. RUN reuses ATLAS Work; no parallel execution engine.
3. Tenant and organization scope remain server-authoritative.
4. External spend defaults to zero.
5. Missing provider capability or permission fails closed.
6. Medical, ingestion and toxicity claims retain evidence stage and uncertainty.
7. Every published assertion is provenance- and license-linked.
8. CI/typecheck/tests must pass at the exact PR SHA before merge.
