# ATLAS Climate Resilience 777 — RUN 001

Date: 2026-11-26
Base: main fb42e57a9441bd38d258134fbd94439f66472aac
Scope: additive evidence-validation foundation only. No production feature or emergency alert service.

## Architecture decisions
- Reuse GPS 4D's provider-neutral geospatial boundary instead of a second map engine.
- Reuse Urban Twin's distinction between registration, evidence, and verified telemetry.
- Reuse ONE CORE's organization membership and RBAC checks for future server adapters; never treat a client boolean as proof of authorization.
- Reuse Knowledge Atlas for source provenance, with published and verification dates.
- Keep glaciation/paleoclimate scenarios separate from live observation and weather forecast records.

## First functional unit
`packages/analytics/src/climate-resilience.ts` exports a pure, dependency-free evidence intake policy.
It categorizes incoming climate records as **reviewable** or **rejected**. It rejects:
- unauthenticated providers and missing organizational authorization;
- malformed dates, expired or not-yet-effective evidence;
- sources older than 48 hours (a conservative v1 intake rule, not a provider SLA);
- unsafe URLs, hostname impersonation and sources outside an explicit allowlist;
- missing provenance, invalid coordinates and unsupported hazards;
- long-range simulations submitted as current hazard records.

A reviewable record is **not** a verified authoritative warning. `mayPublishAlert` is always false.

## Security and limits
- A trusted provider host does not establish authenticity by itself; a future server-side adapter must authenticate the provider, validate response identity, enforce tenant authorization, and record audit events.
- This unit does not make network requests, persist records, show a map, create alerts, or use paid services.
- The `api.weather.gov` hostname in tests is a fixture, not a connected integration.
- Never accept `providerAuthenticated` or `organizationAuthorized` supplied directly by an untrusted browser.
- Glaciation scenarios remain visibly labeled as **scenario** and cannot produce urgent alerts.

## Acceptance gates
1. Unit tests cover accepted review-only evidence, source spoofing, malformed input, staleness, simulated scenarios and missing authorization.
2. CI: run Vitest unit suite and TypeScript checks on the PR's exact HEAD SHA.
3. Next: server-side NOAA adapter, API contract, Urban Twin references, map overlay, RLS persistence, audited workflows, E2E and deployment checks.
4. P0 NO-GO until mandatory checks, security review and exact-SHA E2E gates pass. No auto-merge or deploy.

## Scientific references
- https://science.nasa.gov/earth/climate-change/milankovitch-orbital-cycles-and-their-role-in-earths-climate/
- https://www.weather.gov/documentation/services-web-api
- https://www.ipcc.ch/report/ar6/wg2/

This file does not claim that external climate data have been ingested or that the module is available in production.