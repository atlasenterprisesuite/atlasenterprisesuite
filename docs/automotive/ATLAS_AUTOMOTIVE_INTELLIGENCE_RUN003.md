# ATLAS Automotive Intelligence 777 — RUN 003

Status: **candidate implementation, NO-GO until CI, review, deploy and production evidence**.
Reviewed: 2026-11-26.
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
Route: `/automotive` (public read-only research, browser-only local photograph).
Module readiness: `partial`, **not** active automated vision inference.

## Reused rather than duplicated

- React / Vite app, `AtlasShell`, canonical module registry / navigation and global production verifier.
- ATLAS Finance → Accounting → Reports → Automotive Sales remains a separate, *demo-data* reporting domain linked for navigation. No unverified vehicle retail unit joins.
- Existing GitHub Actions CI and Cloudflare deployment.

## Functional slice

1. Upload a local JPG/PNG/WebP (5 MiB maximum) to **preview locally**.
2. A human may select a candidate among two McLaren Spider variants; this is **not visual model recognition** and must never be assigned an AI confidence score.
3. Generate a model-level technical dossier from fixed official manufacturer references.
4. The UI displays 720S Spider vs 750S Spider performance and source links, and exports a machine-readable JSON dossier on explicit click.
5. Reject SVG and other unsupported media. Reject unknown model IDs. Object URLs are revoked when replaced or unmounted.
6. Never send a photo to a provider, backend, telemetry endpoint or storage from this flow. No VIN, current price, inventory or live dealership availability is asserted.

### Source ledger

| Model | Manufacturer source | Scope | Review |
| --- | --- | --- | --- |
| McLaren 720S Spider | https://cars.mclaren.com/gl_en/legacy/720s-spider | 720 PS, 710 bhp, 0–100 km/h 2.8 s, 341 km/h | 2026-11-26, factory model spec |
| McLaren 750S Spider | https://cars.mclaren.com/uk_en/750s-spider | 750 PS, 740 bhp, 0–100 km/h 2.8 s, 332 km/h | 2026-11-26, factory model spec |

Live listing prices, "US$386,700" MSRP mentioned in prior research, and exact ad photo identity **are not endorsed by these model-level sources and are not published as verified facts**.

## Fail-closed release criteria

- Unit tests enforce source provenance, no invented VIN/prices/confidence, valid models and photo security.
- React tests enforce actionable upload, required human selection and honest output; no network call for photo preview.
- Global production contract version 38 adds `/automotive` as a required P0 route and simulates HTTP 404 rejection.
- Build, typecheck, accessibility, CodeQL, security and production HTTP exact-SHA verification must succeed before GO.
- A real browser test against public production and provider-backed vision inference are separate gates, not established by a route HTTP 200.

## Follow-on (gated, not implemented)

- Authorized identity-scoped upload to private RLS-protected evidence storage, object-level audit and deletion.
- A real validated vehicle image model behind existing provider gateway and explicit consent.
- Confidence calibration on labeled test images; manufacturer model comparisons separate from unit-level VIN identity.
- Pricing with currency, date, market source, freshness and verification; never treat retailer inventory as a current quote without confirmation.
- Cross-module integration to ATLAS Ride, CRM and Finance only through existing authorization/tenant boundaries.
