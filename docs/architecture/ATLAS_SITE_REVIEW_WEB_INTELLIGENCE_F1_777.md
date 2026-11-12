# ATLAS Site Review — Web Intelligence F1 (777 REVIEW)

## Actual scope

The existing authenticated `/site-review` integration hub remains the canonical entry point. Phase 1 adds a browser-local HTTPS target intake using the existing React/TypeScript web stack. It does **not** create a duplicate navigation route, provider integration, scanner, tenant persistence layer or release authority.

Historical source: PR #5 (`feat/site-review-center-foundation`) contains a deterministic HTML audit concept, review annotations and explicit `not_configured` findings. Its in-memory store and preview role selector **must not** be introduced into the modern tenant/RBAC boundary. Later migrations must rework those capabilities using current Supabase identity and organization-scoped persistence.

## Threat model

- Never send arbitrary user-supplied URLs to a server or run a fetch in F1.
- Reject non-HTTPS URLs, embedded credentials, ports other than standard HTTPS, IP literals, dotless and private/reserved hostnames.
- Avoid presenting sensitive path/query/fragment values in results, logs or persistent storage; only show counts and the normalized public origin.
- URL syntax validation does **not** verify ownership, availability, HTTPS configuration, DNS resolution, page content or any security claim.
- No cross-tenant reads/writes, records, provider tokens, deployment, billing, email or external actions.
- Server-side crawling remains prohibited until separately designed, authorized and verified SSRF protections including every DNS resolution/redirect, private/cloud-metadata IP blocking, robots and rate limits, bounded fetch budgets and audit provenance.

## Functional acceptance

1. `/site-review` remains protected by `RequireAtlasIdentity`.
2. Valid public HTTPS URL can be prepared offline, showing origin/hostname/path-depth/query-count and explicit not-scanned status.
3. Internal names, IP literals, embedded credentials and nonstandard ports fail closed.
4. URL path/query values/fragments are never displayed or stored.
5. Clear action removes all state; keyboard navigation, labels, error alerts and responsive layout are supported.
6. Creator Web Launch, Content Intelligence and Execution Readiness links remain unchanged.
7. Unit tests and TypeScript/build/CI verify the **exact PR HEAD SHA** before any release decision.

## Subsequent gated phases

- F2: import **user-supplied or authorized** HTML snapshots into a deterministic sandbox audit engine, with parser robustness, safe rendering, provenance and tests.
- F3: server-side crawling behind organization permission, scope, isolation, authorization and SSRF/robots/rate-limit controls; retain bounded evidence and audit logs.
- F4: verified accessibility, performance, SEO, DNS and security provider adapters, with explicit `not_configured` states and evidence versioning.
- F5: remediation and proposed pull requests through the existing ATLAS Work/Creator/Release Control flow, no automatic merge or publication.

## Production decision

**P0 NO-GO** until exact-SHA CI, code review, session/tenant boundary tests, responsive/E2E route verification, deployed artifact provenance and external provider gates are verified. No production deployment is authorized in F1.
