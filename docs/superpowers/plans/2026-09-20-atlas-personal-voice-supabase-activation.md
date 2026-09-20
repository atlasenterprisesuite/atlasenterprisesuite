# ATLAS Personal Voice — Supabase Activation Implementation Plan

> **Execution:** Follow the approved Personal Voice architecture in `docs/superpowers/specs/2026-09-06-atlas-personal-voice-design.md`. Keep provider readiness fail-closed: activating the ATLAS module means the governed capture/persistence workflow is usable, not that an external synthesis provider or Apple Personal Voice is verified.

**Goal:** Reconcile the existing ATLAS Voice surface with the governed Personal Voice flow, persist its state and private audio samples in canonical Supabase `atlas-core`, fix the discovered Storage policy defect, and activate the module only after CI and production verification evidence.

**Architecture:** Reuse the current `/voice` first-class module, `RequireAtlasIdentity`, `authorizedAtlasFetch`, granular Voice permissions, `packages/voice` domain contracts, the private `atlas-voice-samples` bucket, and the current fail-closed deployment pipeline. No parallel Supabase client, auth system, voice domain, or provider router is introduced.

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, Vitest 3, Supabase Postgres/PostgREST/Auth/Storage with RLS, GitHub Actions, Cloudflare production verification.

---

## Task 1 — Lock the persistence contract and repair Storage RLS

**Files**
- Create: `supabase/migrations/20260920050000_atlas_personal_voice_activation.sql`
- Create: `tests/unit/atlas-voice-supabase-contract.test.ts`

**Behavior**
- Mirror the currently deployed Personal Voice tables/permissions needed by the web workflow without duplicating data structures.
- Correct all `atlas-voice-samples` Storage policies to derive profile identity from the object path, not from `atlas_voice_profiles.name`.
- Standardize private object path as `<auth.uid>/<profile_id>/<session_id>/<sample_id>.<ext>`.
- Revoke anonymous table access explicitly.
- Narrow authenticated table grants to operations that have corresponding RLS policies.
- Keep service-role/server privileges unaffected.
- Preserve provider state as unconfigured.

**TDD**
1. Add a source-contract test that fails until the migration contains the correct `storage.foldername(name)` path parsing, explicit authenticated grants, and anon revocation.
2. Run the focused test in CI and confirm RED.
3. Add the migration.
4. Re-run focused test and Supabase/security verification.

## Task 2 — Add a canonical browser persistence adapter

**Files**
- Create: `apps/web/src/modules/voice/voiceApi.ts`
- Modify: `apps/web/src/lib/atlasSession.ts`
- Create: `tests/unit/atlas-voice-api.test.ts`

**Behavior**
- Reuse `authorizedAtlasFetch` for Auth, Data API, and private Storage.
- Resolve current user and active organization from the existing session bridge.
- Create/list/update owned voice profiles.
- Create/update recording sessions.
- Persist/revoke consent.
- Upload accepted audio blobs to the private bucket using the canonical path.
- Persist sample metadata only after successful upload; best-effort delete the uploaded object if metadata persistence fails.
- Never send service-role credentials to the browser.
- Keep provider generation fail-closed.

**TDD**
1. Add failing adapter tests using an injected transport to assert URLs, headers, tenant scope, owner scope, and upload path.
2. Confirm RED in CI.
3. Implement the minimum adapter.
4. Confirm focused tests GREEN.

## Task 3 — Restore and modernize the Personal Voice creation flow on current main

**Files**
- Create/restore: `apps/web/src/modules/voice/PersonalVoicePage.tsx`
- Create/restore: `apps/web/src/modules/voice/PersonalVoiceWizard.tsx`
- Create/restore: `apps/web/src/modules/voice/AppleVoicePage.tsx`
- Create/restore: `apps/web/src/modules/voice/browserMicrophone.ts`
- Create/restore: `apps/web/src/modules/voice/quality.ts`
- Modify: `apps/web/src/modules/voice/VoiceStudioPage.tsx`
- Modify: `apps/web/src/modules/voice/VoiceRoutes.tsx`
- Modify: `apps/web/src/modules/voice/voice.css`
- Create: `tests/integration/atlas-personal-voice-wizard.test.tsx`
- Modify: `tests/integration/atlas-voice-routing.test.tsx`

**Behavior**
- Preserve the Apple-inspired product flow without copying Apple branding: prepare/consent → sound quality → guided phrases → review → generation gate.
- Start from a real Supabase profile/session; resume from persisted session state.
- Upload only accepted samples.
- Record ownership challenge evidence and consent state.
- Keep local blobs ephemeral except for immediate replay/upload.
- Display persisted `My Voices` from RLS-protected Supabase data.
- Apple Personal Voice remains a native-device bridge capability and is never uploaded/exported by ATLAS.
- Generation remains disabled until a verified provider supports server synthesis.

**TDD**
1. Add failing routing/wizard integration tests for the restored subroutes and persistence calls.
2. Confirm RED in CI.
3. Implement UI and persistence wiring.
4. Confirm focused integration tests GREEN.

## Task 4 — Reconcile production truth and activate the module

**Files**
- Modify: `scripts/verify-global-production.mjs` or the canonical route contract source it consumes
- Modify: `.github/workflows/atlas-assistant-self-hosted-ci.yml` only if needed to include Personal Voice focused tests
- Add/update focused production-contract tests if present.

**Behavior**
- Require `/voice/personal-voice` in the production verification contract in addition to `/voice`.
- Do not require an external generation provider for module activation.
- Require authenticated route shell, Supabase persistence contract, private storage policy, and current deployment SHA.
- Keep Apple native bridge and synthesis provider truthfully unverified/unconfigured.

**Activation sequence**
1. PR CI: Voice-focused tests, full unit/integration/typecheck/build/audit.
2. Merge to `main` only when required checks are green.
3. Main production readiness/deploy pipeline.
4. Global fail-closed production verification.
5. Only after positive route/deployment evidence, update `atlas_module_registry.voice` to `enabled=true`, `launch_status='active'`, with config preserving `generation_provider='not_configured'` and Apple bridge unverified.
6. Re-query Supabase registry, RLS/advisors, and public production routes before reporting completion.

## Non-negotiable truth boundaries

- “Voice active” means ATLAS Voice navigation, identity, governed microphone capture, Supabase persistence, and private sample storage are activated.
- It does **not** mean Apple Personal Voice is remotely controllable from web.
- It does **not** mean a custom synthesis/clone provider is connected.
- No raw voice audio enters audit metadata.
- No cross-tenant profile/sample access.
- No anonymous access.
- No fake generation state or fake readiness badge.
