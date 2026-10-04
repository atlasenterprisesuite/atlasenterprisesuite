# ATLAS Telnyx MCP Integration — Architecture Design

Date: 2026-10-04
Status: Awaiting written-spec review
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Branch: `atlas/telnyx-mcp-design-2026-10-04`

## 1. Purpose

ATLAS will integrate Telnyx as a governed, provider-specific communications adapter behind ATLAS-owned control planes rather than as a direct dependency of UI or business modules.

The integration uses Telnyx's canonical MCP server card at `https://telnyx.com/.well-known/mcp/server-card.json`, the remote MCP endpoint `https://api.telnyx.com/v2/mcp`, and the existing Telnyx REST/OpenAPI surfaces. The goal is to expand the existing ATLAS Telnyx voice implementation into a broader communications capability without weakening provider neutrality, tenant isolation, RBAC, evidence requirements, or fail-closed production gates.

ATLAS remains authoritative for permissions, lifecycle state, audit, user-visible truth, deployment state, and carrier resource ownership. Telnyx remains an external provider that supplies authenticated capabilities and evidence.

## 2. Existing implementation to preserve

The repository already contains a real Telnyx voice path:

- `supabase/functions/_shared/telephony-telnyx.ts` validates Telnyx voice configuration and performs an authenticated readiness probe.
- `supabase/functions/_shared/telephony-webhook.ts` validates Telnyx Ed25519 webhook signatures and timestamp tolerance.
- `supabase/functions/atlas-communication-telephony/index.ts` enforces ATLAS authentication, organization scope, RBAC, server-side secret access, readiness checks, audit, call-session persistence, and Telnyx call origination.
- `supabase/functions/atlas-communication-telephony-webhook/index.ts` receives Telnyx call events.
- `atlas_telephony_providers`, `atlas_call_sessions`, and `atlas_call_events` persist provider readiness, calls, and evidence with RLS.
- `docs/telecom/atlas-carrier-control-plane.md` already requires a provider-neutral carrier control plane and defines truth states for numbers and eSIM resources.
- `packages/atlas-mcp` already exists as the ATLAS-governed MCP tool boundary.

This design extends those assets. It must not create a second independent Telnyx source of truth or a competing carrier lifecycle.

## 3. Canonical Telnyx discovery contract

The Telnyx server card currently declares:

- MCP server: `https://api.telnyx.com/v2/mcp`
- transport: `streamable-http`
- authentication: `Authorization: Bearer <TELNYX_API_KEY>`
- protocol version: `2024-11-05`
- server info: `telnyx_api` version `3.0.0`
- canonical discovery card: `https://telnyx.com/.well-known/mcp/server-card.json`
- lightweight discovery index: `https://telnyx.com/.well-known/mcp.json`
- MCP Apps catalog: `https://api.telnyx.com/v2/mcp/apps`

The core remote tools are:

1. `list_api_endpoints`
2. `get_api_endpoint_schema`
3. `invoke_api_endpoint`

The required sequence is discovery first, schema inspection second, invocation third. ATLAS MUST NOT call `invoke_api_endpoint` for an endpoint whose schema has not been obtained and validated in the same governed operation context or from a fresh trusted schema cache.

`invoke_api_endpoint` is treated as potentially destructive regardless of the requested operation until ATLAS classifies the selected endpoint.

## 4. Architecture

```text
ATLAS UI / Agent / Business Module
              |
              v
      ATLAS Governance Layer
  tenant + org + RBAC + approvals
              |
              v
    ATLAS Communications Domain
       /                  \
      v                    v
ATLAS Carrier         ATLAS Messaging /
Control Plane          Voice Services
      \                    /
       v                  v
       Telnyx Provider Adapter
       /        |          \
      v         v           v
REST/OpenAPI   MCP       MCP Apps
               |             |
               v             v
      https://api.telnyx.com/v2/mcp
```

ATLAS Communication MUST NOT expose raw Telnyx credentials or a raw unrestricted remote MCP client to browser code, end users, or arbitrary agents.

The provider adapter translates ATLAS domain operations into Telnyx REST or MCP operations and normalizes results into ATLAS evidence objects.

## 5. Chosen integration strategy

Use a hybrid adapter:

- keep direct REST calls for production-critical paths already implemented and tested, especially call origination and webhook processing;
- use Telnyx MCP for endpoint discovery, schema inspection, operator tooling, capability expansion, and selected provider operations after explicit ATLAS classification;
- use Telnyx OpenAPI as the machine-readable contract for generated or validated request/response types;
- never replace a proven production-critical path merely to route it through MCP.

This avoids unnecessary migration risk while gaining Telnyx's MCP discovery model.

## 6. Target code boundaries

Implementation should converge toward the following boundaries without requiring a big-bang migration:

