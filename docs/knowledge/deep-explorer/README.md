# ATLAS Deep Explorer — governed research integration (2026-10-20)

## Status
Initial source admission policy and unit tests committed on a feature branch. **Not a live crawler, Tor connection, deployed page, or production-verified capability.**

## Single source of truth
Deep Explorer is an extension of Knowledge Atlas / Humanity Atlas, not a separate knowledge datastore. Reuse existing Atlas Library provenance, draft/approval workflows, Intelligence Gateway and Tool Gateway. Domain findings route to their canonical modules.

## Seven levels (research maturity, not mythological Dark Web strata)
1. Public indexed content and primary sources
2. Archives, specialist repositories and open datasets
3. Cross-disciplinary comparisons and claims
4. Carefully curated legitimate onion services through isolated Tor
5. Provenance graphs and contradiction testing
6. Testable hypotheses and replication
7. Signed, auditable research dossiers and peer review

## Research record
Each finding needs tenant scope, domain owner, URL, captured date, publication date, author/source, source kind, permission/grant, hash of captured artifact, claims and counterevidence, evidence label, uncertainty, verification history, review state, and links to canonical records. Never silently promote a hypothesis to fact.

## Architecture
UI in Knowledge Atlas -> authenticated research request -> existing RBAC/tool approval gate -> queue -> source admission (packages/deep-explorer/source-policy.mjs) -> fetch worker -> untrusted-content sanitizer -> malware/file quarantine -> dedupe and content hashes -> evidence graph -> draft review -> approved Knowledge Atlas record.

Onion fetch jobs must run on a **separate, isolated Tor-capable runtime**, not a public Cloudflare web worker or user's normal web session. No Tor transport has been configured by this change. Disable onion fetching by default. When enabled, require per-tenant permissions and verified sources, egress controls, size/time/redirect limits, no script execution, no credentials, no automatic executable downloads, bounded crawl depth, and audit records. Re-evaluate every redirect and DNS resolution at the network boundary to prevent SSRF; the admission policy alone is not a network sandbox.

## Fail-closed gate
P0: authentication and tenant authorization; independently enforced egress/SSRF protection; provenance of onion addresses; isolated Tor transport; safe download and redirect controls; data privacy; RLS and audit; tests and production evidence. Missing any P0 => onion exploration disabled.
P1: advanced search ranking, multilingual summaries, visualization and UI refinements; record warnings.

## Acceptance and release
1. Run `node --test tests/unit/deep-explorer-policy.test.mjs`.
2. Review false positives/negatives, specifically IPv6, IDN, redirect chains and DNS-rebinding risks.
3. Integrate server-side authorization with existing identity/RLS rather than trusting booleans from the client.
4. Wire a real isolated read-only Tor connector with source allowlisting and non-onion HTTPS fetcher.
5. Add integration and E2E tests, PR review, CI, merge and independent exact-SHA production verification.
6. Keep operational status BLOCKED until each P0 is evidenced.
