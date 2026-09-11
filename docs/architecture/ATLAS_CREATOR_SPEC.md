# ATLAS Creator / Studio

Owner: ATLAS Studio. Integrations: ATLAS Identity, Security, Voice, Knowledge Atlas and Supabase.

## Product contract

- Routes: `/studio`, `/studio/create`, `/studio/library`, `/studio/providers`, and existing `/studio/voice`.
- Every route is protected by ATLAS Identity and active organization membership.
- Image, video, music, voice and visual-location features expose provider readiness truthfully.
- No provider is labeled connected or ready until its authorization and a successful readiness check are verified.
- Generation results are shown only after the provider returns a verified output; persistence remains a separate production gate.
- Visual-location analysis is opt-in, confidence-bearing and prohibited from silent tracking.

## Zero-Cost Mode

- Zero-Cost Mode is the default Creator execution policy.
- ATLAS Auto may route only to a provider with billing class `zero-cost`, commercial use allowed, capability match and state `ready`.
- Metered and subscription providers are never automatic fallbacks in Zero-Cost Mode.
- If no eligible runtime is available, ATLAS returns `configuration-required`, `resource-blocked` or `unavailable` instead of generating a simulated result.
- The first self-hosted image provider is `flux-schnell-local`, implemented under `services/creator-flux` and bridged through `supabase/functions/atlas-creator-generate`.
- The FLUX runtime requires the service credential `ATLAS_FLUX_RUNTIME_TOKEN`; the Edge Function and runtime must share the same secret.
- `/studio/providers` obtains authenticated runtime readiness rather than inferring provider health from configuration alone.

## Supabase contract

Production persistence requires tenant-scoped creator projects, generations, assets, provider connections and audit events with row-level security. Until those migrations and authorized storage paths exist, Creator must state that persistence is pending and must not represent transient generation output as a saved library asset.

## Production gate

The FLUX path is not production-ready merely because code is merged or the service starts. Production evidence requires an authenticated `/health` result with `ready=true` and at least one successful authenticated `/generate` request through the ATLAS Supabase bridge. CI typecheck, unit tests, integration tests and build must also pass before merge/deploy.
