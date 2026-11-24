# NVIDIA NIM optional provider — ATLAS 777 REVIEW

Status: **draft pilot; not deployed; no live NVIDIA inference verified**.
Base branch: `main` at `f632c3140e20e99b34808682f3109f24146078b4`.

## Reuse instead of duplication

ATLAS Unified AI Chat remains the single authenticated entry point. NVIDIA NIM uses the existing OpenAI-compatible adapter under the optional provider ID `nvidia`, retaining organization context, RBAC, authorization rechecks, routing, audit evidence and cost policy. This pilot requires no new database schema or authentication UI.

Official NVIDIA NIM APIs expose OpenAI-compatible `GET /v1/models` and `POST /v1/chat/completions`. Inference is server-side only.

## Server-side configuration (never commit secrets)

- `NVIDIA_API_KEY`: server-side token; required.
- `ATLAS_NVIDIA_MODEL`: exact supported model ID; required (no speculative default).
- `ATLAS_NVIDIA_MODEL_FAST`, `ATLAS_NVIDIA_MODEL_BALANCED`, `ATLAS_NVIDIA_MODEL_DEEP`: optional profile-specific model overrides.
- `ATLAS_NVIDIA_BASE_URL`: optional trusted HTTPS NIM endpoint; default `https://integrate.api.nvidia.com/v1`. An HTTP endpoint is disabled.
- `ATLAS_AI_ALLOWED_PROVIDERS`: optional allowlist; can include `nvidia` after approval.
- `ATLAS_AI_ENFORCE_ZERO_COST`: defaults to `true`. NVIDIA is not automatically treated as free. Never add it to `ATLAS_AI_ZERO_COST_PROVIDERS` without verified pricing/entitlement.

No key, NVIDIA account, subscription, billing or deployment is activated by this PR.

## Acceptance gates / P0

1. Missing token/model => configuration-required; no inference.
2. Unavailable model => unverified; explicitly selected provider fails closed.
3. No secrets in browser, source-control logs or telemetry.
4. Existing organization authorization and RBAC must remain enforced.
5. Default cost-policy blocks provider calls unless explicit cost authorization.
6. Exact PR HEAD SHA: focused Vitest, TypeScript, unit/integration suites, build and Actions.
7. Live token/model entitlement and budget must be verified separately before a staging smoke test.
8. No merge or production deployment until all P0 checks are satisfied.

## Supporting references

- https://docs.api.nvidia.com/nim/reference/llm-apis
- https://docs.nvidia.com/nim/large-language-models/latest/api-reference.html
