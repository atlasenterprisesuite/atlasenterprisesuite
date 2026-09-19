# ATLAS Local Zero-Cost Intelligence

Status: implementation integrated on 2026-09-18.

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
