# ATLAS Audio Platform Design

**Status:** Approved design direction
**Date:** 2026-10-05

## Goal

Turn ATLAS Creator Studio's existing `music` and `sfx` media kinds into a provider-neutral, auditable audio creation platform without fabricating provider readiness or generated output.

## Product surface

ATLAS Audio Platform contains:

1. **Audio DNA** — reusable analysis/reference metadata for owned or authorized audio.
2. **Music Lab** — composition workflow for instrumental and vocal music.
3. **Provider Router** — deterministic provider selection by capability, readiness, execution class, cost/latency policy, and tenant policy.
4. **Composer** — prompt/structure controls for duration, BPM, key/mode, energy, instrumentation, lyrics/vocals, sections, and negative constraints.
5. **Stems / Mix / Master** — derived asset graph for stems, edits, mixes, masters, loops, and exports.
6. **SFX Lab / Sonic Identity** — UI sounds, sonic logos, stingers, ambience, and brand packs.
7. **Adaptive Audio Engine** — maps approved product/UI events to authored musical states; no hidden autoplay or deceptive alerts.
8. **Rights & Provenance Ledger** — immutable generation/import provenance and commercial-use evidence.
9. **Creator Library integration** — audio assets remain first-class Creator assets rather than a parallel storage silo.
10. **ATLAS Native boundary** — reserved self-hosted/local adapter contract; readiness is false until runtime verification succeeds.
11. **Marketplace boundary** — future publishing/licensing surface, explicitly out of MVP execution scope.

## Existing architecture to reuse

The implementation extends, rather than duplicates, the existing Creator stack:

- `/studio/create?type=music` already routes Music Lab traffic through `CreatorWorkspace`.
- `CreativeMediaKind` already includes `music` and `sfx`.
- `CreativeEngineReadiness`, execution classes, ranking, provider readiness, CreativePlan, Creator Library, audit patterns, and provider-neutral prompt compilation remain authoritative.
- ATLAS Director remains the audiovisual orchestration surface and consumes Audio Platform assets through Creator Library references.

## Audio DNA

An `AudioDNA` record describes an authorized source/reference without treating it as permission to imitate protected artists or works.

Required fields:

- `id`, `organizationId`, `assetId`, `createdByUserId`
- `sourceKind`: `imported | generated | recorded`
- `contentHash`
- `durationMs`
- optional `bpm`, `key`, `mode`, `energy`, `loudnessLufs`
- `structure`: section markers and timestamps
- `features`: normalized tags for instrumentation, texture, density, rhythmic character, ambience
- `rightsEvidenceId`
- `createdAt`, `version`

Raw reference audio is never embedded into prompts or logs. Provider adapters receive a short-lived authorized object reference only when the provider capability and tenant policy permit reference audio.

The uploaded `DJ.m4a` is a candidate first validation reference only after it is imported through normal Creator asset ingestion and associated with rights evidence. No production spec assumes that chat attachment is already stored in ATLAS.

## Rights & provenance ledger

Every import, generation, edit, stem, mix, master, and export produces a ledger event containing:

- tenant/user identity
- asset and parent asset IDs
- provider/model/version or `atlas-native`
- normalized request hash and policy decision
- reference asset IDs (not raw bytes)
- provider terms snapshot identifier
- declared rights basis and commercial-use status
- output hash, timestamps, and audit correlation ID

The ledger is append-only from application workflows. Corrections are new events; historical evidence is not overwritten.

## Provider contract

Audio providers implement one internal contract. Provider-specific payloads do not escape adapters.

Capabilities are explicit: `music_generation`, `instrumental`, `vocals`, `lyrics`, `reference_audio`, `section_edit`, `stems`, `sfx`, `streaming`, `max_duration_ms`, accepted formats, commercial-use metadata, and cost-estimation support.

Generation states are `queued | running | succeeded | failed | cancelled`. A request cannot enter `queued` unless readiness was server-verified and authorization/rights policy passed.

Provider secrets remain server-side. Client code receives provider IDs, display metadata, capability/readiness, job state, cost estimate, and asset references only.

## Router policy

Default routing remains zero-cost-first and fail-closed. Ranking starts from existing `CREATIVE_EXECUTION_ORDER` and adds audio-specific eligibility gates before ranking:

1. tenant/RBAC authorization;
2. rights/reference policy;
3. requested capability match;
4. verified readiness and credit/quota state;
5. privacy/residency restrictions;
6. execution-class priority;
7. user-selected optimization policy: `quality | balanced | low-cost | private`.

