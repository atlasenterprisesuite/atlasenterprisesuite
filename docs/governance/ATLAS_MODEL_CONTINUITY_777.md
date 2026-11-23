# ATLAS model continuity, permissions and recovery

Scope: extend the existing atlas-copilot gateway, conversation store and /assistant controls. No second orchestrator or provider registry.

## Design and acceptance

- Conversation identity belongs to ATLAS, not the provider. Read the latest 50 stored messages and return them in chronological order. This is a bounded recent-context window, not a claim of unlimited memory. Durable older decisions require the existing approved-memory path.
- Apply the router allowlist to explicit selection as well as automatic routing. Prototype property names are invalid reasoning profiles.
- Re-resolve the authenticated principal through the existing server auth path before each interactive provider attempt and before publishing its result or evaluating tool proposals. The organization, user, roles and permissions must remain unchanged; revoked intelligence.use blocks completion. A role/permission change stops the request so previously retrieved privileged history or memory is not dispatched under a downgraded context. Retry starts with fresh context. Native/detached background execution also rechecks before submission and finalization. This narrows revocation races; it does not make remote execution and authorization an atomic transaction.
- Keep automatic recovery inside verified, policy-allowed candidates; preserve history and avoid adding another user turn during fallback. Explicit provider mode never silently fails over. Permission errors are not retryable provider outages. Existing cost and emergency-budget gates remain authoritative.
- Response language, tone and detail are closed choices in the existing /assistant controls. Choices last for the mounted page session; reload resets them. They are transmitted as client metadata and rendered into instructions from fixed server labels, never arbitrary prompt text. They neither grant permissions nor override an explicit task such as translation.
- No provider API calls, external model evaluations or spend are needed for deterministic contract tests. These tests use controlled provider/HTTP transports; actual provider quality and production readiness remain separate evidence gates.

## Reuse and history gaps

The accessible-history search recovered prior concerns about authenticated production E2E, exact-SHA evidence and failed previews. These are leads, not current proof of failure. The canonical repository AGENTS.md and master execution protocol resolve repository identity: atlasenterprisesuite/atlasenterprisesuite is canonical. Do not transfer historical PR evidence from another repository without verification.

The repository already had switching/fallback tests, approved-memory retrieval, tenant-scoped storage, cost policy and accessibility preferences. This change adds missing boundary checks rather than rebuilding those systems.

## Verification plan

1. Observe negative tests against the unmodified gateway/store.
2. Run the deterministic continuity and existing council-security suites after the fixes.
3. Repeat that run three additional times as requested, retaining each log and its exit code.
4. CI must run complete unit/integration, typecheck and build checks on the PR head; check review/ruleset gates before merge.
5. Deploy through the canonical Cloudflare path and the authorized Supabase function path only after P0 gates pass. Reuse verify-production-p0.mjs and verify-global-production.mjs; validate exact deployed SHA and authenticated assistant behavior. A redirect to Access is not production success.

## Limits

This change does not migrate database schema, persist style preferences across accounts, export all ChatGPT chats, prove live model behavior, or deploy a provider. The current runtime can test a source subset retrieved at a fixed SHA through GitHub; a normal Git clone was unavailable because its gateway required credentials. Full repository checks must be evidenced by CI, not inferred from subset tests.

## Sovereign local multi-model pilot (2026-11-23)

**Status: branch-only guarded implementation; not a deployed or connected provider.** Reuse the existing `atlas-local` provider, `atlas-copilot` registry, routing profiles, authentication and cost policy. Do not create another source of truth, provider identity, tenant boundary or deployment pipeline.

### Candidate open-weight models (independent license and provenance checks required)

| Role example | Official model | Upstream |
| --- | --- | --- |
| Agentic/deep | Meta Muse Glimmer 30B | https://huggingface.co/meta-models/Muse-Glimmer-30B-GGUF |
| Balanced reasoning | OpenAI gpt-oss-20b | https://huggingface.co/openai/gpt-oss-20b |
| Fast/general | Qwen3-8B | https://huggingface.co/Qwen/Qwen3-8B |
| Alternative general model | Mistral Small 3.1 24B | https://huggingface.co/mistralai/Mistral-Small-3.1-24B-Instruct-2503 |

