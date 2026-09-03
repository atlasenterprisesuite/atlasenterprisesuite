# ATLAS Enterprise Suite

ATLAS Enterprise Suite is a modular enterprise platform. This repository currently contains the first implemented foundation of **ATLAS Health → Research & Innovation → Health Frontiers → Disease Reconstruction Lab**.

## Current milestone

The Disease Reconstruction Lab is a governed biomedical research workspace for organizing diseases, mechanisms, evidence, contradictory findings, reconstruction vulnerabilities, curability classifications and surveillance concepts.

Implemented research surfaces include:

- Disease workspaces for HIV, cancers and leukemias, type 1 diabetes and autoimmunity, fibrosis, Alzheimer’s disease, Parkinson’s disease, and extensible persistent diseases.
- ATLAS Health Neural Graph.
- Evidence Registry with provenance and evidence-level controls.
- Falsification Engine.
- Reconstruction Vulnerability Engine with transparent research-only scoring.
- Curability Index with code-enforced guardrails against unsupported cure claims.
- Core least-privilege RBAC, tenant-boundary and audit-event contracts.
- Responsive ATLAS web shell and supported-route verification.

## Scientific integrity

This milestone is **research-only software**. It does not diagnose, prescribe, dose medication, access patient records, or claim that a disease is cured because of a case report, hypothesis, preclinical result or biomarker response.

Demo research content is synthetic, explicitly marked as demo/hypothesis-level, and must not be treated as clinical or scientific evidence.

## Development

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev
```

Run the complete verification chain:

```bash
npm run verify
```

That command enforces lint, format checks, TypeScript, source-safety rules, automated tests and a production build.

## Verification gates

GitHub Actions runs the ATLAS Health verification workflow on pull requests to `main`, on the active Health feature branch, and after merge to `main`.

The build is not considered production merely because CI is green. Production status additionally requires authorized hosting, deployment verification, reachable supported routes, and successful verification of the deployed health artifact.

Static build health artifact:

`/healthz.json`

Expected development/static-build contract:

```json
{
  "status": "ok",
  "service": "atlas-enterprise-suite",
  "module": "atlas-health",
  "mode": "static-build",
  "liveClinicalIntegrations": false
}
```

## Architecture documents

- Design: `docs/superpowers/specs/2026-09-03-atlas-health-disease-reconstruction-lab-design.md`
- Implementation plan: `docs/superpowers/plans/2026-09-03-atlas-health-disease-reconstruction-lab.md`

## Production boundaries

No live EHR, FHIR, HL7, hospital operations, patient-identifiable data, billing, or clinical integrations are configured by this milestone. Such integrations must be separately authorized, secured, tested and audited before any live status is displayed.
