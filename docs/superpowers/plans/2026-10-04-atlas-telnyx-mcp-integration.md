# ATLAS Telnyx MCP Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-verifiable, read-first Telnyx MCP integration to ATLAS that preserves the existing direct Telnyx voice path, keeps Telnyx behind ATLAS governance, and fails closed before any destructive provider endpoint can be invoked.

**Architecture:** Create a provider-specific Telnyx integration boundary under `packages/integrations/src/telnyx`, wire only curated read tools through `packages/atlas-mcp`, and inject credentials through a scope-bound server-side resolver. The first production slice supports canonical server-card metadata, MCP endpoint discovery/schema inspection, MCP Apps catalog discovery, and public capability metadata; it does not expose Telnyx's generic `invoke_api_endpoint` or migrate the proven call-origination/webhook path.

**Tech Stack:** TypeScript 5.7, Node fetch/AbortSignal, JSON-RPC 2.0 over MCP streamable HTTP, Vitest 5, existing ATLAS MCP/governance/orchestrator packages, existing GitHub Actions and production verification scripts.

**Spec:** `docs/superpowers/specs/2026-10-04-atlas-telnyx-mcp-integration-design.md`

## Global Constraints

- Canonical Telnyx MCP server card: `https://telnyx.com/.well-known/mcp/server-card.json`.
- Telnyx MCP endpoint: `https://api.telnyx.com/v2/mcp` using streamable HTTP.
- Telnyx auth is `Authorization: Bearer <TELNYX_API_KEY>`; credentials remain server-side and must never be logged or returned.
- Tool sequence is `list_api_endpoints -> get_api_endpoint_schema -> invoke_api_endpoint`; this plan implements only the first two and intentionally does not expose generic invocation.
- `invoke_api_endpoint` remains classified as destructive-capable/non-idempotent/open-world until a later capability-specific plan explicitly authorizes an endpoint.
- Existing direct REST call origination and Ed25519 webhook verification remain authoritative and must not be migrated in this slice.
- Tenant/organization scope must be checked before resolving Telnyx credentials.
- MCP Apps are experimental; this slice lists metadata only and does not render provider `ui://` HTML or call app write tools.
- Unknown endpoint risk classification fails closed.
- No UI may claim Telnyx is connected/verified/live without authenticated runtime evidence.

## Review Focus

- MCP responses returned as `text/event-stream` instead of plain JSON must parse deterministically or fail with a redacted protocol error.
- Missing/incorrect `mcp-session-id` during an initialized session must not be silently ignored.
- A caller with the wrong tenant/organization scope must never receive or use another scope's Telnyx API key.
- A malformed endpoint name or schema payload must remain `unknown` and non-invokable.
- Telnyx 401/403/429/5xx/network failures must surface normalized evidence without leaking bearer tokens or raw sensitive provider payloads.

---

### Task 1: Create the Telnyx integration boundary and immutable provider constants

**Files:**
- Create: `packages/integrations/src/telnyx/types.ts`
- Create: `packages/integrations/src/telnyx/constants.ts`
- Create: `packages/integrations/src/telnyx/index.ts`
- Create: `packages/integrations/src/index.ts`
- Test: `tests/unit/telnyx-integration-contract.test.ts`

**Interfaces:**
- Consumes: ATLAS `TenantScope` from `packages/core/src`.
- Produces: `TELNYX_MCP_SERVER_CARD_URL`, `TELNYX_MCP_URL`, `TELNYX_MCP_APPS_URL`, `TELNYX_AI_CAPABILITIES_URL`, `TelnyxCredentialResolver`, `TelnyxMcpEvidence`, `TelnyxMcpAppDescriptor`, `TelnyxEndpointDescriptor`, `TelnyxProviderError`.

- [ ] **Step 1: Write the failing contract test**

Assert that exported URLs exactly match the approved canonical Telnyx URLs, that `TelnyxEndpointDescriptor.risk` supports `read | write | destructive | unknown`, and that the credential resolver signature is scope-aware.

- [ ] **Step 2: Run the test and verify failure**

Run: `npx vitest run tests/unit/telnyx-integration-contract.test.ts`

Expected: FAIL because the integration exports do not exist.

- [ ] **Step 3: Implement the minimal types/constants/exports**

Use this resolver contract:

```ts
export type TelnyxCredentialResolver = (scope: TenantScope) => Promise<string | null>;
```