```text
packages/
  integrations/
    src/
      telnyx/
        client.ts
        mcpClient.ts
        discovery.ts
        endpointPolicy.ts
        capabilities.ts
        evidence.ts
        errors.ts
        index.ts

  atlas-mcp/
    src/
      telnyx.ts

supabase/functions/
  _shared/
    telephony-telnyx.ts          # existing; progressively delegates to shared adapter logic where safe
    telephony-webhook.ts         # existing; remains authoritative for webhook verification

apps/atlas-orchestrator/
  src/
    integrations/
      telnyx.ts                  # runtime wiring only, no provider business rules

tests/
  unit/
    telnyx-mcp-discovery.test.ts
    telnyx-endpoint-policy.test.ts
    telnyx-mcp-session.test.ts
  integration/
    telnyx-mcp-readonly.test.ts
    atlas-telnyx-governance.test.ts
```

Exact file names may be adjusted during implementation to match current package conventions, but provider-specific logic must remain isolated from ATLAS domain state machines.

## 7. Remote MCP client contract

The Telnyx remote MCP client must support:

- streamable HTTP transport;
- Bearer authentication from server-side secret storage only;
- explicit request timeout;
- bounded retries for safe read-only operations;
- no automatic retries for non-idempotent writes unless a provider-supported idempotency mechanism is present;
- correlation/request IDs in evidence where available;
- structured error normalization;
- redaction of authorization headers and sensitive provider payloads;
- protocol/session validation.

The generic remote MCP operations are internal adapter primitives, not public ATLAS tools.

## 8. Endpoint discovery and classification

ATLAS adds a policy layer between Telnyx endpoint discovery and invocation.

Each discovered endpoint is normalized into an internal record conceptually containing:

```ts
interface TelnyxEndpointDescriptor {
  name: string;
  schemaDigest: string;
  resource: string | null;
  operation: string | null;
  risk: 'read' | 'write' | 'destructive' | 'unknown';
  idempotency: 'idempotent' | 'provider_key' | 'non_idempotent' | 'unknown';
  requiredAtlasPermission: string;
  approvalClass: 'none' | 'operator' | 'human_release';
  schemaObservedAt: string;
}
```

Default classification is `risk: unknown`, which fails closed.

Read-only status, inventory, lookup, usage, and monitoring endpoints may be allowed automatically only after RBAC and tenant scope checks.

Write operations such as number ordering, connection changes, billing controls, messaging sends, SIM/eSIM mutations, recording changes, or call-control mutations require explicit ATLAS permissions and an operation-specific policy.

Destructive or financially material operations require an explicit approval class. A generic Telnyx endpoint discovered at runtime never becomes write-enabled solely because the remote schema allows it.

## 9. ATLAS MCP exposure

`packages/atlas-mcp` remains the only ATLAS-owned MCP tool boundary.

Do not expose Telnyx's generic `invoke_api_endpoint` directly to agents.

ATLAS may expose curated tools such as:

- `atlas.telnyx.capabilities.read`
- `atlas.telnyx.endpoint.list`
- `atlas.telnyx.endpoint.schema.read`
- `atlas.telnyx.number.lookup`
- `atlas.telnyx.voice.status.read`
- `atlas.telnyx.usage.read`

Write tools are capability-specific and mapped to existing ATLAS domain permissions, for example:

- number ordering routes through ATLAS Carrier Control Plane;
- outbound calling routes through ATLAS Communication;
- messaging routes through the ATLAS Messaging domain;
- eSIM lifecycle routes through the Carrier Control Plane;
- billing mutations require a dedicated finance/provider-control permission.

A connected model receives only the ATLAS tools its actor permissions permit.

## 10. MCP Apps

The Telnyx server card currently advertises these experimental MCP Apps:

- `number-intelligence`
- `usage-cost-explorer`
- `voice-monitor`

Their session sequence is:

1. POST JSON-RPC `initialize` to `https://api.telnyx.com/v2/mcp/apps/{slug}/mcp`.
2. Capture the returned `mcp-session-id`.
3. Send the same session header on subsequent requests.
4. POST `notifications/initialized`.
5. Use `tools/list`, `resources/list`, and `resources/read`.
6. Use `tools/call` only through ATLAS authorization.

`ui://` HTML is external provider content. ATLAS MUST NOT grant it same-origin access to ATLAS secrets, cookies, local storage, privileged APIs, or unsanitized application state.

If ATLAS renders provider MCP App HTML, it must use a restricted sandbox boundary or reconstruct the provider data in native ATLAS UI components. Native ATLAS presentation is preferred for production workflows because it preserves ATLAS identity, accessibility, telemetry, and policy controls.

