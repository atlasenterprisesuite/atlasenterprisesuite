# ATLAS GPT-6 Astra Migration

Status: direct OpenAI runtime migrated; advanced Astra + Amazon Bedrock integration updated 2026-09-18.

## Scope

ATLAS Intelligence uses OpenAI through Supabase Edge Functions in `atlas-core` (`ggmanzcgtlrvqfoccgsh`). This migration moves the active OpenAI-backed intelligence routes to `gpt-6-astra` while preserving ATLAS tenant, permission, audit, storage, and truthful-state boundaries.

Migrated runtime surfaces:

- `atlas-copilot` — central ATLAS IA route; fast/balanced/deep all use `gpt-6-astra` with low/medium/high reasoning respectively.
- `atlas-repair-bridge` — repair planner uses `gpt-6-astra` with high reasoning and strict structured output.
- `atlas-personal-intelligence` — authenticated personal intelligence uses `gpt-6-astra` with medium reasoning.
- `atlas-sign-interpret` — image-input sign interpretation uses `gpt-6-astra` with low reasoning and strict structured output.
- `atlas-openai-readiness` — non-inferential model availability probe for the configured OpenAI key.
- `atlas-copilot` also supports an optional `bedrock` provider backed by the OpenAI-compatible Amazon Bedrock Responses API. Direct OpenAI remains first in Auto routing; verified Bedrock is the next infrastructure fallback before other provider families.

## API contract

ATLAS uses the OpenAI Responses API (`POST /v1/responses`) for Astra inference.

The migration follows the GPT-6 Astra model guidance:

- model ID: `gpt-6-astra`
- reasoning effort: low / medium / high according to the ATLAS profile
- no `temperature`, `top_p`, `top_logprobs`, Chat Completions `logprobs`, or Responses output-logprob requests
- Structured Outputs remain enabled where ATLAS requires machine-readable output
- image input remains enabled for ATLAS Sign
- `store: false` remains explicit on ATLAS inference calls
- prompt caching uses `prompt_cache_options.ttl = "30m"` and an organization-isolated cache key on the direct OpenAI adapter
- Astra profile changes use `configuration_update` input items while keeping the request-level reasoning prefix stable
- unsupported parameters such as `temperature`, `top_p`, `top_logprobs`, and logprob output requests remain absent

Official references:

- https://developers.openai.com/api/docs/models/gpt-6-astra
- https://developers.openai.com/api/docs/guides/latest-model
- https://openai.com/index/gpt-6-astra/

## Runtime verification evidence

Before cutover, the configured production `OPENAI_API_KEY` was checked against the OpenAI model endpoint and then with a real Responses API inference using `gpt-6-astra`. The inference returned `ASTRA_READY` and resolved the model as `gpt-6-astra`.

After the central Copilot deployment, `atlas-copilot?api=readiness` returned:

- state: `ready`
- provider: `openai`
- provider_state: `verified_for_request`
- API: `responses`
- fast: `gpt-6-astra`
- balanced: `gpt-6-astra`
- deep: `gpt-6-astra`
- storage_state: `configured`

Runtime versions after migration:

- `atlas-copilot`: Edge Function v7 / app contract v4
- `atlas-repair-bridge`: Edge Function v8 / app contract v5
- `atlas-personal-intelligence`: Edge Function v5
- `atlas-sign-interpret`: Edge Function v7
- `atlas-openai-readiness`: Edge Function v3

ATLAS persisted the verification in `atlas_runtime_verification_runs` with:

- `verification_type = ai-model-migration`
- `target_version = gpt-6-astra`
- `status = passed`
- `provider = openai`
- `provider_state = verified_for_request`

## Configuration

The primary Copilot override is `ATLAS_OPENAI_ASTRA_MODEL`; its default is `gpt-6-astra`.

Specialized optional overrides:

- `ATLAS_OPENAI_ASTRA_REPAIR_MODEL`
- `ATLAS_OPENAI_ASTRA_VISION_MODEL`

If these are absent, the migrated routes use `gpt-6-astra`.

## Truth boundary

A model appearing in OpenAI documentation is not sufficient evidence for ATLAS production readiness. ATLAS records readiness only after the configured project key can resolve the model and the active runtime reports the expected provider/model state. Public readiness endpoints do not expose the OpenAI secret and do not execute paid inference probes.


## Amazon Bedrock provider

ATLAS supports Amazon Bedrock as an optional, governed provider rather than silently replacing direct OpenAI.

Defaults:

- endpoint: `bedrock-runtime`
- region: `us-west-2`
- Runtime model/profile: `us.openai.gpt-6-astra`
- Mantle model: `openai.gpt-6-astra`
- API: OpenAI-compatible Responses
- storage: `store: false`
- reasoning profiles: low / medium / high
- prompt caching: 30 minute TTL where accepted by the endpoint

Environment variables:

- `AWS_BEARER_TOKEN_BEDROCK` or `ATLAS_BEDROCK_API_KEY`
- `ATLAS_BEDROCK_ENDPOINT=runtime|mantle`
- `ATLAS_BEDROCK_REGION`
- `ATLAS_BEDROCK_BASE_URL` for an explicit authorized endpoint override
- `ATLAS_BEDROCK_MODEL`, `ATLAS_BEDROCK_MODEL_FAST`, `ATLAS_BEDROCK_MODEL_BALANCED`, `ATLAS_BEDROCK_MODEL_DEEP`
- `ATLAS_BEDROCK_RUNTIME_VERIFIED=true` only after an external deployment/readiness check has verified the configured Runtime inference profile

Bedrock Runtime does not expose the OpenAI-compatible Models API. Therefore ATLAS fails closed: a configured Runtime API key alone is reported as `configured-unverified`, and Auto routing will not use Bedrock until verification evidence has been supplied. Mantle can use its Models endpoint for non-inferential readiness verification.

The Supabase Edge adapter uses a Bedrock API key because it is not running inside an AWS workload identity. Long-running ATLAS workers hosted inside AWS should prefer the standard AWS credential chain and SigV4 rather than static bearer credentials.

## Capability boundary

Direct OpenAI and Amazon Bedrock are intentionally not treated as capability-equivalent.

Direct OpenAI GPT-6 Astra can support async tool calling, mid-turn steering over WebSocket, reasoning configuration updates, Programmatic Tool Calling, multi-agent orchestration, remote MCP, hosted tools, computer use, and prompt caching. The current ATLAS HTTP Copilot adapter enables prompt caching and reasoning configuration updates; other advanced capabilities remain disabled until their execution contracts are implemented.

Amazon Bedrock supports text/image/file inputs, structured output, function calling, streaming, reasoning effort, persisted reasoning on supported models, prompt caching, custom tools, client-side tool search, and computer use. Bedrock does not provide Astra async tool calling, mid-turn steering, reasoning updates, Programmatic Tool Calling, multi-agent orchestration, remote MCP servers, hosted file search, shell, or image-generation tools. Hosted web search is Mantle-only.

ATLAS must never advertise an unavailable feature merely because the underlying model supports it on another endpoint.