`TelnyxProviderError` must carry a stable `code`, optional upstream status, and optional request/session evidence, but never the API key or Authorization header.

- [ ] **Step 4: Run the test and verify pass**

Run: `npx vitest run tests/unit/telnyx-integration-contract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/integrations/src tests/unit/telnyx-integration-contract.test.ts
git commit -m "feat: add Telnyx integration contract"
```

### Task 2: Implement a safe streamable-HTTP MCP transport

**Files:**
- Create: `packages/integrations/src/telnyx/mcpTransport.ts`
- Test: `tests/unit/telnyx-mcp-transport.test.ts`

**Interfaces:**
- Consumes: `TelnyxProviderError` and Telnyx MCP constants from Task 1.
- Produces: `TelnyxMcpTransport`, `TelnyxJsonRpcRequest`, `TelnyxJsonRpcResponse`, `parseMcpResponseBody()`.

- [ ] **Step 1: Write failing transport tests**

Cover: JSON response parsing; SSE `data:` frame parsing; initialize response with `mcp-session-id`; subsequent request reuses the session header; 401 normalization; 429 normalization; timeout/network normalization; error text must not contain the supplied bearer token.

- [ ] **Step 2: Run the test and verify failure**

Run: `npx vitest run tests/unit/telnyx-mcp-transport.test.ts`

Expected: FAIL because the transport does not exist.

- [ ] **Step 3: Implement the transport**

Constructor signature:

```ts
new TelnyxMcpTransport(options: {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  endpoint?: string;
})
```

Implement `initialize()`, `notifyInitialized()`, and `request(method: string, params?: unknown)`. Send `Accept: application/json, text/event-stream` and `Content-Type: application/json`. Retain and reuse `mcp-session-id` when the server supplies it. Default timeout: 15 seconds. No automatic write retry logic is introduced.

- [ ] **Step 4: Run the test and verify pass**

Run: `npx vitest run tests/unit/telnyx-mcp-transport.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/integrations/src/telnyx/mcpTransport.ts tests/unit/telnyx-mcp-transport.test.ts
git commit -m "feat: add safe Telnyx MCP transport"
```

### Task 3: Implement canonical Telnyx discovery and schema inspection

**Files:**
- Create: `packages/integrations/src/telnyx/discovery.ts`
- Create: `packages/integrations/src/telnyx/endpointPolicy.ts`
- Modify: `packages/integrations/src/telnyx/index.ts`
- Test: `tests/unit/telnyx-mcp-discovery.test.ts`
- Test: `tests/unit/telnyx-endpoint-policy.test.ts`

**Interfaces:**
- Consumes: `TelnyxMcpTransport` from Task 2.
- Produces: `listTelnyxApiEndpoints(transport, searchQuery?)`, `getTelnyxApiEndpointSchema(transport, endpoint)`, `describeTelnyxEndpoint(endpoint, schema)`, `assertTelnyxInvocationAllowed(descriptor)`.

- [ ] **Step 1: Write failing discovery tests**

Assert the client calls remote MCP tool `list_api_endpoints` with optional `search_query`, then `get_api_endpoint_schema` with the exact selected endpoint. Reject blank endpoint names and malformed structured results.

- [ ] **Step 2: Write failing policy tests**

Assert unknown schemas produce `risk: 'unknown'`; `assertTelnyxInvocationAllowed()` rejects `unknown`, `write`, and `destructive`; no discovered endpoint becomes invokable because its name merely contains `get`, `list`, `read`, or `status`.

- [ ] **Step 3: Run both tests and verify failure**

Run: `npx vitest run tests/unit/telnyx-mcp-discovery.test.ts tests/unit/telnyx-endpoint-policy.test.ts`

Expected: FAIL because discovery/policy modules do not exist.

- [ ] **Step 4: Implement discovery and fail-closed classification**

`assertTelnyxInvocationAllowed()` remains intentionally unusable for provider writes in this slice: only descriptors explicitly classified by a future capability allowlist may pass. Do not implement heuristic write enabling.

- [ ] **Step 5: Run both tests and verify pass**

Run: `npx vitest run tests/unit/telnyx-mcp-discovery.test.ts tests/unit/telnyx-endpoint-policy.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/integrations/src/telnyx tests/unit/telnyx-mcp-discovery.test.ts tests/unit/telnyx-endpoint-policy.test.ts
git commit -m "feat: add governed Telnyx endpoint discovery"
```

