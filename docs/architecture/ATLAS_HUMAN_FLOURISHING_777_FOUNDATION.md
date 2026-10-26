# ATLAS Human Flourishing 777 — foundation contract

Status: proposal / isolated feature branch. NOT production verified. P0 OPEN.

## Reuse and boundaries
Reuse the canonical module registry, Bible OS (/knowledge/bible), Knowledge Atlas (/knowledge), Learning (/learning), Health (/health), Finance (/finance), Business (/business), Care (/care), Assistant (/assistant), and existing Faith Reflection (/wellbeing/faith). Do not duplicate their databases or claim their readiness labels prove deployment.

## Seven optional dimensions
1. Purpose and faith — user-selected religious or secular reflection.
2. Wisdom — learning and evidence-based decisions.
3. Health — voluntary general wellbeing, not clinical advice.
4. Financial stability — budgeting and financial literacy, no invented balances.
5. Opportunity — business, employment and learning next steps.
6. Love and relationships — respectful connection, never infer relationship status.
7. Inner peace — self-directed reflection and rest, no diagnosis.

## Security contract (fail closed)
- Default experience is secular, no spiritual content unless explicitly selected.
- No preselected religious preference, no pressure, no divine-authority claims.
- No automatic import of conversations, financial, health, religious or relationship data into Knowledge Atlas.
- No third-party analytics or AI provider receives journal entries by default.
- Personal journal data must not be stored in shared organizational records.
- Future persistence requires verified identity, ownership scoping, RLS, explicit consent, deletion/export controls and negative cross-tenant tests.
- Do not treat browser localStorage as secure private storage for sensitive notes.
- Every integration must distinguish suggestion, user-confirmed action, and verified completion.
- User can disable or change reflection mode at any time.

## First vertical slice
Build a responsive accessible dashboard with seven optional dimension cards, a daily action and source-labelled reflection, a secular/religious mode selector defaulting to secular, and links to existing modules. No sensitive journaling or server writes in phase 1. Metrics are opt-in, never fabricated. Accessible keyboard focus, labelled controls, empty/loading/error/denied states must be tested.

## Acceptance gates
1. Verify actual module routes and identity guards against App.tsx.
2. Test no faith content before opt-in, secular alternative, and mode switching.
3. Test no automatic persistence, network posting, cross-module data access or personal profiling.
4. Verify keyboard, contrast, screen reader semantics and mobile layouts.
5. Before any persistence, implement ownership-based RLS, negative cross-tenant/RBAC tests and auditable consent revocation.
6. Run typecheck, unit tests, build and GitHub CI against exact commit SHA in isolation.
7. Keep PR Draft, P0 open; no merge or production deploy without evidence and authorization.

## Provenance
Audited on 2026-10-26: apps/web/src/modules/registry.ts; apps/web/src/App.tsx; apps/web/src/modules/wellbeing/FaithReflectionPage.tsx; docs/architecture/ATLAS_MEMORY_SPEC.md. This document is a design/security foundation, not evidence that the dashboard is implemented.
