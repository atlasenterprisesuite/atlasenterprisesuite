# ATLAS Studio — HeyGen Avatar 6 governed handoff (17 November 2026)

**Status: implementation slice, handoff-only; NOT production-connected or released.**

## Verified source and upgrade trigger

The HeyGen email received on 2026-11-17 announces Avatar 6 (script-aware gestures,
photo and/or up to 30 seconds of reference footage, mobile Script to Video flow).
The advertised 84% realism figure is a vendor-reported metric, not a universal
probability that humans will mistake synthesized video for original footage.

An earlier official HeyGen developer message dated 2026-10-06 asked consumers of
v1/v2 endpoints to migrate to API v3 by 2026-10-31. Treat the migration as an
independent compatibility audit, not proof that ATLAS currently connects to HeyGen.

Official entry points:
- https://developers.heygen.com/endpoint-version-comparison
- https://developers.heygen.com/reference/create-video
- https://app.heygen.com/appws/script-to-video

## Reuse boundaries

Canonical module: existing `/studio/create?type=video` -> Director -> Provider & Cost.
No new app, login system, billing ledger, provider secrets or duplicate asset store.
The existing `atlas-creator` edge route remains the authenticated Creator API;
its external provider submit path currently fails closed with
`provider_adapter_not_configured`. ATLAS Native remains separate.

Implemented in this bounded slice:
- `packages/creator/avatar6.ts`: typed, deterministic and provider-neutral draft
  compiler with allowed Avatar 6 Turbo / Pro engines, aspect ratios and script
  preservation; separate trusted-server-only render gate and v3 request builder.
- `apps/web/src/modules/creator/director/Avatar6HandoffPanel.tsx`: accessible
  local drafting controls, copyable JSON handoff, explicit planning-only label,
  link to HeyGen's app; no biometric upload or provider request.
- Integration into Director's existing Provider & Cost step.
- Unit tests for invalid data, explicit disclosure, script integrity, consent,
  tenant isolation, creator permissions, spend approval and idempotency gates.

## Mandatory gates before a production provider adapter

1. Resolve authenticated ATLAS user and active tenant on the server; enforce
   `creator.generate` from existing grants. Verify avatar belongs to that tenant.
2. Verify consent **at the HeyGen provider**, including relevant voice/likeness
   consent; never treat a UI checkbox as evidence of verified provider consent.
3. Store HeyGen credentials in a server secret store only. Run a live readiness
   check for API v3, model, supported avatar look and plan/credit availability.
4. Produce a per-render server-authorized budget (credits and USD estimate),
   obtain authorization for this render and atomically reserve an idempotency key.
5. Persist provider job and customer-scoped audit trail in existing creator
   persistence, with exact request metadata (not raw private biometrics).
6. Accept signed/provider-verified webhooks or authenticated job polling; use
   actual provider statuses before showing `generating` or `completed`.
7. Store approved output in Creator Library with tenant-scoped access, provenance,
   captions/SRT, full transcript, `AI-generated presenter` disclosure and a
   restrictive retention/delete policy.
8. Prove negative tests: cross-tenant avatar, spoofed consent, missing permission,
   stale job, unauthorized spend, duplicate submission, no credits, provider error,
   and invalid/missing webhook signature.
9. Run `npm ci && npm run verify:all`, ATLAS Consensus CI and CodeQL on exact
   pull-request HEAD. Merge/deploy only when P0 is clear. Verify Cloudflare
   production runtime, protected routes and final deployed SHA.

This branch does **not** submit jobs, update the user's HeyGen mobile app,
create a digital twin, persist voice/biometric references, charge credits,
or assert production deployment. The guided setup in HeyGen is a separate
subject-controlled consent process.
