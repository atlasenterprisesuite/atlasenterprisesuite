# ATLAS Climate Resilience 777 — RUN 006

Date: 2026-11-26. Single canonical PR #1147.

## Exact-SHA checkpoint

- Prior SHA `23d4f7b635602a5c50a0e10187aa46b0b8b71655` passed **11 of 11** GitHub Actions workflows: unit/integration CI, security, PostgreSQL 17 isolated gate, build, CodeQL, accessibility and design.
- This is historical evidence for the prior SHA only. Any RUN 006 commit requires new checks.

## Security finding: browser-only site verification (P0)

The RUN 005 browser dropdown displayed only verified Urban Twin sites, but the authenticated API accepted arbitrary client-supplied latitude/longitude. Users with `climate.read` could invoke the endpoint directly with unrelated coordinates, bypassing the UI's truth boundary. A client-side filter is **not** an authorization boundary.

## Code correction

- The browser now POSTs `{site_id: '<uuid>'}` only. No precise coordinates in ATLAS URLs or browser JSON requests.
- The server validates UUID shape, resolves the actual Urban Twin entity using the caller's authenticated RLS-scoped client, restricts the query by active organization, `verification_state='verified'` and `lifecycle_state='active'`, and validates coordinates fetched from the database.
- No NOAA call or organization quota reservation occurs unless the verified site lookup succeeds.
- Unknown, unverified, cross-tenant and retired entities fail closed with HTTP 403; lookup errors return 503.
- The UI also filters out retired entities and continues to require an explicit click, with no implicit device geolocation.
- New tests cover site-ID-only POST payload, malformed ID rejection, invalid server payload and source-contract assertions for verified site lookup before quota usage.

## Verified behavior and limits

- This remains an informational evidence viewer, not an emergency broadcast. `mayPublishAlert` is always false.
- Site validation is an additional control. The server relies on Urban Twin's existing RLS policy, which requires city.twin.read/manage; the user also needs climate.read. Do not broaden permissions merely to make requests pass.
- Selected coordinates are transmitted from ATLAS to NOAA because point-specific NOAA lookups need them. They may occur in NOAA provider HTTP logs, though no precise coordinates are placed in the ATLAS request URL.
- The NWS recommends no more than one request per 30 seconds to its alerts feed; the existing per-org 6/min budget is **not** a sufficient global rate limit. Shared caching/throttling must be designed before production.
- Live NOAA contract has not been verified through a deployed authenticated request. A current independent web attempt to fetch its JSON could not be completed; source documentation confirms API shape and usage patterns, not live output.
- Production atlas-core has not applied the new quota/permission migration. No production release or successful end-to-end test is claimed.

## Pending P0

1. Re-run all applicable GitHub Actions tests at exact RUN 006 head.
2. Validate authenticated RLS site read, negative tenant/revoked/retired cases, and real migration on a controlled staging environment.
3. Verify actual NOAA requests, provider responses and rate controls; no 'all clear' on failures/partials.
4. Add global upstream throttling/caching appropriate for NOAA's 30-second guidance, with a privacy and retention review.
5. Complete accessible page E2E, deployment exact-SHA, fail-closed audit and production release review.

**Decision: P0 NO-GO. Keep PR draft, no merge, no production mutation, no paid provider changes.**

Primary references:
- https://www.weather.gov/documentation/services-web-api
- https://www.weather.gov/documentation/services-web-alerts
- https://supabase.com/docs/guides/database/postgres/row-level-security
