# ATLAS Spatial Forge 777 — original 3D capability

Date: 2026-11-23  
Stage: **local domain proof only; no production/UI integration**  
Public reference: https://docs.hyper3d.ai/en

## Distill ideas, do not copy protected implementation

Hyper3D publicly documents generic image/text-to-3D, geometry optimization, texture generation, rigging, and asynchronous submit/status/download flows. This run does not copy Rodin weights, private algorithms, brand, proprietary interface or licensed outputs. It does not use its API, send uploads, or incur vendor costs.

## Reuse the existing ATLAS platform

- `packages/creator/creative_engine.ts`: canonical creative-engine readiness/cost ranking.
- `packages/creator/ai_universe.ts`: verified provider discovery and cost governance.
- `packages/creator/brand_360.ts`: photo turntable, never mistaken for a 3D mesh.
- `docs/architecture/ATLAS_URBAN_TWIN_CORE.md`: tenant-scoped spatial entities and audited bindings.
- `apps/web/src/modules/frontier/FrontierWorld3D.tsx`: existing WebGL2 runtime.

Do not create another identity, billing, tenant model, job queue, asset store or provider registry. No Vercel dependency.

## RUN 001: precise implementation

`packages/creator/spatial_forge.ts` performs pure validation and deterministic procedural OBJ generation for **only** four named primitives: cube, pyramid, cylinder and sphere (English and Spanish aliases). The output is an actual triangular mesh, with provenance `atlas-procedural-preview`, and is **not neural text-to-3D nor image-to-3D**. Unsupported prompts, neural generation, texture synthesis, high quality and file formats other than OBJ are refused. No HTTP route, React UI, persistent storage, rigging, GPU engine or externally billed service is activated.

The domain `SpatialAuthority` input is **not security enforcement by itself**. A future HTTP handler MUST derive tenant/org/actor and permissions on the server from ATLAS Identity/RBAC/RLS; a client must never be allowed to assert trusted fields. `nativePreviewVerified` likewise needs a runtime observation from trusted server state.

## Subsequent P0 pipeline (not implemented)

1. Add canonical Creator request admission, verified tenant/org identity, consent, rate and size limits, and explicitly approved budget.
2. Reuse ATLAS durable queue with idempotency keys, cancellation and audited `queued → running → failed/completed` transitions.
3. Register a licensed, **actually executable** local/self-hosted 3D neural model if available; test fidelity against reference multi-view sets. Never relabel the procedural preview or Brand 360 as neural.
4. Validate model and texture bytes, triangulation/mesh integrity, bounds, safe references, formats, provenance, copyright/license and upload safety.
5. Persist only verified results within an org-scoped object store, SHA-256 of exact bytes, retention policy, access controls and auditable URLs. Reject unsafe download redirects/SSRF.
6. Expose real task status, downloadable assets, an accessible 3D viewer and Creator Library integration; relate verified assets to Urban Twin.
7. Run negative RBAC/RLS tests, browser E2E, queue recovery, CI, review, production and exact-SHA verification before GO.

## Evidence and release boundary

Unit tests check deterministic OBJ indices/topology, closed mesh faces and positive orientation, primitive parsing, scope/permission failure, image/model metadata and denied non-implemented capability. Local TypeScript compilation and source smoke tests are distinct from GitHub Actions CI. Server integration, production deployment, AI inference and end-to-end validation remain **P0 NO-GO** until independently verified. No change here claims a working generative AI product or approved paid requests.