The apps are marked experimental by Telnyx and therefore cannot become production-critical dependencies without an explicit stability review.

## 11. Secret model

Telnyx API credentials remain server-side only.

Rules:

- no Telnyx API key in browser JavaScript;
- no Telnyx API key committed to GitHub;
- no Telnyx API key in audit payloads;
- no Telnyx API key returned by readiness endpoints;
- no raw authorization header persisted in logs;
- tenant-specific provider credentials must resolve through the existing ATLAS secret mechanism;
- secret lookup must occur after organization authorization, never before;
- provider credentials must not be reused across organizations unless the configured ATLAS ownership model explicitly proves the shared provider account relationship.

## 12. Carrier and number truth model

The existing `docs/telecom/atlas-carrier-control-plane.md` truth model remains authoritative.

Telnyx search or lookup results do not prove ownership.

A number may only advance through ATLAS lifecycle states when authenticated provider evidence exists for the relevant transition:

`discovered -> reserved -> ordered -> allocated -> verified -> active`

Similarly, an eSIM must follow the existing ATLAS eSIM truth model and cannot be represented as network-verified solely because an activation artifact was returned.

Every material transition records provider resource ID, provider request/order ID where applicable, observed time, verification method, and evidence digest.

## 13. Voice path

Existing Telnyx voice origination remains in service while the shared adapter is introduced.

The current safety properties remain mandatory:

- authenticated ATLAS user;
- active organization;
- explicit telephony permission;
- E.164 validation;
- purpose and consent reference;
- fresh provider readiness;
- persisted call session before provider origination;
- provider evidence captured without secret leakage;
- verified Telnyx webhook signature;
- replay/timestamp tolerance;
- tenant-scoped event processing.

The MCP integration must not bypass any of these gates.

## 14. Messaging, networking, wireless, and AI capability expansion

Capabilities are enabled incrementally and independently.

Candidate capability families:

- Voice / Call Control
- Messaging / SMS / MMS / RCS where authorized
- Number Search / Ordering / Lookup
- SIP / Connections / Trunking
- SIM / eSIM / Wireless / IoT
- Network services
- Usage / Cost / Billing reads
- Telnyx AI / inference surfaces

A capability remains `not_configured`, `blocked`, or `not_verified` until ATLAS has authenticated evidence that the tenant/provider account can actually use it.

Documentation or discovery alone never marks a capability `verified`.

## 15. Telnyx AI evaluation surfaces

The provider advertises machine-readable evaluation resources including capabilities, evaluation, benchmarks, economics, ownership, resilience, compliance, and provider-comparison documents.

ATLAS may ingest these as provider metadata for research and routing decisions, but:

- provider-authored benchmark claims are evidence from the provider, not independent ATLAS verification;
- comparison documents do not by themselves change routing priority;
- cost/routing decisions use actual ATLAS-observed usage and contractual pricing when available;
- stale provider metadata must be timestamped and refreshed before material decisions.

## 16. Failure and retry policy

Errors are normalized into ATLAS categories:

- configuration missing;
- authentication failed;
- permission denied;
- schema unavailable;
- schema changed;
- endpoint risk unknown;
- provider rate limited;
- provider timeout;
- provider unavailable;
- provider validation rejected;
- provider conflict/idempotency failure;
- provider operation failed.

Read-only calls may use bounded exponential backoff for transient 429/5xx/network failures.

Write calls do not retry automatically unless the operation is proven idempotent or uses a provider-supported idempotency key and ATLAS has persisted the corresponding operation identity.

A provider timeout after an ambiguous write outcome must enter `verification_required`, not `failed`, until ATLAS reconciles provider state.

## 17. Audit and evidence

Every material Telnyx action records:

- tenant and organization;
- ATLAS actor/user/agent;
- ATLAS permission checked;
- ATLAS operation name;
- Telnyx endpoint/tool name;
- risk classification;
- schema digest;
- provider request/correlation ID where available;
- provider resource ID where applicable;
- outcome;
- timestamps;
- redacted evidence digest.

Secrets, bearer tokens, activation codes, full recording content, and other sensitive provisioning material are excluded or redacted.

## 18. Testing strategy

### Unit tests

- endpoint discovery normalization;
- unknown endpoints fail closed;
- schema-before-invoke requirement;
- read/write/destructive classification;
- permission mapping;
- session ID propagation for MCP Apps;
- Bearer header redaction;
- retry rules;
- idempotency handling;
- evidence normalization.

### Integration tests

With safe provider access when available:

- authenticate remote Telnyx MCP;
- call `list_api_endpoints` read-only;
- fetch an endpoint schema;
- execute a known safe read-only endpoint;
- initialize each available MCP App;
- verify `mcp-session-id` reuse;
- list tools/resources;
- read `ui://` HTML as untrusted provider content;
- verify no write operation executes without ATLAS permission and policy.

