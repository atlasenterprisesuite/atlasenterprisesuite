# ATLAS Climate Resilience 777 — RUN 002

Date: 2026-11-26
Continuation: PR #1147; no new competing control plane, map engine, paid provider, or automatic deployment.

## Scope delivered in source

- NOAA/NWS read-only `GET /functions/v1/atlas-platform-controls?api=climate-noaa-alerts&latitude=28.5000&longitude=-81.3000`.
- Uses existing `atlas-platform-controls` with Supabase JWT verification, authenticated user, active organization membership and the existing `city.twin.manage` permission.
- Coordinates are supplied explicitly by the caller; the browser never requests device geolocation automatically.
- Server constructs the **fixed** NOAA endpoint `https://api.weather.gov/alerts/active?point=...`; arbitrary provider URLs are never accepted.
- Uses a named User-Agent, GeoJSON accept header, HTTPS, no redirects, an 8-second request timeout and a 1 MiB response-body cap.
- Validates a NOAA GeoJSON FeatureCollection, requires Actual Alert/Update status, converts offset timestamps to UTC and classifies flood, tropical cyclone, cold, heat, drought and other severe weather.
- Reuses `evaluateClimateEvidence`, with an allowlisted NOAA origin; only up to 30 features are returned. Rejected/unprocessed records yield `status: partial` rather than implying no active alerts.
- Source metadata and time windows are retained. Every returned alert has `evidenceState: reviewable` and `mayPublishAlert: false`.
- Read-only typed browser helper `readAtlasClimateNoaaAlerts` uses `authorizedAtlasFetch` and the active organization's identifier.
- Fixed an unrelated but relevant runtime shadowing issue in the same control-plane module: use `globalThis.URL` for URL parsing because `URL` is an existing environment variable name.

## Security limitations and deliberate boundaries

- `city.twin.manage` is an existing conservative temporary RBAC permission, not a new climate-specific role. Future migration should introduce climate.read with reviewed RLS and RBAC.
- The NOAA API is publicly accessible. Server-side provider authentication here means a pinned HTTPS origin and validated response structure, **not** a separately signed CAP authenticity guarantee.
- This interface does not send notifications, dispatch warnings, persist readings, call live radar, or claim verified coverage.
- Read audit entries attempt to log counts only. The reused `urbanTwinAudit` helper swallows audit errors; mandatory tamper-resistant audit is NOT yet verified and remains a P0 gate.
- No shared persistent rate limiter or caching is provided. The authenticated route still needs a bounded rate-control policy and provider quota resilience before production.
- NWS alerts may remain active longer than the current conservative 48-hour publication freshness threshold. Such records are **excluded** and response marked partial, not cleared.
- Source-time fields and the geographic applicability of alerts must be verified E2E against actual NOAA responses; tests are synthetic fixtures.
- Location query parameters may enter infrastructure HTTP access logs. Do not automatically collect or persist precise user location; apply privacy review.
- If provider response fails or times out, return a provider error; do not report 'no current alerts'.
- No production deployment, merged code, live provider verification or end-user emergency broadcast has been completed.

## Tests and gates

Unit: `tests/unit/atlas-climate-resilience.test.ts`, `tests/unit/atlas-noaa-active-alerts.test.ts`.
Integration/source contract: `tests/integration/atlas-climate-noaa-route.test.ts`.
These tests cover parsing of timezone offsets, missing/cancelled/test records, stale sources, host spoofing, bounded output, fixed server destination and RBAC wiring.

Run `npm run test:unit`, `npm run test:integration`, `npm run typecheck`, and `npm run build` on the exact candidate SHA. Obtain a real authorized user+org integration test, NOAA fixture comparison, E2E verification and provider quota resilience.

## Release state

**P0 NO-GO** until all applicable CI gates, dedicated RBAC/audit/rate controls, real provider contract tests, deployment verification and production exact-SHA E2E pass.
Leave PR #1147 as draft; no merge, auto-merge, or deploy without the gates.

## Primary references
- https://www.weather.gov/documentation/services-web-api
- https://www.weather.gov/documentation/services-web-alerts
- https://www.weather.gov/media/documentation/docs/NWS_Geolocation.pdf
