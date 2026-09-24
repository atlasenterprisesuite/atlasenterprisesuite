# ATLAS Aviation Intelligence — Current Main Architecture Amendment

Date: 2026-09-19
Status: Approved visual/product direction, reconciled to current main
Route family: `/mobility/aviation`
Owner area: Mobility

## Authority

This amendment preserves the approved ATLAS Aviation Intelligence product direction and replaces only obsolete implementation assumptions from the September 3 foundation.

Current `main` is authoritative for architecture.

## Existing architecture reused

- Primary web app: `apps/web` React/Vite.
- Canonical module registry: `apps/web/src/modules/registry.ts`.
- Canonical shell: `AtlasShell`.
- Protected route boundary: `RequireAtlasIdentity`.
- Extension routing: `resolveAtlasExtension`.
- Existing Mobility peer: ATLAS Ride.
- Durable platform direction: Supabase with tenant/RLS/RBAC boundaries.
- Verification: Vitest, TypeScript, Vite build, GitHub Actions, Cloudflare production verification.

Aviation must not introduce a second shell, router, registry, identity model, permission model, datastore, or deployment path.

## Module registration

Register one module:

- id: `aviation`
- title: `ATLAS Aviation`
- navLabel: `Aviation`
- area: `Mobility`
- route: `/mobility/aviation`
- readiness: `partial` until durable evidence/provider integrations are verified
- requiresAuth: `true`
- showInNavigation: `true`

Every `/mobility/aviation/*` route must remain inside the existing ATLAS Identity boundary.

## First production-safe slice

Routes:

- `/mobility/aviation` — Aviation Intelligence home.
- `/mobility/aviation/aircraft` — aircraft catalog.
- `/mobility/aviation/aircraft/:aircraftId` — aircraft intelligence detail.
- `/mobility/aviation/certification` — certification intelligence.
- `/mobility/aviation/saved` — saved aircraft capability boundary.
- `/mobility/aviation/alerts` — alert capability boundary.

The first slice may expose saved/alerts as truthful not-configured states until durable organization/user scoped persistence exists. It must not simulate persistence.

## Ten approved concept models

The approved visual family is represented as ATLAS internal concept records, not certified aircraft:

1. Urban Air Taxi
2. Regional eVTOL
3. Personal Flight
4. Cargo Lift
5. Medical / Rescue
6. Security / Public Safety
7. Exploration
8. Group Transport
9. Agriculture
10. Hybrid / Extended Range

Concept records may contain model names, categories, intended use, visual descriptions and design status. Unvalidated engineering values such as speed, range, payload, price, valuation, certification or delivery remain null and render as `Not validated`.

## Evidence model

Claims that can affect a decision must expose provenance:

- source type
- publisher / authority
- source URL when available
- retrieved/published timestamp
- trust class
- normalized status
- stale/conflict/not-configured states

No issuer/manufacturer promotional claim becomes ATLAS fact merely because it appears in marketing.

## Investment boundary

Investment Intelligence is read-only research. ATLAS does not execute securities transactions in this slice.

- Monetary terms may be null.
- Stale terms are labeled stale.
- External actions may point only to verified official sources.
- Risk/illiquidity disclosure remains visible when investment information exists.

## UX

Reuse the current ATLAS visual system and responsive shell. Aviation adds:

- cinematic aircraft hero surfaces
- technical grid/card layout
- evidence/provenance rail
- certification timeline
- responsive catalog
- semantic states: loading, ready, empty, stale, not_configured, error, restricted

The generated aircraft artwork is design reference only until explicitly stored as an approved ATLAS asset in the repository/library.

## Security and data

- Preserve organization/tenant isolation.
- No secrets client-side.
- No fabricated live/provider status.
- No untrusted external HTML injection.
- No production persistence in browser-only memory.
- Future writes require explicit permissions and auditability.

## Verification

Before merge:

- targeted Aviation tests green
- `npm run typecheck`
- relevant integration/unit suite
- `npm run build`
- route/navigation checks
- responsive/accessibility review
- no secret leakage
- no fabricated production metrics
- PR review

Before production-ready claim:

- merge to `main`
- normal production deployment pipeline
- fail-closed verification of `www.atlasenterprisesuite.com`
- critical ATLAS Network routes verified
