# ATLAS Climate Resilience 777 — RUN 003

Date: 2026-11-26
PR: #1147 (draft); prior checkpoint 2efb24ef445021348205ea139e23d961906e6633.

## Security repair delivered in source

- A new migration registers `climate.read` without granting Urban Twin administrative permissions; grants read to owner/admin/manager/staff, inheriting the canonical identity role policy.
- The NOAA read endpoint checks the existing authenticated user session, active tenant membership, and `climate.read` permission before any outgoing provider request.
- PostgreSQL table `atlas_climate_provider_read_quota` stores only organization, time bucket, counters and request time. No coordinates or alert bodies are persisted.
- An atomic SQL function `atlas_climate_acquire_read_slot` caps provider fetches at six per organization per UTC minute; it is invokable only with `service_role` by the trusted server and rechecks active user membership.
- The quota reservation and the audit record `climate.noaa.request.reserved` share one PostgreSQL transaction. Audit failure causes transaction rollback and prevents the upstream call.
- A second audit records the completed read with only record counts. Its failure returns 503 and withholds the payload; the previous fire-and-forget helper is not used by this route.
- Rate-limit denials return HTTP 429 without querying NOAA. Provider failure never becomes a false 'no alerts' response.
- Unit tests from RUN 001–002 are retained. Integration source-contract tests now cover dedicated permission, service-role-only quota, upstream ordering and strict completion audit.

## Security boundaries and outstanding work

- Migration deployment and database concurrency tests are NOT yet evidenced. Source code is not equivalent to a live SQL migration.
- The six-per-minute quota is per org, not per user; a cross-region/infrastructure global rate or cache policy remains P0 before release. Periodic quota-table pruning needs a reviewed retention policy.
- Audit coverage is mandatory for permitted fetches. Rejected over-quota attempts currently return HTTP 429 without a durable denial record; security review must decide whether to add bounded denial metrics.
- Live NOAA API availability and compatibility, response geographic scope, long-running alerts (48h freshness), and error handling need real-world integration tests.
- NOAA is the authoritative origin for its published feed, but this integration does not implement signature-based verification of individual records.
- No real alerts/notifications, public emergency communications, UI map, production readiness, or deploy are claimed.
- Budget remains $0 authorized incremental fees; no paid API, Vercel upgrade, or third-party changes.
- Preserve code integrity and fail closed. No merge, bypass, or production promotion while blockers remain.

## Next verification

1. Run Vitest unit + integration, typecheck, production build on exact PR HEAD.
2. Exercise SQL quota RPC under concurrency with 7+ simultaneous requests for same org and distinct organizations.
3. Test that audit DB failure rolls back reservation; unauthorized user or inactive membership cannot acquire quota.
4. Compare actual NOAA/NWS payloads to fixture assumptions; verify current API headers, timestamps and geospatial applicability.
5. Verify deployment SHA, Cloudflare/Supabase runtime, and end-to-end flows before considering release.

Current release status: **P0 NO-GO**.
