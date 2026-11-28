# ATLAS Automotive Intelligence 777 — RUN 003

Status: draft PR only. Production NO-GO. Base: `main` at `fb42e57a9441bd38d258134fbd94439f66472aac`.

## Canonical reuse
- Reuses `apps/web/src/modules/registry.ts` and `apps/web/src/extensions/resolveAtlasExtension.tsx` for a protected Mobility route: `/mobility/automotive`.
- Does not duplicate `/finance/accounting/reports/automotive-sales`: existing departmental accounting stays DEMO-only.
- Mirrors Aviation's explicit source-provenance / unresolved-conflict boundary without importing Aviation-specific business types.
- No Supabase tables, uploads, API keys, third-party vision models, inference or expenditure.

## Available in this candidate
1. Browser-local image preview with 8 MB cap, JPEG / PNG / WebP magic-byte checks and object URL revocation.
2. Explicit *manual* hypothesis selection; upload alone cannot establish manufacturer, model, VIN, year or trim.
3. Read-only manufacturer-claim registry for McLaren 720S Spider and 750S Spider.
4. 720S Spider 0–100 km/h **conflict** is surfaced honestly: 2.8 s on manufacturer overview; 2.9 s in detailed official specification table.
5. Manufacturer links and verification date for each claim.
6. Accessible labels, mobile layout and keyboard focus treatment.
7. Identity protection at canonical route entry; no photo persistence or client-to-server transfer.

## P0 — fail closed
- Automatic image classification: no verified provider or on-device model.
- VIN decoding: no authoritative per-vehicle identity input.
- Real-time inventory, transaction prices and dealership offers: no authorized connector and date-linked evidence.
- Tenant-scoped upload/storage and audit: no RBAC / RLS implementation for photo persistence; photo transfer is disabled.
- CI, exact-SHA, external security checks, merge, production deployment and E2E: must be verified on this exact candidate commit before promotion.

## Validation contract
- `tests/unit/automotive-intelligence-evidence.test.ts`
- `tests/unit/automotive-image-validation.test.ts`
- `tests/integration/automotive-intelligence-routing.test.tsx`
- CI: `npm run typecheck`; `npm run test:unit`; `npm run test:integration`; `npm run build`.
- No production deployment until P0 are closed with evidence.

## Primary sources checked 2026-11-26
- https://cars.mclaren.com/gl_en/legacy/720s-spider
- https://cars.mclaren.com/de_de/legacy/720s-spider
- https://cars.mclaren.com/uk_en/750s-spider

## Non-goals
- No image-recognition claim, no autonomous vehicle control, no automated trade-in quote, no fabricated store inventory.
