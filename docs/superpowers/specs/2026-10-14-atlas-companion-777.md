# ATLAS Companion — 777 REVIEW implementation contract

Status: DESIGN / NOT PRODUCTION VERIFIED
Owner: canonical ATLAS Assistant in apps/web; no parallel application.

## Existing reusable assets (verified in main)
- apps/web/src/components/assistant/AtlasAssistant.tsx and AtlasAssistantPanel.tsx
- apps/web/src/assistant/client.ts, types.ts, routeContext.ts, useAssistantVoice.ts
- apps/web/public/atlas-avatar-particle.svg
- apps/web/src/types/accessibility.ts and AtlasAccessibility.tsx
- apps/web/src/execution/ExecutionAssistantPanel.tsx
- docs/governance/HISTORICAL_CONVERGENCE_REGISTER.md: PR #161 preferred over obsolete PR #70; reconcile with main.

## Acceptance gates (fail closed)
1. Inspect current shell mounting, routing, assistant provider and authorization boundaries; no duplicated app, API, identity or state.
2. Write tests first for opt-in companion preference, keyboard/screen-reader access, reduced motion, tenant isolation and permission-denied fallback.
3. Add an optional companion visual mode to the canonical Assistant using original ATLAS avatar assets; default behavior unchanged and no engagement pressure.
4. Reuse existing chat and voice services; never claim verified provider without runtime verification.
5. Do not persist sensitive chat or wellness details in browser storage. Server-side memory requires explicit opt-in, scoped authorization, retention/deletion controls and RLS tests.
6. No autonomous external mutations without action-specific authorization, auditable evidence and fail-closed policy.
7. Run lint, typecheck, unit/integration/e2e, security checks, responsive and accessibility checks.
8. Open PR with evidence, CI results, reviewer approval and exact commit SHA. Merge only when all P0 gates pass.
9. Deploy through canonical production pipeline and verify live route, auth, provider status, accessibility and exact deployed SHA. On mismatch: BLOCKED, never DONE.

## Current evidence
Repository accessible via GitHub connector; canonical Assistant, voice, avatar and accessibility files located. No tests or deployment executed by this document. Production remains unverified.
