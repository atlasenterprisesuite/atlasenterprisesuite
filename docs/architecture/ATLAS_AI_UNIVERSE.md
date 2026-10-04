# ATLAS AI Universe

Date: 2026-09-30
Status: Initial implementation
Owner: ATLAS Studio / Intelligence Platform

## Purpose

ATLAS AI Universe is the Studio launchpad for discovering and using multimodal AI capabilities from one governed experience. It is inspired by the product pattern of multi-model AI aggregators, but it does not copy another service's branding, proprietary interface, code, pricing, or provider contracts.

## Product contract

The launchpad lives inside the existing authenticated `/studio` experience and reuses current ATLAS routes instead of introducing a second creative platform.

Canonical entry points:

- `/assistant` — multi-provider text/intelligence workspace.
- `/studio/create?type=image` — Image Lab.
- `/studio/create?type=video` — ATLAS Director.
- `/studio/create?type=music` — Music Lab.
- `/studio/voice` — Voice & Agents.
- `/studio/write` — Writing Desk.
- `/studio/content` — Content Intelligence.
- `/studio/library` — saved creator assets and productions.
- `/studio/providers` — provider/model readiness.

## Principles

1. Capability-first navigation: users choose the outcome they need, not a vendor name.
2. One ATLAS identity and tenant boundary.
3. No provider is shown as connected or executable unless readiness is verified server-side.
4. Provider-backed media generation fails closed when configuration, authorization, storage, permission, or cost policy is missing.
5. Generated media becomes an ATLAS asset only after a provider returns a successful result and persistence succeeds.
6. Provider secrets remain server-side.
7. Existing cost governance remains authoritative; a provider being configured does not automatically authorize a paid call.
8. ATLAS Assistant remains the canonical conversation owner when multiple providers participate.
9. Model/provider additions extend existing registries and adapters rather than creating parallel routing systems.
10. Trends and reusable creative directions must be stored as ATLAS-owned templates or user-authorized assets, not copied proprietary presets.

## Current capability groups

- AI Chat
- Image generation and editing
- Video generation and direction
- Music and sound
- Voice and agents
- Writing and transformation
- Content intelligence and creative trends
- Provider/model readiness
- Creator Library and provenance

## Planned extensions

- Searchable model catalog with capability metadata.
- Automatic model recommendation based on media type, quality, latency, cost policy and readiness.
- Reusable ATLAS trend/template gallery.
- Side-by-side provider comparison where policy permits.
- Unified generation history across modalities.
- Per-organization usage and cost telemetry.
- Enterprise provider allowlists and quotas.
- Admin-only provider onboarding and verification workflows.

## Verification boundary

This change establishes the launchpad and canonical navigation only. It does not claim that every listed third-party model is integrated or commercially available through ATLAS. Individual execution remains governed by the existing provider readiness and generation contracts.


## Phase 2 — control center

Implemented surfaces:

- authenticated route: `/studio/ai-universe`;
- dynamic catalog built only from `atlas-copilot` provider readiness and Creator engine readiness;
- deterministic recommendation for cost policy, observed latency, and a bounded quality proxy based on completion history plus capability fit;
- side-by-side comparison for up to three catalog entries;
- authenticated 30-day usage summary sourced from persisted `atlas_ai_requests` telemetry;
- unified recent-history view across Assistant conversations, Creator productions, and persisted Creator assets;
- ATLAS-original reusable template gallery;
- provider onboarding/readiness surface that keeps credentials server-side and requires explicit readiness verification.

### Telemetry truth boundary

`atlas-copilot?api=usage` aggregates only persisted request telemetry for the authenticated organization scope. Non-manager users receive their own actor scope. The summary reports request counts, completion/failure counts, observed latency, provider/model usage, provider-reported token fields when available, and `automatic_api_cost_usd` recorded by the ATLAS routing policy.

The UI renders unavailable telemetry as unavailable. It does not infer missing counts or costs.

### Recommendation truth boundary

The recommendation engine never selects an unverified provider. Executable verified engines outrank planning-only fallbacks. The quality option is explicitly a proxy using observed completion history and capability fit; it is not a subjective media-quality score.

### Trend/template truth boundary

The gallery contains ATLAS-original reusable patterns. It does not claim that a template is a current social-media trend. Live trend status remains unavailable until an authorized external signal source is connected and its provenance is retained.

### Provider onboarding boundary

Provider secrets are never collected by the AI Universe browser page. Administrators configure credentials/model identifiers through approved server-side secret/configuration boundaries, organization policy authorizes the provider, and readiness probes must verify it before execution becomes available.