### Task 4: Add read-only MCP Apps and capability metadata discovery

**Files:**
- Create: `packages/integrations/src/telnyx/apps.ts`
- Create: `packages/integrations/src/telnyx/capabilities.ts`
- Modify: `packages/integrations/src/telnyx/index.ts`
- Test: `tests/unit/telnyx-mcp-apps.test.ts`

**Interfaces:**
- Consumes: fetch and constants from Task 1; transport primitives from Task 2.
- Produces: `listTelnyxMcpApps()`, `readTelnyxCapabilities()`, and normalized app descriptors for `number-intelligence`, `usage-cost-explorer`, and `voice-monitor` when advertised by the provider.

- [ ] **Step 1: Write failing tests**

Cover a valid app catalog, an unknown experimental app slug retained as metadata, malformed catalog rejection, public capability JSON parsing, and provider 5xx normalization. Assert no app HTML/resource is fetched and no app `tools/call` occurs.

- [ ] **Step 2: Run the test and verify failure**

Run: `npx vitest run tests/unit/telnyx-mcp-apps.test.ts`

Expected: FAIL because app/capability discovery does not exist.

- [ ] **Step 3: Implement read-only metadata discovery**

Do not render `ui://` resources and do not create any browser-facing passthrough of provider HTML.

- [ ] **Step 4: Run the test and verify pass**

Run: `npx vitest run tests/unit/telnyx-mcp-apps.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/integrations/src/telnyx tests/unit/telnyx-mcp-apps.test.ts
git commit -m "feat: add Telnyx MCP app discovery"
```

### Task 5: Add least-privilege ATLAS governance for Telnyx read tools

**Files:**
- Modify: `packages/governance/src/permissions.ts`
- Modify: `packages/atlas-mcp/src/toolIds.ts`
- Modify: `packages/atlas-mcp/src/protocol.ts`
- Modify: `packages/agent-registry/src/defaultAgents.ts`
- Modify: `apps/atlas-orchestrator/src/runtime/auth.ts`
- Test: `tests/unit/orchestrator-mcp.test.ts`
- Test: `tests/unit/orchestrator-agent-registry.test.ts`
- Test: `tests/integration/orchestrator-runtime.test.ts`

**Interfaces:**
- Consumes: existing ATLAS `authorize()`/actor model.
- Produces: permission `ai.provider.read` and read-only tools `atlas.telnyx.capabilities.read`, `atlas.telnyx.endpoint.list`, `atlas.telnyx.endpoint.schema.read`, `atlas.telnyx.apps.list`.

- [ ] **Step 1: Extend tests first**

