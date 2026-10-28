# ATLAS Visual Intelligence 777 — isolated implementation contract

Status: DESIGN / NO-GO. No provider connections, production changes or deployed capability.

## Reuse first
Inspect existing Studio, intelligence gateway, object storage, auth/RLS, audit, jobs and image-processing components before implementing. No duplicate infrastructure.

## Functional pipeline
1. Authenticated upload with tenant-bound ownership, MIME/magic-byte validation, strict size limits, malware screening and retention policy.
2. EXIF/provenance extraction; never treat absent metadata as proof of AI generation.
3. Whole-image and crop-level perceptual hashes plus semantic embeddings, versioned by model.
4. Tenant-scoped nearest-neighbor lookup; external reverse-image provider only through explicitly configured, consented adapter with documented coverage and cost.
5. Evidence record: source URL, capture timestamp, content hash, crop coordinates, similarity score, retrieval method, source date (when verifiable), and uncertainty.
6. Independent forensic assessment: provenance, manipulation indicators, contradictory matches; output VERIFIED / INCONCLUSIVE / SUSPECTED with reason codes, never unsupported certainty.
7. Accessible UI: upload, crop, compare side-by-side, source links, confidence explanation and deletion.

## P0 fail-closed tests (write before implementation)
- Unauthenticated request => deny.
- Cross-tenant image, vector, evidence, job or URL lookup => deny; RLS and service-role scope verified.
- Revoked membership/session and expired credentials => deny.
- Arbitrary org_id/task_id overrides => deny.
- Private upload never sent to third-party search without explicit consent.
- Oversized/polyglot/malformed file, decompression bomb, SVG script => reject.
- URL fetch SSRF: localhost, private networks, redirects to private addresses, DNS rebinding => reject.
- Provider outage => INCONCLUSIVE, not verified or fake.
- Duplicate/replayed jobs => idempotent, tenant-bound, audited.
- Image deletion => purge objects, embeddings and derivative crops within retention policy.
- No cross-tenant similarity results or leakage through logs/cache.

## Delivery gates
Diagnosis → existing-code inventory → negative TDD → isolated implementation → unit/integration tests → PR → exact-SHA CI → security review → approved merge/deploy → production E2E.

P0 remains OPEN until evidence proves every gate. No deployment, provider spending or production credentials authorized by this document.
