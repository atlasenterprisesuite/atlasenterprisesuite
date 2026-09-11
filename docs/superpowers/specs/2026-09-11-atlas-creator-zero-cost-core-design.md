# ATLAS Creator Zero-Cost Core Design

## Purpose

Extend the existing ATLAS Creator / Studio module instead of creating a parallel application. The first production slice adds a sovereign provider contract, a zero-cost registry, truthful readiness, and a self-hosted FLUX image path that never falls back to a metered API.

## Existing surfaces

Reuse `/studio`, `/studio/create`, `/studio/library`, `/studio/providers`, `/studio/voice`, ATLAS Identity, organization context, audit conventions, Supabase functions, and the existing Creator UI.

## Scope of this slice

1. Add a shared Creator provider model with explicit billing and readiness state.
2. Register `flux-schnell-local` as the first zero-cost image provider.
3. Add ATLAS Auto selection that only chooses enabled, zero-cost, ready providers in zero-cost mode.
4. Add a Supabase Edge Function `atlas-creator-generate` that validates the request and forwards only to an explicitly configured self-hosted FLUX endpoint.
5. Update Creator Studio to display zero-cost mode, provider readiness, and generation submission truthfully.
6. Add tests and a Creator-specific CI workflow.

## Zero-cost invariant

`ZERO_COST_MODE` is the default behavior. In this mode ATLAS must not invoke any provider whose billing class is `metered` or `subscription`. No automatic fallback to paid APIs is allowed. If no local provider is ready, the result is `resource-blocked` or `configuration-required`, not a fabricated generation.

## Provider contract

Each provider exposes: `id`, `name`, `capabilities`, `billingClass`, `execution`, `license`, `commercialUse`, `state`, and optional `reason`. Provider states are `ready`, `configuration-required`, `resource-blocked`, and `unavailable`.

The initial provider is `flux-schnell-local`: image capability, zero-cost billing, self-hosted execution, Apache-2.0 model license, commercial use allowed, and configuration required unless an authorized runtime probe confirms the local endpoint.

## Request contract

Creator generation requests contain `kind`, `prompt`, `format`, `visibility`, and `zeroCostMode`. Image generation accepts only prompts with at least 8 non-whitespace characters. The server chooses a provider; clients cannot force a paid provider while zero-cost mode is on.

## Runtime architecture

Browser -> Supabase Edge Function `atlas-creator-generate` -> provider router -> self-hosted FLUX HTTP endpoint.

The Edge Function reads `ATLAS_FLUX_LOCAL_URL`. Missing configuration returns a structured configuration-required response. The local endpoint is expected to expose `/health` and `/generate` and return a generated asset payload or URL. The Edge Function never contains or requests payment credentials.

## Security and tenancy

The Creator routes stay identity-gated. The Edge Function requires Authorization and organization context headers before generation. Provider URLs are server-side environment values and are never exposed to the browser. Future persistence must use tenant-scoped tables with RLS before generated assets are shared across users.

## UI behavior

Creator Home shows Zero-Cost Mode. Providers identifies self-hosted engines and billing class. The Create workspace enables submission when the prompt is valid, but reports `configuration-required`, `resource-blocked`, `queued`, `completed`, or `failed` from the actual generation response. It never renders an invented asset.

## Verification gates

- Unit tests validate provider filtering and ATLAS Auto selection.
- Integration tests validate Creator UI copy and disabled/ready behavior.
- Typecheck and build must pass.
- CI must run on the feature branch and pull requests to main.
- Production is not considered ready until a self-hosted FLUX readiness probe succeeds on deployed infrastructure.