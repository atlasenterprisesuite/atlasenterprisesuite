# ATLAS Web Intelligence F3 — secure crawl preflight (777 REVIEW)

## Scope and truth boundary
Use the canonical execution envelope under packages/execution, and the protected Site Review UI in PR #1042. Reconcile the unmerged Sovereign Browser PR #976 before implementing live network transports. Do not copy its unfinished broker into a second browser/crawler service.

This PR introduces a pure admission checker and negative TDD. Every decision is blocked and has mayFetch=false, including syntactically correct requests. It makes NO network request, does not attest ownership or authorization, does not store user data and does not enable scanning.

## P0 gates before live crawling
1. Server-verified identity, RBAC, organization and tenant scope; valid time-bound consent or other authorized public-data collection basis, verified from authoritative records immediately before each action and on revocation.
2. Exact HTTPS origin allowlist, without userinfo, ports, ambiguous URL normalization or unapproved path/query. Reject internal and reserved hostnames and IP literals.
3. DNS A/AAAA validation and socket-bound IP pinning with Host/SNI/TLS verification, including IPv4-mapped/NAT64, rebinding, metadata targets and mixed public/private records. Revalidate all redirects, retries and alternate paths. Existing PR #976 is NOT sufficient evidence of production socket binding.
4. Isolated server-side worker, scoped secrets boundary, bounded pages, response size, duration, concurrency, redirects, rate and retries. No scripts, auto-submission, external credentials or billable requests.
5. RFC 9309 robots.txt handling and site terms, site-owned allowlists or documented lawful public-data basis, clear bot identity, abuse controls and opt-out handling.
6. Durable evidence with actor, tenant, approval record, timestamp, policy/commit SHA, response digest, redacted origin, redirect decisions and revocation; zero credential or raw URL-query logging.
7. Negative tests for DNS rebinding, redirect-to-metadata, unauthorized tenants, revoked grants, robots-denied pages, malformed origin, resource exhaustion and evidence-write failure. E2E in an isolated mock server and independent security review.

## Acceptance for this milestone
- Pure preflight decision function integrated via the canonical execution package export.
- Source is read-only, transport is not configured, mayFetch remains false.
- Strict identity/scope/expiration/budget/origin/envelope checks with negative Vitest cases.
- Exact-head CI required; no merge or deploy from feature-branch assertions.

## Sources
OWASP SSRF Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
RFC 9309: https://www.rfc-editor.org/rfc/rfc9309.html
Existing engineering dependencies: PR #976 Sovereign Browser (draft), PR #1042 Site Review F1/F2 (draft).

## Release gate
P0 NO-GO: no live crawl transport, no production verified authorization, no exact SHA production evidence. The preflight cannot authorize or execute a request.