Assert actors without `ai.provider.read` cannot see the four Telnyx tools. Assert read-oriented ATLAS actors that are intentionally granted `ai.provider.read` can see them but still cannot see `atlas.code.propose` or `atlas.deploy.request`. Assert no `atlas.telnyx.endpoint.invoke` tool exists.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npx vitest run tests/unit/orchestrator-mcp.test.ts tests/unit/orchestrator-agent-registry.test.ts tests/integration/orchestrator-runtime.test.ts`

Expected: FAIL because the permission/tools are absent.

- [ ] **Step 3: Add permission and tool metadata**

Map all four Telnyx tools to `ai.provider.read`. Add exact schemas: `endpoint.list` accepts optional `search_query`; `endpoint.schema.read` requires `endpoint`; capabilities/apps take an empty object.

- [ ] **Step 4: Grant read access only to intended read-oriented actors**

Add `ai.provider.read` to `readOnlyActor`, `atlas-gemini-analyst`, and `atlas-reviewer`. Extend their allowed read tool set. Do not grant it to release/deployment-only actors unless their role explicitly requires provider inspection.

- [ ] **Step 5: Run focused tests and verify pass**

Run: `npx vitest run tests/unit/orchestrator-mcp.test.ts tests/unit/orchestrator-agent-registry.test.ts tests/integration/orchestrator-runtime.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/governance/src/permissions.ts packages/atlas-mcp/src packages/agent-registry/src/defaultAgents.ts apps/atlas-orchestrator/src/runtime/auth.ts tests/unit/orchestrator-mcp.test.ts tests/unit/orchestrator-agent-registry.test.ts tests/integration/orchestrator-runtime.test.ts
git commit -m "feat: govern Telnyx read tools"
```

### Task 6: Wire Telnyx read operations into the ATLAS MCP executor with scope-bound credentials

**Files:**
- Create: `apps/atlas-orchestrator/src/integrations/telnyx.ts`
- Modify: `packages/atlas-mcp/src/toolExecutor.ts`
- Modify: `apps/atlas-orchestrator/src/runtime/container.ts`
- Modify: `apps/atlas-orchestrator/src/http.ts`
- Test: `tests/unit/atlas-telnyx-governance.test.ts`
- Test: `tests/integration/telnyx-mcp-readonly.test.ts`

**Interfaces:**
- Consumes: Task 3/4 Telnyx functions and Task 5 tool IDs.
- Produces: `createScopeBoundTelnyxCredentialResolver(configuredScope, env)` and `createTelnyxMcpOperations({ resolveApiKey, fetchImpl? })`.

- [ ] **Step 1: Write failing governance tests**

Assert the resolver returns the server-side key only for the exact configured `tenantId` and `organizationId`; returns/throws fail-closed for scope mismatch; never includes the key in error strings. Use `ATLAS_TELNYX_API_KEY` as the server-only environment variable for the current one-scope orchestrator deployment.

- [ ] **Step 2: Write failing executor integration tests**

With a mocked Telnyx MCP upstream, execute each of the four curated tools through `ToolExecutor` and assert the actor permission gate occurs before provider access. Assert a denied actor causes zero provider fetches.

- [ ] **Step 3: Run tests and verify failure**

Run: `npx vitest run tests/unit/atlas-telnyx-governance.test.ts tests/integration/telnyx-mcp-readonly.test.ts`

Expected: FAIL because runtime Telnyx operations are not wired.

- [ ] **Step 4: Implement runtime wiring**

Extend `AtlasMcpOperations` with four explicit Telnyx read operations. Do not add a generic provider invoke operation. Construct Telnyx operations in `http.ts` only when `ATLAS_TELNYX_API_KEY` is present; otherwise tools fail with stable `telnyx_not_configured` evidence instead of pretending readiness.

- [ ] **Step 5: Run tests and verify pass**

Run: `npx vitest run tests/unit/atlas-telnyx-governance.test.ts tests/integration/telnyx-mcp-readonly.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/atlas-orchestrator/src/integrations/telnyx.ts apps/atlas-orchestrator/src/runtime/container.ts apps/atlas-orchestrator/src/http.ts packages/atlas-mcp/src/toolExecutor.ts tests/unit/atlas-telnyx-governance.test.ts tests/integration/telnyx-mcp-readonly.test.ts
git commit -m "feat: wire governed Telnyx MCP reads"
```

### Task 7: Protect the existing Telnyx voice path with regression tests

**Files:**
- Modify: `tests/unit/atlas-telephony-telnyx.test.ts`
- Modify: `tests/unit/atlas-telephony-webhook.test.ts`
- Test: existing `supabase/functions/_shared/telephony-telnyx.ts`
- Test: existing `supabase/functions/_shared/telephony-webhook.ts`

**Interfaces:**
- Consumes: existing voice adapter and webhook verifier.
- Produces: regression evidence only; no production voice-path rewrite.

- [ ] **Step 1: Add regression assertions before any refactor**

Assert call-readiness auth remains Bearer server-side, E.164 validation remains enforced, webhook Ed25519 verification still rejects stale timestamps/signature mismatch, and no new MCP module is imported into the direct voice/webhook path.

- [ ] **Step 2: Run existing Telnyx voice tests**

Run: `npx vitest run tests/unit/atlas-telephony-telnyx.test.ts tests/unit/atlas-telephony-webhook.test.ts`

Expected: PASS. If this step fails before any voice code change, diagnose the existing regression before proceeding.

- [ ] **Step 3: Commit test hardening if changed**

```bash
git add tests/unit/atlas-telephony-telnyx.test.ts tests/unit/atlas-telephony-webhook.test.ts
git commit -m "test: protect Telnyx voice regression boundary"
```

### Task 8: Add production E2E verification without exposing Telnyx credentials

**Files:**
- Create: `scripts/verify-telnyx-mcp-production.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/global-production-verify.yml` if this workflow is present on the execution branch
- Test: `tests/integration/telnyx-production-verifier.test.ts`

**Interfaces:**
- Consumes: deployed ATLAS `/mcp` endpoint and existing ATLAS MCP bearer token; Telnyx API key remains only on the server.
- Produces: `npm run verify:telnyx:mcp:production`.

- [ ] **Step 1: Write verifier tests first**

Assert the verifier calls ATLAS MCP `tools/list`, verifies the four curated Telnyx tools are present for an authorized read actor, calls `atlas.telnyx.endpoint.list` with a safe search query such as `voice`, and requires structured provider evidence. Assert 401/403/provider-unconfigured/429/5xx are failures and that output redacts authorization values.

- [ ] **Step 2: Run verifier test and verify failure**

Run: `npx vitest run tests/integration/telnyx-production-verifier.test.ts`

Expected: FAIL because the verifier does not exist.

- [ ] **Step 3: Implement the verifier and package script**

Add `verify:telnyx:mcp:production` to root scripts. The verifier must require HTTPS for the public orchestrator URL, use an existing ATLAS MCP read token, and never require the Telnyx key client-side.

- [ ] **Step 4: Wire the global production workflow as P0 only when required secrets are configured**

If the repository workflow already has a documented secret-presence gate, reuse it. Missing Telnyx production configuration must report `NOT_CONFIGURED/BLOCKED`, not success. Once Telnyx is declared production-enabled, the check becomes fail-closed.

- [ ] **Step 5: Run repository verification**

Run:

```bash
npm run test:unit
npm run test:integration
npm run verify:cloudflare
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-telnyx-mcp-production.mjs package.json .github/workflows/global-production-verify.yml tests/integration/telnyx-production-verifier.test.ts
git commit -m "test: verify Telnyx MCP production path"
```

### Task 9: PR, CI, deployment, and exact production evidence

**Files:**
- No new product files unless CI/review finds a defect.
- Evidence sources: GitHub PR checks, deployment SHA, production verifier output.

**Interfaces:**
- Consumes: completed Tasks 1-8.
- Produces: merged PR, successful CI, deployed exact SHA, and E2E verification evidence.

- [ ] **Step 1: Run final branch checks**

Run:

```bash
npm run test:unit
npm run test:integration
npm run verify:cloudflare
```

Expected: PASS with no skipped Telnyx unit/integration tests.

- [ ] **Step 2: Open a PR from the implementation branch to `main`**

PR body must reference the approved design and this plan, state that generic Telnyx invocation remains disabled, and list the exact production-readiness gate.

- [ ] **Step 3: Wait for and inspect CI evidence**

Do not merge on a red/cancelled/pending required check. Repair real failures and rerun the failed job/workflow rather than marking them informational.

- [ ] **Step 4: Merge only after required checks are green**

Use the repository's permitted merge method and capture the resulting merge SHA.

- [ ] **Step 5: Verify deployment of the exact merge SHA**

Require the existing deployment manifest/exact-SHA mechanism to prove production is running the merged commit.

- [ ] **Step 6: Run production Telnyx MCP verification**

Run `npm run verify:telnyx:mcp:production` against the public ATLAS orchestrator endpoint. Success requires authenticated ATLAS MCP access plus a successful Telnyx endpoint discovery result. A missing provider credential, 401/403, timeout, malformed MCP response, or stale/wrong deployment SHA is failure.

- [ ] **Step 7: Record final status truthfully**

Only mark this slice `VERIFIED` after exact-SHA deployment and E2E discovery both pass. If authenticated Telnyx configuration is absent, status remains `BLOCKED/NOT_CONFIGURED`; do not claim live provider integration.

## Deferred capability-specific plans

This plan deliberately does not introduce a generic Telnyx write path. After this read-first slice is verified, separate reviewed plans are required for:

1. Number search/reservation/order/allocation evidence through ATLAS Carrier Control Plane.
2. SIM/eSIM inventory/order/activation/network verification.
3. Messaging send/receive and delivery evidence.
4. MCP App `resources/read` rendering or native ATLAS equivalents.
5. Any Telnyx billing/control mutation.
6. Any migration of existing direct voice REST operations to a shared provider adapter.

Each later plan must start from authenticated endpoint discovery/schema evidence and preserve ATLAS lifecycle truth, idempotency, RBAC, audit, and human approval for destructive or financially material operations.
