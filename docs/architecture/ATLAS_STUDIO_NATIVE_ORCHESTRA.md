# ATLAS Studio Native Orchestra

## Purpose

ATLAS Studio owns creative production. External media vendors are optional adapters, never the default execution path. The sovereign path is:

`Creative intent -> ATLAS Studio Orchestrator -> canonical ProductionSpec -> deterministic validation -> human render approval -> ATLAS Native Composer -> Creator Library -> audit evidence`.

## Intelligence orchestra

The Studio orchestration contract keeps model responsibilities separate from render execution:

- **ChatGPT/OpenAI**: creative direction, script/storyboard proposals, production planning.
- **Gemini**: multimodal review and independent visual/continuity critique when a verified Gemini/MCP connection is available.
- **Codex Sovereign**: technical verification, contracts, compiler/runtime checks and implementation evidence.
- **ATLAS Studio Orchestrator**: deterministic reconciliation into the canonical `ProductionSpec`.

An AI agent may propose or review production state, but it may not authorize render cost, mutate production truth without the governed API, or approve a production deployment. Unverified agents remain `configuration-required` or unavailable; ATLAS must not fabricate an online state.

## Native render path

`apps/web -> atlas-creator-native Edge Function -> creator-native self-hosted service -> FFmpeg + local TTS -> private Supabase Storage -> creator_assets`.

The first Native Composer slice supports:

- 9:16, 16:9 and 1:1 video canvases;
- local narration through an installed self-hosted TTS runtime;
- deterministic auto-captioning when explicit captions are absent;
- burned captions;
- local background audio mix;
- H.264 video and AAC audio in MP4;
- zero-cost billing classification;
- no automatic paid-provider fallback.

## Governance

Native render requires all of the following:

1. authenticated ATLAS Identity and organization context;
2. `creator.generate` permission;
3. a persisted `ProductionSpec` at the exact `expected_version`;
4. non-blocking deterministic validation;
5. audio enabled with narration text available;
6. a supported aspect ratio;
7. a successful readiness probe from the self-hosted composer;
8. explicit human render action in Director.

Dirty drafts are blocked so a render can never silently use an older persisted version.

## Data and provenance

The Edge boundary creates a `creator_generation_jobs` record before render, stores completed MP4 output in private `creator-assets` storage, creates a `creator_assets` row, records `$0` actual cost and `atlas-native` provenance, and writes completion/failure audit evidence.

Native service credentials remain server-side in:

- `ATLAS_NATIVE_COMPOSER_URL`
- `ATLAS_NATIVE_COMPOSER_TOKEN`

The browser never receives the composer token or direct filesystem paths.

## Production truth

Merging code does not make the renderer production-ready. Production readiness requires the self-hosted runtime to be deployed, its dependencies (`ffmpeg`, `ffprobe`, local TTS) to probe healthy, the Supabase Edge Function to be deployed with authorized secrets, repository validation to execute successfully, and an end-to-end render to appear in Creator Library with matching audit evidence.

Paid providers such as Seedance, Veo, Kling, Wan or MiniMax remain separate optional adapters behind Provider & Cost gates. ATLAS Native must never fall back to them automatically.
