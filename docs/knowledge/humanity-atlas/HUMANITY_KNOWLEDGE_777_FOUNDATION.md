# ATLAS Humanity Knowledge 777 — foundation inventory

Tracking: #897
Status: development draft; not published

## Reuse confirmed in canonical repository
- `apps/web/src/modules/knowledge/KnowledgeAtlasPage.tsx`: existing React knowledge UI with search, filters, paging and error/loading states.
- `docs/knowledge/humanity-atlas/README.md`: existing Humanity Atlas governance, knowledge model, evidence/provenance and source-of-truth ownership.
- `supabase/migrations/20260924205000_atlas_knowledge_audit_hardening.sql`: existing knowledge audit migration (contents and production application still to verify).
- `package.json`: Vitest unit/integration, TypeScript, build and deployment verification scripts.

## Architecture decision
Knowledge Atlas remains the owning knowledge/provenance layer. Humanity Knowledge is a connected discovery and publication surface, not a shadow database. Domain records remain in their owning modules.

## Proposed entity contract (not yet implemented)
- Entity: stable ID, canonical title, aliases, domain, provenance
- Claim: statement, status, scope, date, review status
- Source: primary URL/identifier, author, publication date, license
- Evidence: source/claim relationship, strength, counterevidence, verification date
- Relationship: typed directed edge with provenance
- Observation: time, azimuth, altitude/FOV uncertainty, approximate public location, consent
- Publication: explicit approval, immutable revision, redaction and corrections

Evidence states: verified, supported, hypothesis, cultural-interpretation, disputed, unknown. Avoid unsupported certainty.

## Initial public exhibit (draft only)
Orlando sky observation (October 2026): Aquarius star labels and Bayer notation. Public content must not expose precise private coordinates or original private images without explicit permission. Astronomical identification requires actual camera pointing elevation, FOV and date-time verification.

## Next engineering checks
1. Inspect memoryApi and Supabase RLS ownership and audit flows.
2. Inspect routing and shared page components before introducing a new page.
3. Add TDD for provenance links, evidence labels, privacy redaction, and authorization.
4. Implement read-only connected knowledge explorer reusing the existing UI and APIs.
5. Run typecheck/unit/integration/a11y/security and create a Draft PR.
6. No merge or deploy until P0 passes; verify Cloudflare and exact SHA.

## Fail-closed rules
No automatic publication of private chats, personal photographs or precise coordinates. No merging historical/symbolic claims into scientific fact. No claim of completed CI, deploy, or E2E without logs.
