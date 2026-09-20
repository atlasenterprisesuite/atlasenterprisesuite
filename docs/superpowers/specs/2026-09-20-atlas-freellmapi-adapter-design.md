# ATLAS FreeLLMAPI Adapter — Design Specification

Date: 2026-09-20
Status: Approved for governed integration
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/freellmapi-adapter-v0-11-1`
Owner: ATLAS Assistant / Intelligence Platform
External baseline: FreeLLMAPI `v0.11.1`

## Purpose

Add FreeLLMAPI as an optional inference-pool adapter behind the existing ATLAS `IntelligenceRouter` without making it a production dependency, public service, tenant authority, or independent consensus vote.

The integration consumes the documented OpenAI-compatible `/v1/responses` and `/v1/models` surfaces and relies on FreeLLMAPI v0.11.1 for its internal model/provider failover improvements. ATLAS remains responsible for tenant isolation, RBAC, cost policy, audit, tool authorization, provider truth, and outer-provider failover.

## Canonical flow

`User -> ATLAS Assistant -> IntelligenceRouter -> FreeLLMAPI Adapter -> private FreeLLMAPI v0.11.1 runtime -> free-tier upstream pool`

FreeLLMAPI is one ATLAS provider boundary even though it may internally route across many upstreams.

## Security boundary

- The FreeLLMAPI unified key is a server-side secret only.
- The adapter accepts an environment-configured base URL; browser/user input cannot choose it.
- HTTPS is required by default.
- Credentials embedded in URLs are rejected.
- HTTP can be enabled only through an explicit server-side development override.
- The adapter never exposes the unified key to client code, telemetry, logs, prompts, or stored conversation messages.
- FreeLLMAPI does not receive ATLAS tenant credentials, Supabase service-role credentials, Cloudflare tokens, or GitHub credentials.
- Tool execution remains disabled in this adapter. Any future tool support must enter ATLAS through the existing Tool Gateway and approval model.

## Activation model

The adapter is disabled by default.

Required runtime configuration:

```text
ATLAS_FREELLMAPI_ENABLED=true
ATLAS_FREELLMAPI_URL=https://<private-authorized-runtime>
ATLAS_FREELLMAPI_KEY=<server-side-unified-key>
```

Optional model overrides:

```text
ATLAS_FREELLMAPI_MODEL_FAST=auto:fast
ATLAS_FREELLMAPI_MODEL_BALANCED=auto
ATLAS_FREELLMAPI_MODEL_DEEP=auto:smart
ATLAS_FREELLMAPI_TIMEOUT_MS=150000
ATLAS_FREELLMAPI_PROBE_TIMEOUT_MS=10000
ATLAS_FREELLMAPI_ALLOW_INSECURE=false
```

FreeLLMAPI must be added to `ATLAS_AI_ZERO_COST_PROVIDERS` only when the deployed private pool is verified to have no marginal API charge for ATLAS. It is never classified as zero-cost merely because the adapter exists.

## Routing policy

- `freellmapi` participates in `auto` only when enabled, configured, runtime-verified, capability-compatible, allowed by cost policy, and explicitly eligible under the current provider policy.
- It is not exposed as a user-selectable provider mode in the ATLAS Assistant UI.
- Explicit provider modes keep their existing no-silent-fallback contract.
- ATLAS outer failover remains deterministic and auditable.
- FreeLLMAPI internal failover is treated as implementation detail behind one provider boundary.
- `X-Routed-Via` is captured only as bounded routing telemetry; it does not become an ATLAS authorization source.

## Council policy

FreeLLMAPI is an aggregate router, not an independent model identity. It is therefore excluded from ATLAS Council quorum and vote counts. This avoids counting a router that may call the same upstream families already participating directly.

## v0.11.1 protections used

The integration baseline expects the v0.11.1 routing behavior, including:
- adaptive endpoint retry budget derived from historical TTFB;
- deprioritization of model/endpoint combinations known to reject tool calls;
- skipping a platform after repeated distinct `model_not_found` misses;
- longer benching of routes with repeated truncated streams;
- failover when an upstream returns an out-of-credits message with HTTP 200.

ATLAS does not duplicate these model-level heuristics. It adds an outer bounded timeout and provider-level failover.

## Health/readiness

`probe()` calls `GET /v1/models` with the unified bearer key.

Readiness is true only when:
1. the adapter is explicitly enabled;
2. base URL and key are present;
3. the endpoint is reachable within the probe timeout;
4. the endpoint accepts the unified key.

Configuration presence alone is not production evidence.

## Execution

`execute()` sends a non-streaming `POST /v1/responses` request with:
- the selected ATLAS reasoning-profile model alias;
- ATLAS sovereign instructions;
- authorized conversation input;
- bounded output tokens;
- `store:false`;
- a bounded outer timeout.

ATLAS accepts only a non-empty normalized text response. Empty/malformed results fail closed as `provider_unavailable`.

## Failure normalization

- 401/403 -> `provider_auth_failed`
- 404 -> `provider_not_configured`
- 402/429 -> `provider_rate_limited`
- 5xx/network/timeout/malformed-empty response -> `provider_unavailable`

In `auto`, existing ATLAS gateway rules may continue to the next authorized provider for retryable availability/rate-limit failures. In explicit provider modes, no cross-provider fallback is introduced.

## Deployment rule

If ATLAS self-hosts FreeLLMAPI, pin the runtime image to:

`ghcr.io/tashfeenahmed/freellmapi:v0.11.1`

Do not deploy `:latest` as the production integration baseline.

The runtime must stay private or access-controlled. Port 3001 is not exposed directly to the public Internet as an ATLAS API.

## Production classification

`freellmapi = optional / experimental inference pool`

It is not:
- an ATLAS system of record;
- a production SLA dependency;
- a security authority;
- a tenant authority;
- a mandatory provider;
- a Council quorum member.

Sensitive modules such as Finance, Accounting, Payroll, Health, Security, and ATLAS Pay continue to obey their existing module policies and may exclude FreeLLMAPI entirely.

## Acceptance criteria

1. Adapter is disabled by default.
2. No credentials are committed to the repository.
3. HTTPS is required unless an explicit development override is set.
4. Readiness performs a real authenticated probe.
5. Requests use `/v1/responses` and never bypass ATLAS authorization.
6. `X-Routed-Via` is recorded only as telemetry.
7. FreeLLMAPI is auto-route eligible but not a user-selectable Assistant mode.
8. FreeLLMAPI cannot count toward Council quorum.
9. Existing direct providers and ATLAS Local continue to work unchanged.
10. Unit tests cover configuration, auth, routing metadata, error normalization, auto preference, and Council exclusion.
11. Full CI and security checks must pass before merge.
12. Production verification remains fail-closed for the public ATLAS domain and critical ATLAS Network routes.
