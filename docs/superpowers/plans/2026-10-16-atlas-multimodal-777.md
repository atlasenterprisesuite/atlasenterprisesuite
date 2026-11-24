# ATLAS Multimodal 777 — implementation and acceptance gate

Status: IN PROGRESS — not production verified.

## Reuse and boundaries
Extend `supabase/functions/atlas-copilot/intelligence-gateway.mjs`, existing provider adapters, conversation store, ATLAS Tool Gateway and worker realtime transports. Do not create a parallel assistant or bypass the existing Zero Trust and cost gates.

## Observed blocker
The canonical intelligence gateway currently advertises only `generation` and `reasoning` capabilities; unsupported requests return `capability_unavailable`. Multimodal claims therefore remain blocked until actual provider adapter, input validation, storage, UI and integration evidence exists.

## Delivery slices (TDD first)
1. Add failing tests for image/document input contracts, MIME and byte limits, authenticated tenant-bound storage, malware scanning/quarantine, retention, redaction and rejection of unsafe URLs. No raw media in telemetry.
2. Implement validated multimodal input envelopes and capability-aware routing, gated on verified provider descriptors. Preserve existing text clients and fail closed on unsupported providers.
3. Implement secure document extraction, images, audio transcription and synthesis, realtime speech with barge-in and loop recovery. Short-lived tokens, no client-side provider secrets.
4. Implement bounded video-frame extraction with timestamps, explicit consent, strict limits, accessibility captions and signed media references. No invented live-video support.
5. Integrate tool proposals with existing tenant/RBAC/RLS/approval/cost gates, idempotency and audit. No direct model-origin side effects.
6. Add responsive accessible UI, graceful fallback and offline/reconnect states; verify iOS Safari.
7. CI: unit, adapter-mocked integration, tenant-isolation, adversarial prompt injection, secret-leak checks, rate-limit, cancellation, browser E2E and build. P0 blocks merge/deploy; P1 documented.
8. Deploy only after passing CI and production configuration checks; compare exact deployed SHA with approved commit and run authenticated production E2E. Roll back on failure.

## Required proof before FINAL PRODUCTION VERIFIED
- All tests pass with links to run IDs, coverage and artifacts.
- Live production routes respond with correct auth and tenant isolation.
- Audio interruptions and repetition recovery verified on target devices.
- Media limits, quarantine, data deletion and provider cost limits verified.
- Production SHA matches approved commit; no unresolved P0.

No production completion claim is permitted without this evidence.
