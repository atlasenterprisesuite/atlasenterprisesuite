# ATLAS Local Zero-Cost Intelligence

Status: provider integrated; OIDC/Vault/Tunnel live-bootstrap implemented on 2026-09-18. Production verification remains fail-closed until the self-hosted machine completes the bootstrap.

## Goal

Provide ATLAS with a default intelligence path that creates no automatic third-party model API charges.

This does not copy proprietary model weights or bypass provider billing. ATLAS reproduces the product-level orchestration capabilities around a self-hosted model runtime and keeps paid providers governed behind explicit policy.

## Canonical route

`User -> ATLAS Assistant -> IntelligenceRouter -> atlas-local -> self-hosted Responses-compatible runtime -> ATLAS Tool Gateway -> audit/persistence`

The default zero-cost policy is:

- `ATLAS_AI_ENFORCE_ZERO_COST=true`
- `ATLAS_AI_ALLOW_PAID_SINGLE=false`
- `ATLAS_AI_ALLOW_COUNCIL=false`
- default `ATLAS_AI_ZERO_COST_PROVIDERS=atlas-local`

If `atlas-local` is not configured and verified, Auto may identify another technically compatible provider but the cost policy blocks that paid route before inference.

## Self-hosted provider

Provider id: `atlas-local`

Runtime contract:

- authenticated HTTPS endpoint;
- `GET /health` for readiness;
- `POST /v1/responses` for inference;
- profile-specific server-side model aliases;
- no credential returned to browsers, logs, conversations or telemetry.

Recommended reference runtime: llama.cpp. Current llama.cpp server documentation exposes OpenAI-compatible Responses, embeddings, multimodal support, structured output and function calling. Model capability still depends on the selected local model.

## Environment

```text
ATLAS_LOCAL_AI_URL=
ATLAS_LOCAL_AI_TOKEN=
ATLAS_LOCAL_AI_MODEL=
ATLAS_LOCAL_AI_MODEL_FAST=
ATLAS_LOCAL_AI_MODEL_BALANCED=
ATLAS_LOCAL_AI_MODEL_DEEP=
ATLAS_LOCAL_AI_ALLOW_UNAUTHENTICATED=false
ATLAS_LOCAL_AI_ALLOW_INSECURE=false
ATLAS_AI_ENFORCE_ZERO_COST=true
ATLAS_AI_ALLOW_PAID_SINGLE=false
ATLAS_AI_ALLOW_COUNCIL=false
ATLAS_AI_ZERO_COST_PROVIDERS=atlas-local
ATLAS_AI_EMERGENCY_OPENAI_ENABLED=false
ATLAS_AI_EMERGENCY_OPENAI_DAILY_BUDGET_USD=0
ATLAS_AI_EMERGENCY_OPENAI_RESERVE_USD=0
ATLAS_AI_EMERGENCY_OPENAI_MAX_OUTPUT_TOKENS=512
```

No production default model is fabricated. The runtime is unavailable until a real model is configured and the health probe passes.

## Capability model

ATLAS separates model capability from orchestration capability.

Self-hosted model/runtime can provide generation, reasoning, multimodal input, structured output and model-level function calling when supported by its model/template.

ATLAS itself owns:

- tenant isolation;
- RBAC;
- audit;
- conversation state;
- cost policy;
- tool authorization;
- mutation approval;
- routing and fallback;
- future async tool scheduling;
- future mid-turn steering;
- computer/device execution through governed ATLAS runtimes.

A local model is never advertised as supporting a capability that has not been verified.

## Cost boundary

`automatic_api_cost_usd=0` is emitted only for routes explicitly classified as zero-cost by the server policy.

It means no automatic third-party AI API charge. It does not claim that electricity, hardware, storage, bandwidth, a reverse proxy/tunnel, or optional cloud hosting are free.

Paid OpenAI, Bedrock or Gemini routes remain available for explicit future authorization, but strict zero-cost mode blocks them automatically.

### Emergency OpenAI fallback

ATLAS can be prepared for a narrowly scoped paid fallback without disabling zero-cost governance globally. The emergency path is valid only when all of these conditions are true:

- Auto mode selected `atlas-local` first;
- the selected local provider failed with a transient `provider_unavailable` or `provider_rate_limited` result;
- OpenAI is currently configured and verified;
- `ATLAS_AI_EMERGENCY_OPENAI_ENABLED=true`;
- both the daily authorization budget and per-call reservation are positive;
- the server-side reservation RPC atomically confirms remaining daily headroom.

The reservation ledger is organization-scoped, service-role-only, RLS protected and conservative: every authorized emergency attempt consumes its reservation from the ATLAS daily authorization budget even if the upstream request later fails. This is intentionally fail-closed.

The default values keep emergency paid fallback disabled. A positive dollar limit must be explicitly authorized before activation.


## Live bootstrap

The remaining physical runtime boundary is automated by `.github/workflows/atlas-local-ai-bootstrap.yml`.

The trusted path is:

```text
GitHub main workflow
  -> GitHub OIDC
  -> atlas-local-ai-bootstrap (Supabase)
  -> ATLAS Vault
  -> Cloudflare Tunnel + Access
  -> self-hosted Linux host
  -> llama.cpp on 127.0.0.1:8080
  -> protected https://local-ai.atlasenterprisesuite.com
  -> atlas-copilot
```

No inbound model port is opened. The host establishes an outbound Cloudflare Tunnel. External requests require both Cloudflare Access service authentication and the independent llama.cpp bearer token.

The bootstrap chooses a conservative baseline model that can run on modest hardware:

- model: `ggml-org/Qwen3.5-0.8B-GGUF:Q4_0`
- license: Apache-2.0
- runtime alias: `atlas-local-default`
- context baseline: 8192
- llama.cpp pin: `v0.4.1`

This baseline exists to make the zero-cost path operational on CPU-class hardware. It does not prevent later replacement with a larger compatible GGUF model after real host RAM/GPU capacity is measured.

### Verification gate

ATLAS marks the provider `verified` only after all of the following succeed:

1. the self-hosted service reports loopback health;
2. the Cloudflare Tunnel service is active;
3. the protected HTTPS endpoint passes Cloudflare Access;
4. the runtime bearer token is accepted;
5. a real `POST /v1/responses` inference returns the readiness marker;
6. the local runtime registry records the successful verification.

Installation, configured environment variables, or an existing tunnel alone are not sufficient to mark the provider live.

### Secret boundary

The runtime bearer token and Cloudflare Access service credentials are stored in Supabase Vault. GitHub does not contain persistent local-AI secrets. The main workflow receives bootstrap credentials only after GitHub OIDC verification, masks them immediately, stores them in a temporary mode-0600 file for installation, and deletes that file after use.

The Cloudflare Tunnel connector token is written on the host to a restricted token file and is consumed with `cloudflared tunnel --token-file`, keeping it out of the process command line.
