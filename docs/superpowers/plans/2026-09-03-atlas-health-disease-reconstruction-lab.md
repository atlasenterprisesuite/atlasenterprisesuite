# ATLAS Health Disease Reconstruction Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working ATLAS Enterprise Suite web foundation with ATLAS Health → Research & Innovation → Health Frontiers → Disease Reconstruction Lab, enforcing scientific-evidence and cure-claim guardrails in code.

**Architecture:** Use a Vite + React + TypeScript web app with domain modules under `packages/health`. Keep biomedical evidence, graph integrity, falsification, vulnerability scoring, and curability rules deterministic and testable. GitHub Actions is the authoritative verification runner for this repository.

**Tech Stack:** Node.js 22, React 19, TypeScript 5, Vite 7, React Router 7, Vitest, Testing Library, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-03-atlas-health-disease-reconstruction-lab-design.md`

## Global Constraints

- Research-only. No diagnosis, prescribing, dosing, or autonomous clinical decision support.
- No fabricated patient, hospital, EHR, FHIR, HL7, or live integration state.
- No C5-C7 curability upgrade from a single case report, preclinical evidence, hypothesis, biomarker response, or unsupported correlation.
- Every displayed evidence record carries provenance, evidence level, limitations, confidence, and status.
- Graph references must be internally valid and contradiction/falsification state must remain visible.
- Responsive desktop/tablet/mobile navigation; no placeholder links, `href="#"`, fake metrics, or dead controls.
- Secrets stay outside source. Seed/demo research data is non-identifiable and explicitly labeled.
- Production claims require successful CI, authorized hosting/datastore, deploy health verification, and reachable supported routes.

---

### Task 1: Verification foundation and RED tests

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `scripts/verify-source.mjs`, `.github/workflows/health-ci.yml`
- Create tests under `packages/health/**` and `apps/web/src/**`

**Interfaces:**
- Produces test contracts for `validateEvidenceRecord`, `validateGraph`, `applyFalsification`, `calculateVulnerability`, `validateCurabilityUpgrade`, `App`.

- [ ] Write tests for scientific guardrails, graph integrity, deterministic vulnerability scoring, route depth, safety labels, and navigation.
- [ ] Push tests without production modules.
- [ ] Open a draft PR and verify GitHub Actions fails because the required production modules are absent.
- [ ] Record the failing run as the RED gate.

### Task 2: Core health domain types and scientific guardrails

**Files:**
- Create: `packages/health/types.ts`
- Create: `packages/health/evidence/index.ts`
- Create: `packages/health/curability/index.ts`
- Create: `packages/health/falsification/index.ts`

**Interfaces:**
- Produces typed evidence levels/statuses, provenance validation, causal-claim rules, cure-claim guardrails, and falsification transitions.

- [ ] Implement the minimum code required by the RED tests.
- [ ] Ensure correlation alone cannot become `supported` causal evidence.
- [ ] Ensure retracted/falsified evidence cannot upgrade curability.
- [ ] Ensure C5-C7 require reproducible human evidence appropriate to the requested level.

### Task 3: Neural Graph and Reconstruction Vulnerability Engine

**Files:**
- Create: `packages/health/neural-graph/index.ts`
- Create: `packages/health/reconstruction/index.ts`
- Create: `data/research/seed.ts`

**Interfaces:**
- Produces `validateGraph(nodes, edges, evidence)` and `calculateVulnerability(profile)`.

- [ ] Reject orphan node/evidence references and broken edges.
- [ ] Return transparent component contributions with every reconstruction score.
- [ ] Seed only explicitly labeled research/demo diseases and mechanisms.

### Task 4: ATLAS Enterprise + Health application shell

**Files:**
- Create: `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/styles.css`
- Create focused UI components under `apps/web/src/components/`

**Interfaces:**
- Produces navigable routes `/`, `/health`, `/health/research`, `/health/research/frontiers`, `/health/research/frontiers/disease-reconstruction` and lab subroutes.

- [ ] Implement responsive ATLAS shell, breadcrumbs, side navigation, loading/empty/error/safety states.
- [ ] Implement disease, graph, evidence, falsification, vulnerability, and curability views from deterministic research data.
- [ ] No fake live metrics or live-integration badges.

### Task 5: Green CI and verification gates

**Files:**
- Modify only files required to resolve failing tests/gates.

**Interfaces:**
- Consumes all prior tasks; produces a CI-verified branch.

- [ ] Run GitHub Actions for typecheck, source verification, unit/integration tests, and production build.
- [ ] Fix failures without weakening tests or safety rules.
- [ ] Verify all checks are green on the PR head commit.
- [ ] Review PR diff for secrets, placeholders, unsupported cure language, and dead routes.

### Task 6: Merge and production-readiness gate

**Files:** none unless CI/review finds defects.

**Interfaces:**
- Produces a reviewed merge commit. Production remains separate from merge.

- [ ] Merge only after all critical checks pass.
- [ ] Inspect repository for an authorized deployment workflow/provider configuration.
- [ ] If deployment configuration exists, deploy and verify the real URL plus health/route checks.
- [ ] If hosting/datastore configuration is absent, stop at `MERGED / DEPLOYMENT BLOCKED` and name the exact missing production dependency. Never label production without evidence.
