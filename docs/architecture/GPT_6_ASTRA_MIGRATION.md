# ATLAS GPT-6 Astra Migration

Status: runtime migrated and verified on 2026-09-07.

## Scope

ATLAS Intelligence uses OpenAI through Supabase Edge Functions in `atlas-core` (`ggmanzcgtlrvqfoccgsh`). This migration moves the active OpenAI-backed intelligence routes to `gpt-6-astra` while preserving ATLAS tenant, permission, audit, storage, and truthful-state boundaries.

Migrated runtime surfaces:

- `atlas-copilot` — central ATLAS IA route; fast/balanced/deep all use `gpt-6-astra` with low/medium/high reasoning respectively.
- `atlas-repair-bridge` — repair planner uses `gpt-6-astra` with high reasoning and strict structured output.
- `atlas-personal-intelligence` — authenticated personal intelligence uses `gpt-6-astra` with medium reasoning.
- `atlas-sign-interpret` — image-input sign interpretation uses `gpt-6-astra` with low reasoning and strict structured output.
- `atlas-openai-readiness` — non-inferential model availability probe for the configured OpenAI key.

## API contract

ATLAS uses the OpenAI Responses API (`POST /v1/responses`) for Astra inference.

The migration follows the GPT-6 Astra model guidance:

- model ID: `gpt-6-astra`
- reasoning effort: low / medium / high according to the ATLAS profile
- no `temperature`, `top_p`, `top_logprobs`, Chat Completions `logprobs`, or Responses output-logprob requests
- Structured Outputs remain enabled where ATLAS requires machine-readable output
- image input remains enabled for ATLAS Sign
- `store: false` remains explicit on ATLAS inference calls

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
