# Telnyx Slot Reuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate ATLAS Telnyx telephony by reusing two disabled Supabase Edge Function slots, preserving the hardened canonical Telnyx implementation and fail-closed security.

**Architecture:** Keep canonical Telnyx logic under `supabase/functions/atlas-communication-telephony*` and deploy that exact source into two existing disabled function slots. Route the frontend to the reused outbound/readiness slug and configure Telnyx secrets + webhook against the reused webhook slug.

**Tech Stack:** TypeScript, React/Vite, Vitest, Supabase Edge Functions, Supabase Vault/RPC, Telnyx Voice API, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-04-telnyx-slot-reuse-design.md`

## Global Constraints

- Reuse only `atlas-cloudflare-seed-build-once` and `atlas-cloudflare-main-build-once`.
- Do not weaken JWT, RBAC, tenant isolation, audit logging, or Ed25519 webhook verification.
- Do not expose provider or service-role secrets in source, logs, PR text, or chat.
- Readiness remains fail-closed until provider API authentication, connection ID, from number, HTTPS webhook URL, and Telnyx public key are all valid.
- No new Supabase Edge Function slots or paid capacity are required.

## Review Focus

- Frontend must never call the undeployable canonical runtime slug after this change.
- Reused outbound runtime must still report service identity `atlas-communication-telephony` and preserve all current provider gates.
- Webhook runtime must remain publicly reachable only because its body verifies Telnyx Ed25519 signatures.
- Runtime deployment must include every `_shared` helper imported by the hardened canonical source.
- E2E success requires real Telnyx provider acceptance plus signed lifecycle webhook evidence, not merely deployment success.

---

### Task 1: Pin frontend routing to the reused outbound slot

**Files:**
- Create: `tests/unit/telephony-slot-routing.test.ts`
- Modify: `apps/web/src/lib/telephonyApi.ts`

**Interfaces:**
- Produces: frontend readiness and call requests routed to `/functions/v1/atlas-cloudflare-seed-build-once`.
- Consumes: existing `authorizedAtlasFetch()` and organization scoping.

- [ ] **Step 1: Write the failing test**

Create a source-contract Vitest test that reads `apps/web/src/lib/telephonyApi.ts` and asserts both readiness and call routes contain `/functions/v1/atlas-cloudflare-seed-build-once`, and that the old `/functions/v1/atlas-communication-telephony?api=` route is absent.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/telephony-slot-routing.test.ts`
Expected: FAIL because the current source still references `atlas-communication-telephony`.

- [ ] **Step 3: Implement minimal route change**

Change only the two backend paths in `apps/web/src/lib/telephonyApi.ts` to the reused outbound slug, preserving methods, payloads, headers, response types, and service identity.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/telephony-slot-routing.test.ts`
Expected: PASS.

- [ ] **Step 5: Run repository verification**

Run: `npm run verify:all`
Expected: PASS.

### Task 2: Deploy hardened canonical Telnyx source into reused Supabase slots

**Files:**
- Runtime source: `supabase/functions/atlas-communication-telephony/index.ts`
- Runtime source: `supabase/functions/atlas-communication-telephony-webhook/index.ts`
- Shared dependencies: `supabase/functions/_shared/telephony-telnyx.ts`, `telephony-webhook.ts`, `telephony-call-state.ts`

**Interfaces:**
- Produces: `atlas-cloudflare-seed-build-once` as authenticated readiness/outbound runtime; `atlas-cloudflare-main-build-once` as signed Telnyx webhook runtime.
- Consumes: current production Supabase database schema, Vault RPCs, telephony tables, provider-state reconciliation RPC.

- [ ] **Step 1: Deploy outbound/readiness alias**

Deploy exact current canonical telephony source and required shared imports under function name `atlas-cloudflare-seed-build-once` with `verify_jwt=true`.

- [ ] **Step 2: Deploy webhook alias**

Deploy exact current canonical webhook source and required shared imports under function name `atlas-cloudflare-main-build-once` with `verify_jwt=false` because the body performs mandatory Ed25519 verification.

- [ ] **Step 3: Verify both functions are ACTIVE**

Use Supabase function listing and confirm both slugs are active with new versions.

### Task 3: Configure live Telnyx provider state without exposing secrets

**Files/Data:**
- Supabase Vault names `atlas_telephony:<org_id>:provider|api_key|connection_id|from_number|webhook_url|public_key`
- Telnyx Mission Control / API

**Interfaces:**
- Produces: complete provider configuration for one ATLAS organization.
- Consumes: verified Telnyx account, API key, Call Control connection, purchased/assigned E.164 number, Telnyx webhook public key.

- [ ] **Step 1: Resolve ATLAS organization ID**

Query active organization membership for the ATLAS owner account without exposing unrelated account data.

- [ ] **Step 2: Obtain/verify Telnyx runtime values**

Use authenticated Telnyx portal/API to verify or create the required API key, Call Control connection, from number, and webhook public key. Do not print secret values.

- [ ] **Step 3: Store configuration in Supabase Vault**

Write provider=`telnyx`, API key, connection ID, from number, webhook URL `https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-cloudflare-main-build-once`, and public key through the existing server-secret/Vault path.

### Task 4: Verify readiness, merge, deploy web, and prove E2E

**Files:**
- No additional source changes expected unless verification finds a defect.

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: merged frontend routing plus runtime/provider evidence.

- [ ] **Step 1: Open PR and require CI evidence**

Open PR from `codex/telnyx-slot-reuse` to `main`; wait for relevant checks and inspect failures.

- [ ] **Step 2: Merge only after green verification**

Merge after CI is green and no critical review issue remains.

- [ ] **Step 3: Verify Telnyx readiness**

Call the authenticated reused runtime readiness endpoint and require `verified: true`, complete credential booleans, and no blocker.

- [ ] **Step 4: Place one real outbound E2E call**

Originate one consented test call to an authorized destination. Require Telnyx acceptance plus signed webhook lifecycle evidence recorded in `atlas_call_events`/`atlas_call_sessions`.

- [ ] **Step 5: Verify production web routing**

Verify the production ATLAS frontend is serving the merged SHA and that telephony UI requests use the reused runtime.