### Existing regression tests

The current Telnyx voice readiness, call origination, webhook verification, RLS, RBAC, and carrier truth tests must remain green.

## 19. Production gates

Telnyx MCP integration is not considered production-verified until all applicable gates pass:

1. canonical server card is reachable and parsed;
2. production Telnyx credential exists in server-side ATLAS secret storage;
3. authenticated MCP initialization succeeds;
4. `list_api_endpoints` succeeds;
5. endpoint schema retrieval succeeds;
6. at least one safe read-only endpoint is invoked successfully;
7. ATLAS permission denial tests pass;
8. secret/redaction tests pass;
9. existing Telnyx voice tests remain green;
10. webhook verification remains green;
11. tenant-isolation tests pass;
12. CI/CodeQL/build gates pass;
13. deployed exact commit SHA is verified;
14. ATLAS production P0 route verification passes.

Capabilities with additional regulatory or contractual requirements remain blocked independently even if the base MCP transport is healthy.

## 20. Rollout phases

### Phase 1 — Discovery and safe reads

Implement authenticated MCP client, endpoint discovery, schema retrieval, risk classification, and safe read-only invocation.

### Phase 2 — Operator observability

Integrate Number Intelligence, Usage & Cost Explorer, and Voice Monitor as read-first ATLAS capabilities. Prefer native ATLAS views; treat remote MCP App UI as untrusted experimental content.

### Phase 3 — Curated write operations

Map selected Telnyx writes into existing ATLAS domain operations with explicit permissions, idempotency, evidence, and approvals.

### Phase 4 — Wireless and carrier lifecycle

Complete Telnyx number/eSIM functions required by the provider-neutral Carrier Control Plane. Do not represent ATLAS as a carrier or number owner without authenticated provider/legal evidence.

### Phase 5 — Routing and resilience

Use Telnyx as one eligible provider in ATLAS policy routing alongside future carrier adapters. Health, jurisdiction, capability, cost, latency, and compliance may influence routing only from verified data.

## 21. Non-goals

This design does not:

- replace ATLAS governance with Telnyx MCP annotations;
- expose Telnyx generic destructive invocation directly to users or agents;
- make Telnyx the permanent exclusive ATLAS carrier;
- claim ownership of Telnyx numbers, SIMs, eSIMs, spectrum, network infrastructure, or carrier authorizations;
- mark experimental MCP Apps as production dependencies;
- move provider credentials into frontend code;
- bypass existing ATLAS telephony evidence and consent controls;
- treat provider marketing/benchmark data as independent verification.

## 22. Acceptance criteria

The implementation is successful when:

- ATLAS can connect to Telnyx MCP server-side using streamable HTTP and a tenant-authorized credential;
- ATLAS follows `list_api_endpoints -> get_api_endpoint_schema -> invoke_api_endpoint` for generic remote endpoint usage;
- unknown or unclassified write risk fails closed;
- safe reads work through governed ATLAS tools;
- destructive or financially material operations cannot execute without explicit ATLAS authorization;
- existing Telnyx voice functionality continues to pass its tests;
- no provider secret reaches browser code or audit output;
- MCP Apps cannot access privileged ATLAS origin state;
- all provider state shown in ATLAS is backed by authenticated evidence;
- Telnyx remains replaceable behind provider-neutral ATLAS interfaces.

## 23. Source references

Canonical Telnyx sources used by this design:

- `https://telnyx.com/.well-known/mcp/server-card.json`
- `https://telnyx.com/.well-known/mcp.json`
- `https://api.telnyx.com/v2/mcp`
- `https://api.telnyx.com/v2/mcp/apps`
- `https://telnyx.com/openapi.json`
- `https://telnyx.com/ai/capabilities.json`

ATLAS repository sources:

- `supabase/functions/_shared/telephony-telnyx.ts`
- `supabase/functions/_shared/telephony-webhook.ts`
- `supabase/functions/atlas-communication-telephony/index.ts`
- `supabase/functions/atlas-communication-telephony-webhook/index.ts`
- `docs/telecom/atlas-carrier-control-plane.md`
- `packages/atlas-mcp`
- `docs/superpowers/specs/2026-09-05-atlas-sovereign-ai-orchestrator-design.md`

## 24. Design decision summary

ATLAS will use Telnyx MCP as a governed discovery and capability channel, not as an unrestricted remote execution proxy. Existing direct Telnyx REST paths remain where they are already production-oriented and tested. New provider capabilities are added through a Telnyx adapter behind ATLAS-owned domain control planes. Every capability remains fail-closed until authenticated provider evidence, ATLAS permission, tenant scope, and applicable production gates are satisfied.
