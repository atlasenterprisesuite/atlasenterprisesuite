# ATLAS Video Universe 777 — provider-neutral creative stack

Date: 2026-11-17
Status: **draft PR implementation, NOT production deployment**.
Owner: existing ATLAS Studio / Creator, Director, Creator Library and ATLAS Native composer.
Base change: PR #1061 HeyGen Avatar 6 consent-aware handoff; this change builds on it without creating a parallel app.

## Why

The user requested an independent ATLAS audiovisual platform that studies HeyGen
and other video-creation software discussed in prior conversations and documents.
Architectural rule: **ATLAS first, third parties optional.** Implement original
capabilities, use public APIs where authorized, and never copy proprietary models,
code or interfaces without permission.

## Current source evidence and inventory

- First-party ATLAS modules already present: `/studio/create?type=video`,
  Director, Motion Designer, Creator Library, Native Composer and Creator permissions.
- Existing provider scaffolding names seedance, veo, kling, wan, minimax,
  but `atlas-creator` external submit currently ends at
  `provider_adapter_not_configured`. Readiness metadata is **not** executable generation.
- Connected HeyGen workspace has previously rendered ATLAS campaign videos.
  A private Spanish voice asset and one demo brand kit exist. No private
  digital twin was ready during the 2026-11-17 inventory; API-ready templates were empty.
  These observations are audit context, **not** embedded into public source data.
- Past ATLAS media investigations recommend preserving product/UI pixels through
  deterministic animation and using generative imagery for selective cinematic scenes.
  Related concepts: Adobe After Effects/Premiere/Firefly, Descript, Canva, CapCut,
  OpenArt, Runway, Veo, Kling, Seedance, Wan, HunyuanVideo, LTX, Remotion,
  Three.js and FFmpeg. Availability/licensing must be checked at execution time.
- HeyGen's connected app exposes 121 operations as of this audit. These are
  API tool operations, not a count of 121 independent user-facing features.

## HeyGen feature families inspected

| Family | Functions and ATLAS responsibility |
| --- | --- |
| Identity | Avatar 6 / studio avatars / private digital twin / photo or prompt avatar; consent and identity are independent P0 boundaries |
| Video production | Script-to-video, Video 1 text/image/reference, Video Agent, AI Studio scenes, cinematic avatar, two-person conversations |
| Voice | Voice library, synthesis, custom voice design, authorized voice clone, speech-to-speech, language/accent and pronunciation |
| Localization | Translation, dubbing, proofread/brand glossary, separate lip-sync job, subtitle assets |
| Post-production | AI clipping, silence/filler-word removal, background removal, scene edits, captioning |
| Production system | Templates, batch jobs, folders, uploaded assets, custom brand kits, colors and logos |
| Reliability | Jobs/status, cursor pagination, webhook signatures, rate limits, budgets and error contracts |

Primary sources:
- https://developers.heygen.com/
- https://heygen.noticeable.news/publications/november-2026-enterprise-api-releases
- https://www.heygen.com/models/heygen-avatar-6
- https://help.heygen.com/en/articles/9889198-how-to-create-a-brand-system
- https://developers.heygen.com/endpoint-version-comparison

**HeyGen API compatibility:** public developer release notes specify v1/v2
retirement on 2026-11-07, with v3 cursor pagination and signed webhooks.
The 2026-10-06 marketing email asked for migration by 2026-10-31.
Implement only verified v3 endpoints for new adapters. No legacy fallback.

## External video engines: the jobs they actually serve

| Class | Candidates | Primary ATLAS role | Integration gate |
| --- | --- | --- | --- |
| Deterministic editing | ATLAS Native; FFmpeg, Remotion and Three.js as existing/optional compute tools | Exact UI, logo, numbers, transitions, repeatable multi-format masters | Runtime verification, local compute, tenant RLS, tests |
| Avatar & training media | HeyGen | Consented presenter, voiceover, translation, lip-sync, templates | Provider-verified likeness consent, terms, per-render credits |
| Cinematic generation | Runway, Veo, Seedance, Kling | Text/image/reference-driven shots with audio depending on engine | Contract/model/version and credit limits |
| Self-hosted models | Wan2.2, LTX, HunyuanVideo | Offline/own-compute optional generation and motion transfer | License/weights, GPU, security, retention |
| Editing and publishing | Adobe Firefly/Premiere, Descript, CapCut, Canva | Editing, subtitles, localizations, branded distribution | Authorized handoff, provider availability, export rights |
| Model-market aggregator | OpenArt | Model discovery and alternative outputs | Never equate catalog availability with an API contract |

Source examples:
- https://docs.dev.runwayml.com/api/
- https://ai.google.dev/gemini-api/docs/video
- https://helpx.adobe.com/firefly/web/work-with-audio-and-video/work-with-video/generate-videos-using-non-adobe-models.html
- https://github.com/Wan-Video/Wan2.2
- https://docs.ltx.video/

**No cross-vendor quality ranking is asserted.** Clip quality, rights,
availability and price depend on model version, prompt, region and account.

## Implemented in this stacked PR

1. `packages/creator/video_universe.ts`: 12 workflows, 14 capability
   providers, discovery metadata, model/routing candidates and validated
   provider-neutral manifest compiling with exact brief preservation.
2. `VideoUniversePanel` in the EXISTING Director Provider & Cost step:
   workflow picker, compatibility selector, inspected connection observation,
   title/script, aspect, language, asset references, accessibility,
   rights-review note, JSON export/copy and real internal links.
3. Source UI and unit tests cover capability table, input validation,
   provider-mode mismatch, tenant/consent/billing safeguards,
   disabled execution from the discovery panel, and responsive layout.
4. Video Universe planning emits `submitted: false`, `status: planning-only`,
   names source IDs without reading them and does **not** write credentials,
   query biometric files, upload media, consume credits or impersonate anyone.

## Architecture roadmap and evidence gates

Existing canonical flow:
`Brief -> Director -> Original ProductionSpec -> Provider Capability Router
 -> ATLAS authorization -> consent/license/credit proof
 -> tenant job reservation -> provider or Native compute
 -> signed webhook/status polling -> Creator Library
 -> QC -> accessibility package -> approval -> Social Publisher`.

P0 — fail closed until ALL of these are server-side and durable:

- Tenant-specific identity, `creator.generate`/RBAC, provider credentials in secret store.
- Approved assets with provenance and content rights, real subject/voice consent.
- Immutable approved production spec revision and content digest.
- Verified model capability, price estimate and per-render budget approval.
- Atomic idempotency reservation, queue retries and cancellation behavior.
- Signed webhook verification, status reconciliation and no fake render results.
- Tenant-RLS audit/event/job/asset persistence, retention and revocation.
- AI-content disclosure, captions/transcript and appropriate provenance metadata.
- `npm ci && npm run verify:all`, ATLAS Consensus CI, CodeQL, then exact HEAD SHA
  verification and Cloudflare production runtime/rollback evidence.

P1 — next value after the current bounded slice:
- first-party timeline export for real media assets and branded templates;
- authenticated v3 adapter for HeyGen once consent and billing proofs exist;
- visual comparison/QC scoring using human review, not invented benchmarks;
- self-host Wan/LTX adapters when GPU + license validation passes;
- multi-provider fallback **only** when policy, cost and rights remain equivalent.

## Explicit non-goals in this PR

No new authentication system, duplicate RLS tables, no parallel editor,
no copyright-infringing asset ingestion, no stealth avatar cloning,
no scraping private provider resources, no background generation,
no unauthorized external spending, and no deployment claim.
