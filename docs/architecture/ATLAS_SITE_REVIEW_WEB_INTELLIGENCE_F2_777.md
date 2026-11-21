# ATLAS Web Intelligence F2 — Offline HTML Snapshot Audit (777 REVIEW)

## Implementation and reuse
Continue from F1 and the existing protected `/site-review` route. Historical PR #5 provided the design for deterministic SEO, structural and accessibility checks, but its standalone shell, preview role selector, in-memory store and provider assumptions have not been imported. F2 implements a modern read-only snapshot analyzer in the existing React/TypeScript module.

## Provenance and privacy
- The operator manually selects a local `.html` or `.htm` file (up to 256 KiB) after preparing a public HTTPS origin. The origin is **operator-supplied context**, not verified source ownership.
- The browser reads the local file via `File.text()`. No `fetch`, `DOMParser`, remote service, provider connection, storage, iframe or `dangerouslySetInnerHTML` executes or displays the source.
- The raw HTML, file name, title, attributes and content are never included in results, reports, logs or any persistent database. Only deterministic rule IDs, severity/status and non-sensitive count messages are displayed in ephemeral component state.
- Results are invalidated on origin edit, reprepare, new file selection and clear. Async reads are epoch-guarded against stale overwrite.
- The lexical scan omits comment/script/style/template blocks and has known limitations on malformed HTML, odd whitespace, namespaces, nesting and dynamically generated DOM. All results are **heuristic static-source signals** rather than a compliance certificate.
- Supported checks: HTML root, title, meta description, viewport, canonical, html lang, H1 count, image alt attribute, missing link href, Open Graph title.
- Core Web Vitals, Search Console, live headers and remote link checking remain `not_configured`.

## P0 acceptance
1. Manual upload of bounded HTML only; file name/size validation and no server-side calls.
2. Reject empty/oversized source and unsafe review origin.
3. Code/path/source secrets do not appear in results.
4. No script execution, HTML sink or resource fetch.
5. Clear/error/loading/empty behavior, keyboard file input and responsive results.
6. Exact-head unit, integration, TypeScript, security and build workflows green.
7. Preserve existing identity/tenant boundary, F1 URL preparation and downstream routes.

## Follow-on gates
F3 crawling requires server-enforced permissions, authenticated actor and organization, DNS and redirect SSRF protections, bounded concurrency, robots/ToS respect, rate limits, target allowlist, integrity ledger and monitored audit evidence. External provider checks must remain fail closed until separately authorized and verifiable.

## Release
P0 NO-GO for merge/deploy until exact-SHA CI, E2E protected-route session tests, security review and provider/deployment evidence are independently verified. No production changes or external requests in F2.
