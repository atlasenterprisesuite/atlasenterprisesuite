# ATLAS Robotics Core — F7 Security Gate (isolated only)

## Reused visual assets
- Library: `Ecosistema futurista de productos ATLAS.png` (Device OS concept, generated).
- Library: `image-gen-5(28).png` (ATLAS technical UI, generated).
- Do not claim that concept hardware exists. Do not copy KIA branding into Robotics.

## P0: verified defects in F5–F6 contracts
1. `robotics_simulation_reserve/complete/revoke/halt/is_halted` accept caller-provided actor IDs. No database-authenticated identity binding.
2. `SECURITY INVOKER` with FORCE RLS and zero policies denies all ordinary callers, including a privileged executor unless explicitly provisioned. No bypass is authorized.
3. `persistent-run-store.ts` requires a transaction callback but has no trusted server-side implementation; its calls cannot establish membership.
4. `reserve` and `complete` are separate transactions. Membership revocation can interleave unless the actual membership mutation shares the same serialization point.
5. The in-memory run store is not suitable for distributed deduplication.

## Required design before enabling database access
- Resolve actor from the authenticated DB session; never accept actor ID as authority.
- Verify tenant/org mapping and effective permission against authoritative membership and role grants.
- Define RLS policies restricted to an audited non-bypass runtime role; test FORCE RLS explicitly.
- Serialize all membership revocations and run transitions on a common lock in deterministic order.
- Implement `reserve`, `complete`, `halt`, `isHalted` through the same audited server transaction interface.
- Ensure immutable audit evidence and exact run identity; no physical device adapter.

## Negative test contract (not yet executed)
- RBT-PG-01 unauthenticated caller denied
- RBT-PG-02 forged actor ID denied
- RBT-PG-03 cross-tenant scope denied
- RBT-PG-04 cross-org scope denied
- RBT-PG-05 revoked membership denied
- RBT-PG-06 simultaneous reserve same key: at most one success
- RBT-PG-07 revoke-before-complete: completion denied
- RBT-PG-08 complete-before-revoke: deterministic serialized outcome
- RBT-PG-09 halt-before-complete: completion denied
- RBT-PG-10 duplicate replay after completion denied
- RBT-PG-11 RLS without policies denies all ordinary roles
- RBT-PG-12 malformed payload and physical-mode request denied

## Release gate
P0 NO-GO until disposable PostgreSQL two-session tests, Vitest, typecheck, CI and independent code review pass. This document does not claim any tests were run.
