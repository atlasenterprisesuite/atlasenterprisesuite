# ATLAS Climate Resilience 777 — RUN 005

Date: 2026-11-26
PR #1147. Continue the single ATLAS Urban Twin / ONE CORE control plane; do not introduce a parallel weather app.

## Exact-SHA CI checkpoint

- `50f25dab85cd6ab2fc412f1f579bd8073e8eac5b` had 11/11 workflows successful, 0 failed.
- Climate PostgreSQL 17 Gate job #139985819729 emitted `PASS isolated PostgreSQL: 7-way concurrency, RBAC, cross-tenant denial, audit rollback`.
- That evidence is valid for the prior SHA only. The new RUN 005 SHA must run all required checks again.

## User-directed UI vertical slice

- Added `apps/web/src/modules/city/ClimateNoaaPanel.tsx`, mounted inside the existing protected `UrbanTwinPage`, preserving a single control plane.
- Eligible site choices are Urban Twin records marked verified with finite, valid latitude/longitude. Other entries cannot be queried.
- No automatic geolocation, background requests, device tracking, or auto-subscription. User must select a site and explicitly click Consult NOAA.
- Shows provider, retrieval timestamp, review-only evidence, records and warnings about incomplete data.
- A 0-alert complete response is described as `No active NWS alerts were returned`; this is explicitly **not** proof that conditions are safe.
- Partial response or provider failure cannot be presented as all-clear.
- Responsive/keyboard CSS reused from Urban Twin. UI Vitest tests cover opt-in behavior, disabled unsafe choices, partial results and provider failure.

## Privacy and NOAA contract hardening

- Authenticated ATLAS user-to-server coordinates now travel in a JSON POST body, not an ATLAS URL query string, reducing access-log exposure.
- The NOAA server-to-provider call remains GET with a fixed URL and query coordinates, as required by NWS; the UI discloses this fact.
- Replaced the `/alerts/active` shortcut with the documented canonical endpoint `/alerts?active=true&point=...` to avoid depending on internal redirect handling when redirects are blocked.
- All authorization, atomic org quota, fail-closed audit requirements, 8-second timeout, 1 MiB body limit, origin pinning and non-publication remain in place.

## Outstanding P0

- Exact new SHA: CI/TypeScript/build/a11y and UI tests must pass; prior SHA results are not transferable.
- Live NWS provider contract and HTTP response format remain unverified from a real authenticated integration.
- Supabase production atlas-core has not applied the climate permission or quota migration; no service release or user-visible guarantee.
- Provider-wide rate and caching policy, provenance verification, location-data privacy review, retention, independent E2E and production SHA checks remain pending.
- DO NOT merge, deploy, bypass protections, or purchase capacity; keep PR draft.

## NOAA primary source
- https://www.weather.gov/documentation/services-web-api
- https://www.weather.gov/documentation/services-web-alerts