These are **model candidates, not installed models**. Each download, inference engine, build, license, dependencies, signature/checksum, hardware fit and actual tool-calling behavior requires its own approval and evidence. The manufacturer may retain separately licensed proprietary services that these weights do not include.

### Existing ATLAS runtime contract

Configure the existing server-side configuration only; never add model keys, access credentials, internal addresses or model files to git or frontend bundles.

- `ATLAS_LOCAL_AI_URL`: explicitly approved, access-controlled ATLAS-owned inference gateway; HTTPS by default.
- `ATLAS_LOCAL_AI_TOKEN`: server-side authentication secret, with existing Cloudflare Access credentials when needed.
- `ATLAS_LOCAL_AI_MODEL_FAST`, `ATLAS_LOCAL_AI_MODEL_BALANCED`, `ATLAS_LOCAL_AI_MODEL_DEEP`: **exact model identifiers returned by the private runtime**; these profile slots already exist and are not extra providers.
- `ATLAS_LOCAL_AI_VERIFY_MODEL_ID=true`: opt-in strict model ID verification; fail closed when the requested model is not advertised by `GET /v1/models` or when listing fails.
- `ATLAS_LOCAL_AI_ENFORCE_HOST_ALLOWLIST=true` and `ATLAS_LOCAL_AI_ALLOWED_HOSTS=approved-inference.example`: opt-in exact-host allowlist applied before **any** runtime request. If the configured host is not explicitly allowed or the list is empty, fail closed with `provider_untrusted_endpoint`. Entries are exact hostname-only values, never paths, URL credentials or wildcards. Never use model-maker or other untrusted API endpoints in this allowlist.
- The local runtime adapter rejects HTTP redirects for its health check, model listing and inference requests (`redirect: 'error'`) so a 30x cannot forward prompts or bearer headers to an unrelated destination. The approved host is still not proof that upstream proxies do not forward data.
- `ATLAS_AI_ALLOWED_PROVIDERS=atlas-local` and `ATLAS_AI_ENFORCE_ZERO_COST=true`: use the existing routing/cost policy when the required private-only posture applies; validate the effective policy per tenant and request.

When model-ID checking is on, both readiness and execution verify the requested profile's exact ID before sending conversational content to `/v1/responses`. A healthy server without the selected ID is **not** verified. A model list mismatch, malformed response, authentication error or unreachable catalog blocks invocation; the model cannot silently fall back to another provider. Strict verification is not a guarantee that the advertised model is genuine or that the endpoint has no external forwarding.

A recent `llama.cpp` can offer multi-model router mode (official documentation: https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md). Before using it, prove that its deployment supports both the existing `/v1/responses` request contract and `/v1/models` identifiers, and that the local host has sufficient GPU/RAM/disk. For Muse Glimmer, use a runtime build that explicitly supports the model architecture; see https://dev.meta.ai/docs/muse-glimmer/get-the-model . Never auto-download multi-gigabyte weights as a CI, install, build or deployment side effect.

### Privacy and P0 gates

1. Set both model-ID checking and exact-host allowlisting for privacy-sensitive deployments; verify model provenance, license, immutable digest and version with trusted local files; model names alone are insufficient.
2. Verify model host ownership and actual inference location; restrict runtime egress and DNS, telemetry, remote plug-ins and proxy upstreams to an explicit audited allowlist.
3. Keep prompts, attachments, memory, tenant data, tokens and logs on approved infrastructure. Do not send sensitive prompts to a vendor-hosted API or untrusted public gateway merely because the adapter says `atlas-local`.
4. Preserve ATLAS RBAC/RLS, membership reauthorization, secret boundaries, per-tool permission checks, audit event redaction and existing human production approvals.
5. Run deterministic tests (`node --test tests/node/atlas-local-multimodel-privacy.test.mjs`), then full CI, verified model inference tests, network-egress inspection, adversarial prompt/tool tests and P0 exact-SHA production verification.
6. Mark hardware unavailable, endpoint unverified, missing licenses, missing proof of isolation or failed security/CI checks as **NO-GO**; never fake model installation, execution or production readiness.

**Not provided by this change:** downloaded weights, local inference hardware, runtime deployment, model-fidelity proof, tool invocation permissions, production deployment, or guarantees about third-party network operators. The strict mode is opt-in to preserve existing provider behavior until the runtime and migration path are verified.
