# ATLAS GENESIS — Biomedical Research Contract v1.0

Date: 2026-10-15
Status: SPECIFIED ONLY — not implemented, tested, clinically validated or production verified.

## Purpose and ownership
ATLAS GENESIS studies fertilization, developmental biology, cellular reprogramming, dental regeneration, neuroregeneration and bioengineering. It is a research and evidence-management domain, **not** a clinical treatment engine.

- Canonical evidence and provenance owner: Knowledge Atlas (see `docs/knowledge/humanity-atlas/README.md`).
- Clinical research and health evidence consumers: ATLAS Health / Health Frontiers.
- Audit and lifecycle: existing Evolution Kernel and evidence-locked release governance.
- No new parallel identity, organization, RBAC, audit, AI provider or knowledge stores.
- The existing software-release Gestation analogy is not an embryology knowledge model.

## Initial research tracks
| ID | Focus | Evidence question |
| --- | --- | --- |
| GEN-01 | Fertilization | What is established about PLCζ-mediated oocyte activation and calcium oscillations? |
| GEN-02 | Embryology | Which developmental pathways have context-dependent roles in adult tissue repair? |
| GEN-03 | Reprogramming | What are the demonstrated benefits, limitations and tumorigenicity risks of iPSC-derived interventions? |
| GEN-04 | Dental regeneration | What do preclinical and registered human anti-USAG-1 studies actually demonstrate? |
| GEN-05 | Neural repair | Which neural repair approaches have replicated functional outcomes? |
| GEN-06 | Bioengineering/AI | Can hypothesis extraction be validated on independently curated reference sets? |

## Research record contract (proposal; not a deployed schema)
- `id`: immutable identifier.
- `track_id`: one of GEN-01 through GEN-06.
- `claim`: precise falsifiable claim.
- `claim_type`: mechanism | intervention | safety | clinical_outcome.
- `evidence_state`: established | strongly-supported | active-hypothesis | open-question.
- `source_refs`: stable DOI, PMID, trial registration or authoritative URL, with publication date and source type.
- `reviewed_at`, `reviewer`, `limitations`, `contradictions`, `supersedes`.
- `domain_owner`, `tenant_id` (if organization-scoped), `visibility`, `audit_ref`.
- `engineering_state` must remain independent of `evidence_state`.
- `clinical_readiness`: not-evaluated | preclinical | clinical-research | authorized-use; never inferred from literature summaries.

## P0 fail-closed gates
1. No unsupported cure or human-efficacy claim.
2. No private biological, genomic or patient data without lawful basis, consent where applicable, least privilege, retention controls and tenant isolation.
3. No autonomous human/embryo/gamete experimentation or clinical decision-making.
4. No source-free scientific claim displayed as established.
5. No deployed status without exact-SHA CI, security and production E2E evidence.
6. No mutations of canonical knowledge without authorization, provenance and audit.

## Test-first acceptance criteria
- Reject records with missing source, invalid track, invalid evidence state or missing audit ownership.
- Preserve contradiction and supersession lineage.
- Keep clinical readiness separate from scientific confidence and engineering status.
- Prove tenant A cannot read or mutate tenant B private records.
- Verify read-only public literature search never leaks tenant-specific context.
- Accessibility: keyboard, screen reader, small-screen layouts, loading/empty/error/unavailable states.
- RED tests before implementation, then GREEN unit/integration/security checks, PR review, CI and production exact-SHA E2E.
- Unverified invariants remain unverified, not passed.

## Next engineering slice
1. Inventory Knowledge Atlas storage, routes, provenance types and security policies.
2. Identify an extension point for the research-record contract; do not introduce a duplicate knowledge source.
3. Add failing contract tests, implement smallest compatible slice and verify isolation.
4. Submit PR; do not merge or deploy with P0 gaps.

## Evidence status
This file is a research specification only. No new scientific experiments, cures, database migrations, UI routes or production services are asserted.
