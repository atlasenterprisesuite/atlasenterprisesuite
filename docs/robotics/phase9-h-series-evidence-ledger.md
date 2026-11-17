# Robotics F9 — evidence ledger and release gate

## Historical Library source bytes (SHA-256)
- atlas_humanoid_engineering_v2.html: 6a44dfa2f216e566a1bfa513dea8dccb3c2b3291b91174a0ded0515c8102f35f (52,874 bytes, 166 lines)
- atlas_humanoid_server.py: 7a0b5d5df4312fdb00adb979b6f53398df45824cbe397cd80162edb508a342be (3,656 bytes, 71 lines)
- atlas_humanoid_bom_v2.csv: 49f21dfabb32e06a77498af7de291cb13f12951fade9655d7d54ae59a05db508 (1,232 bytes, 10 BOM records)

## Source audit
- HTML declares variants base/home/office/industrial/driver with codes H-B1/H-H1/H-O1/H-I1/H-D1 and planning prototype costs USD 75,000/90,000/77,500/120,000/105,000.
- HTML includes browser localStorage fallback and POST /api/state; this is not authoritative tenancy.
- Python server defaults to 127.0.0.1, serves GET /api/health and GET/POST /api/state, and persists one global SQLite project_state row id=1. No per-organization isolation or authenticated caller identity. Do not deploy as a network service.
- BOM has 10 records and 7 columns. No tenant identifiers, supplier identity validation, or pricing provenance; import only as planning seed after review.
- Existing packages/execution/src/types.ts defines ExecutionActor with userId, tenantId/organizationId scope, and permission strings. Existing packages/robotics/simulation-adapter.ts is a separate simulated pick/place executor. H-Series catalog is intentionally read-only and does not duplicate execution or actuate hardware.

## F9 implementation evidence
- packages/robotics/h-series-catalog.ts blob SHA 390a4ec4ae19f758115d12f8860a4ee74a0da132
- tests/unit/robotics-h-series-catalog.test.ts blob SHA fe3bf49cb53f8da16d85244c3dfb78254bc3cebe
- F9 tests authored: 8 cases for historical codes, cross-tenant, cross-org, permission, authorization denial/outage, invalid scope and no actuation.

## Limitations / P0
- Catalog checks actor scope and requires an injected async authorization callback; it is NOT a database RLS enforcement mechanism. A forged actor plus permissive callback could bypass it. It MUST only be called behind authenticated server identity and authoritative tenant/membership checks.
- No PostgreSQL migrations or RLS policies were added for this catalog.
- Vitest, TypeScript typecheck, PostgreSQL two-session concurrency, and CI have NOT been executed or independently certified for F9.
- TDD tests were authored after the initial catalog commit, so a demonstrated RED→GREEN cycle is not claimed.
- No merge, deploy, physical actuation, or production certification. Status P0 NO-GO.

## Next gates
1. Bind verified actor identity from server session, not request payload.
2. Wire authorization to authoritative organization membership and effective permissions with revocation checks.
3. Run negative tests against disposable PostgreSQL with RLS and concurrent revocation.
4. Run Vitest/typecheck and record exact-SHA CI evidence.
