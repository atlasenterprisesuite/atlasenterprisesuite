# ATLAS Spatial Forge Enterprise 777 — functional clean-room roadmap

Research date: 2026-11-23. Stage: **architectural inventory + domain policy**, no production deployment.

## Sources (public documentation only)

- Pricing and Enterprise: https://hyper3d.ai/pricing
- API architecture / task lifecycle: https://docs.hyper3d.ai/en
- Features and model families: https://docs.hyper3d.ai/en/get-started/features
- API quick start: https://docs.hyper3d.ai/en/get-started/quick-start
- Mesh optimization: https://docs.hyper3d.ai/en/api-specification/polygen
- Rigging: https://docs.hyper3d.ai/en/api-specification/rigging
- Parts segmentation: https://docs.hyper3d.ai/en/api-specification/bang
- Rodin Agentic (beta): https://docs.hyper3d.ai/en/api-specification/rodin-agentic
- API data retention policy: https://docs.hyper3d.ai/en/legal/data-retention-policy

This records functionality and architectural ideas, **not** permission to copy Hyper3D/Deemos source, model weights, proprietary assets, UI, branding, private documentation, training datasets or confidential contracts. Any optional Hyper3D API adapter requires its own approved contract and payment authorization. Hyper3D Enterprise deployment rights do not automatically grant source/weight redistribution.

## Verified public Enterprise capabilities

Advertised as **custom quote** (not a publicly fixed dollar amount):
- Team administration / controls.
- Private on-premises deployment by negotiated arrangement.
- Custom LoRA and fine-tuning.
- Volume pricing / negotiated usage and API throughput.
- AI + artist production support.

Business lists $120/month or $1,152 annually and standard API access; Creator lists $30/month or $288 annually. Public marketing prices/quotas can change; never use the marketing table as an authoritative billing ledger. API policy dated 2026-08-03 says request payloads and results remain in active systems for seven days and are not used for model training. Legal/commercial controls and exceptions must be re-evaluated if relying on contractual Enterprise processing or an external provider.

## Functional DNA → ATLAS clean-room ownership

| Public capability | Original ATLAS counterpart | Existing reuse / bounded next step | RUN 002 status |
|---|---|---|---|
| Text → 3D | Prompt-to-mesh | Native four-primitive OBJ preview; licensed model adapter necessary for unrestricted prompts | Partial, preview only |
| Image / multi-view → 3D | Spatial reconstruction | Creator asset intake + verified model worker | Unavailable |
| AI model/quality selection | Model-agnostic capability router | Extend Creator readiness and AI Universe selection | Planned |
| Asset preview before billing | Preview + explicit cost authorization | Existing Creator cost governor, no direct charging | Policy only |
| Geometry refinement / low-poly | Mesh topology and LOD | Validated offline remeshing and quality gates | Planned |
| PBR / materials / textures | Spatial material pipeline | Separate texture engine, UV/normal and license checks | Planned |
| Parts separation | Entity segmentation | Store parts graph under asset, not tenant-free metadata | Planned |
| Rigging / animation | Skeleton / skinning / animations | Use licensed worker; match output formats with provenance | Planned |
| World / scene generation | ATLAS Urban Twin scenes | Reuse Urban Twin entity hierarchy and GPS 4D | Planned |
| Export / conversions | Content-addressed artifacts | OBJ procedural proof only; GLB/FBX/STL/USDZ disabled until real converters | Partial |
| Asynchronous status / download | Durable Creator jobs | Reuse existing ATLAS jobs/orchestration; no new queue | Planned |
| Enterprise team controls | Tenant-scoped RBAC + RLS | Extend existing identity/organization/permission checks | Domain guard only |
| Private on-prem runtime | License-verified local worker | Probe host, GPU, weights, region and storage before marking ready | Planned |
| Custom tuning | Governed model registry | Data consent, provenance, training rights and evaluation | Planned |
| Cost at scale | Organization budget + metering | Explicit budget, concurrency, idempotency contract | Domain guard only |
| Artist review | Human quality-review checkpoint | Creator review decisions and versioned evidence | Planned |

## The new enterprise admission domain

File: `packages/creator/spatial_enterprise_policy.ts`. New tests: `tests/unit/creator-spatial-enterprise-policy.test.ts`.

A server-derived attestation must prove exact tenant / org / actor scope, `creator.spatial.generate`, paid permission, confirmed execution provider and license, policy-allowed capability and provider, geographic residency, no external processing when forbidden, encryption in transit/at rest, retention, concurrent jobs, spent budget, approved spend and exact SHA-256 idempotency fingerprint.

Decisions are `enqueue`, `return-existing`, or explicit fail-closed denial. **The pure function does not implement actual authentication, RLS, queue insertion, transactional deduplication, billing, file ingestion, provider execution, or storage.** Its evidence struct must never be deserialized from request-supplied client assertions. Backend code must derive it from trusted authenticated ATLAS components and record the authority/provenance independently.

Financial approvals must not be inferred from plan names, token balances, sales listings or user consent to code changes. The zero-cost internal procedural preview is separate from billable inference. The domain cannot guarantee isolation if a caller constructs forged evidence. Reuse transactional org-scoped insertion for idempotency and budget reservations to close concurrency races; domain decisions alone are insufficient.

## Provider candidates — licensing review required

- Microsoft TRELLIS: https://github.com/microsoft/TRELLIS . Official repository describes MIT licensing for models and most code, but dependencies, third-party data, hosted model terms and commercial use of particular project assets still need component-by-component review.
- Tencent Hunyuan3D-2.1: https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1 . The official community license covers code/weights subject to specific obligations and territorial/use restrictions; **not equivalent to MIT**.
- No third-party weights or repository code were copied into ATLAS in this run. Neither candidate has been installed, probed or licensed for production in ATLAS.

## Priorities and P0 acceptance

1. Build an authorized authenticated server boundary; derive trusted scope and provider attestation.
2. Add tenant-scoped immutable usage ledger, idempotent job allocation, budget reservation, retention and secure bytes validation.
3. Inventory GPU runtime and independently verify license before installing an executable model.
4. Upload consent and IP rights checks; sandbox file parsers; deny SSRF / archive bombs / unsafe paths; reject fabricated geometry or fabricated provider readiness.
5. Run real bounded image-to-3D with signed output identity, mesh metrics, exact file SHA-256, repeatability and artifact retention.
6. Build responsive accessible Creator UI and viewer; integrate existing Creator Library and Urban Twin links.
7. TDD unit/integration/E2E plus CI; full branch security review, PR gates, exact deploy SHA and production probes.

**Status: P0 NO-GO** for product parity, paid inference, production launch and claims of deployed neural 3D generation. A passing domain test is not an end-to-end demonstration.