No fallback may silently weaken rights, privacy, or capability requirements. A paid fallback requires an authorized tenant policy/budget.

Initial external adapters are designed for Eleven Music and Stable Audio, but they are not reported ready until credentials, entitlement, current API contract, and a server-side readiness probe all pass. `atlas-native` uses the same rule.

## Music Lab UX

`/studio/create?type=music` becomes a dedicated `MusicLabWorkspace`, parallel to Image Lab and Director.

Core controls:

- title and creative brief
- instrumental/vocal mode
- duration
- BPM or auto
- key/mode or auto
- energy curve
- instrumentation/tags
- structured sections
- lyrics language and optional user-authored lyrics
- authorized reference asset picker from Creator Library
- negative constraints
- routing policy and visible estimated cost before paid execution

States: idle, validating, blocked, ready, generating, processing, succeeded, failed, cancelled. The UI never renders a fabricated waveform, output, provider, price, rights status, or completion state.

## Asset graph

Generated audio is persisted as Creator assets with parent/derivative relationships. Supported derivative roles include `reference`, `composition`, `stem`, `loop`, `edit`, `mix`, `master`, `sonic-logo`, `stinger`, `sfx`, and `export`.

Exports target web/mobile/video-safe formats defined by server policy. Lossless masters are retained separately from delivery encodes.

## Adaptive Audio Engine

Adaptive audio consumes approved Creator assets and a declarative event map. It does not generate music synchronously inside critical business transactions.

Example state model: `ambient -> working -> build -> resolved`, with an independent `warning` state. Transitions use authored boundaries/crossfades and respect browser autoplay, accessibility, mute, reduced-motion/sensory preferences, and tenant policy.

## Security and multi-tenancy

- All audio records carry `organizationId` and are tenant-isolated.
- RBAC distinguishes view, create, generate, import-reference, export, publish, and administer-provider permissions.
- Signed/short-lived media URLs only; no public storage buckets for private assets.
- Provider callbacks require signature verification, replay protection, idempotency, and tenant/job correlation.
- File validation is server-side: MIME/signature, size/duration limits, malware scanning where applicable, and transcoding isolation.
- Audit events cover generation, reference use, rights decisions, exports, deletes, provider changes, and publishing.

## Cost, quotas, and reliability

ATLAS records estimated and actual provider cost per job where the provider exposes sufficient data. Tenant quotas and budget ceilings are checked before paid submission. Timeouts, provider errors, insufficient credit, and callback loss remain explicit states. Retries are idempotent and never create an unapproved duplicate paid generation.

## API boundary

MVP server endpoints/services cover:

- list audio-capable engines/readiness
- create/read Audio DNA analysis
- estimate generation
- create/read/cancel generation job
- provider callback ingestion
- list generated derivatives
- create export
- read provenance/rights summary

Exact transport paths follow the repository's existing Creator API/server conventions during implementation; no new parallel API framework is introduced.

## Testing and production gates

TDD is required for domain types, router, rights gate, idempotency, provider adapters, API authorization, UI states, and asset persistence.

Production verification is fail-closed for P0 routes and core Creator/Music Lab API health. Provider unavailability must degrade Music Lab truthfully without taking down unrelated Creator Studio surfaces.

Required E2E evidence before calling generation production-ready:

1. authorized user can submit a verified generation;
2. unauthorized/reference-rights-blocked requests are rejected before provider invocation;
3. callback/poll result persists a real Creator asset and provenance event;
4. duplicate callback/retry does not duplicate assets or charges;
5. failed provider state is visible and recoverable;
6. exported audio resolves through an authorized signed URL;
7. public ATLAS P0 verification remains green after deployment.

## Delivery phases

**Phase 1:** Audio DNA schema, rights/provenance ledger, provider contract/router, dedicated Music Lab UX, tests; generation remains gated.

**Phase 2:** First verified external adapter, job lifecycle, callbacks/polling, real Creator asset persistence, export, cost/quota controls.

**Phase 3:** second provider + failover policy, section editing/stems where supported, SFX/Sonic Identity, Director integration.

**Phase 4:** Adaptive Audio Engine and verified ATLAS Native/self-hosted adapter.

**Future:** marketplace/licensing and creator monetization only after legal, payments, tax, moderation, takedown, and rights operations are separately specified.

## Non-goals

- cloning or impersonating living artists or protected recordings;
- claiming copyright ownership automatically;
- client-side provider secrets;
- fabricated readiness/output;
- automatic marketplace publishing;
- bypassing provider terms or reference-audio rights checks;
- replacing Creator Library, CreativePlan, or existing provider-readiness infrastructure.
