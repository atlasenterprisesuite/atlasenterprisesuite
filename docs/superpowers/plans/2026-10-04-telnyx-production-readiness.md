# Telnyx Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing ATLAS Telnyx voice adapter so production readiness includes webhook-verification configuration and provider lifecycle state cannot regress on duplicate or out-of-order events.

**Architecture:** Keep the existing provider-neutral ATLAS telephony boundary. Extend the Telnyx adapter’s local readiness contract, add a small shared lifecycle reconciliation unit, persist the provider state timestamp, and update the existing webhook handler and `/connect/calling` truth surfaces rather than creating parallel services.

**Tech Stack:** TypeScript, Deno/Supabase Edge Functions, PostgreSQL/Supabase migrations, React, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-04-telnyx-production-readiness-design.md`

## Global Constraints

- Telnyx remains an adapter, not the ATLAS telecom architecture.
- Provider secrets remain server-side and are never returned to the browser.
- Production calling remains fail-closed unless a live provider probe is verified.
- `public_key` is required because an originated call without authenticated lifecycle webhooks is not production-ready.
- Emergency calling, SMS/MMS, recording, inbound routing, eSIM and carrier ownership are not inferred by this slice.
- Provider event ID remains the deduplication key.
- Call state must not regress on duplicate, delayed, concurrent, or out-of-order provider events.

## Review Focus

- Malformed or non-32-byte Telnyx public signing key must fail local readiness rather than reach production calling.
- A readiness response must expose only boolean presence for secret-bearing fields, never their values.
- An older `call.answered` event arriving after `call.hangup` must remain durable evidence but must not regress the session from `completed`.
- Equal-timestamp events must resolve deterministically and must not allow a lower lifecycle state to replace a higher one.
- Provider capability metadata must not claim inbound/SMS/emergency readiness from an outbound connection probe.

---

### Task 1: Require webhook signing configuration in Telnyx readiness

**Files:**
- Modify: `supabase/functions/_shared/telephony-telnyx.ts`
- Modify: `supabase/functions/atlas-communication-telephony/index.ts`
- Modify: `tests/unit/atlas-telephony-telnyx.test.ts`
- Modify: `apps/web/src/lib/telephonyApi.ts`
- Modify: `apps/web/src/modules/connect/AtlasTelephonyPage.tsx`

**Interfaces:**
- Produces: `TelnyxVoiceConfig.publicKey: string`
- Produces: `validateTelnyxPublicKey(value: string): boolean`
- Produces readiness credentials with `public_key: boolean`
- Preserves: `probeTelnyxVoice(config, fetchImpl)` and existing readiness response shape otherwise.

- [ ] **Step 1: Write failing adapter tests**

Add assertions that `publicKey` is required, valid base64 decoding to exactly 32 bytes is accepted, malformed base64 is rejected, and a wrong-length decoded key is rejected.

- [ ] **Step 2: Run the focused test**

Run: `npx vitest run tests/unit/atlas-telephony-telnyx.test.ts`
Expected: FAIL because `publicKey` is not part of the current config/validation contract.

- [ ] **Step 3: Implement the minimal local validation**

In `telephony-telnyx.ts`, extend `TelnyxVoiceConfig` with `publicKey`, implement `validateTelnyxPublicKey(value: string): boolean`, and return `public_key_missing` or `public_key_invalid` from `validateTelnyxConfig` before any provider probe.

- [ ] **Step 4: Wire `public_key` into organization-scoped secret loading**

In `atlas-communication-telephony/index.ts`, load `atlas_telephony:${orgId}:public_key`, include only its boolean presence in `configured`, and include the key in server-side `TelnyxVoiceConfig` only when complete.

When persisting verified capabilities, set only `outbound: true` as evidenced; keep `inbound`, `sms`, `recording`, and `emergency_calling` false. Adapter-supported but unverified features must not be presented as production-ready capabilities.

- [ ] **Step 5: Update browser types and UI truth**

Add `public_key: boolean` to `TelephonyReadiness.credentials`. Replace the hard-coded `5` denominator with `Object.keys(readiness.credentials).length` so the UI reports `x/6` from the actual readiness contract.

Add “Signed provider webhook key configured” to the trust-boundary checklist without exposing a value.

- [ ] **Step 6: Run focused tests and type/build checks**

Run: `npx vitest run tests/unit/atlas-telephony-telnyx.test.ts`
Expected: PASS.

Run the repository’s existing TypeScript/build command from `package.json`/CI.
Expected: PASS.

- [ ] **Step 7: Commit**

Commit message: `fix(telephony): require Telnyx webhook key for readiness`

---

### Task 2: Make provider lifecycle reconciliation monotonic

**Files:**
- Create: `supabase/functions/_shared/telephony-call-state.ts`
- Create: `tests/unit/atlas-telephony-call-state.test.ts`
- Create: `supabase/migrations/20261004143000_atlas_telephony_provider_state_clock.sql`
- Modify: `supabase/functions/atlas-communication-telephony-webhook/index.ts`

**Interfaces:**
- Produces: `type AtlasCallState = 'draft' | 'queued' | 'dialing' | 'ringing' | 'connected' | 'completed' | 'failed' | 'canceled' | 'blocked'`
- Produces: `shouldApplyProviderState(input): boolean` where input contains `currentState`, `currentProviderStateAt`, `incomingState`, and `incomingOccurredAt`.
- Produces DB columns: `atlas_call_sessions.provider_state_at timestamptz` and `provider_state_event_id text`.

- [ ] **Step 1: Write failing reconciliation tests**

Cover: newer events advance state; older events do not; `completed` does not regress to `connected`; equal timestamp with a lower-ranked state is ignored; invalid/missing provider occurrence time cannot mutate authoritative state.

- [ ] **Step 2: Run the new test**

Run: `npx vitest run tests/unit/atlas-telephony-call-state.test.ts`
Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the pure reconciliation helper**

Use explicit lifecycle ranking for non-terminal provider states. Treat `completed`, `failed`, `canceled`, and `blocked` as terminal. Require a parseable `incomingOccurredAt`; when timestamps are equal, only equal-or-higher lifecycle rank may apply; a terminal state may not transition back to a non-terminal state.

- [ ] **Step 4: Add provider state clock columns**

Create an additive migration adding nullable `provider_state_at` and `provider_state_event_id` to `public.atlas_call_sessions`, plus an index on `(organization_id, provider_state_at desc)` if useful for reconciliation/inspection. Do not alter existing RLS grants.

- [ ] **Step 5: Apply reconciliation in the signed webhook handler**

Select the session’s current `state`, `provider_state_at`, and `provider_state_event_id`. Persist every valid, deduplicated provider event as evidence. Apply a session state patch only when `shouldApplyProviderState(...)` is true; update `provider_state_at` and `provider_state_event_id` with the accepted provider event.

If `occurred_at` is missing or invalid, persist the event but do not mutate authoritative call state.

- [ ] **Step 6: Acknowledge after durable acceptance and keep post-accept work bounded**

The event insert is the durable acceptance point. Avoid any external network call or media work before returning success. Keep reconciliation to the single ATLAS database update path; do not add provider calls to the webhook handler.

- [ ] **Step 7: Run lifecycle and webhook tests**

Run: `npx vitest run tests/unit/atlas-telephony-call-state.test.ts tests/unit/atlas-telephony-webhook.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

Commit message: `fix(telephony): prevent stale Telnyx state regression`

---

### Task 3: Regression verification and production-readiness evidence

**Files:**
- Modify only if a failing verification exposes a real defect.
- Update: `docs/architecture/atlas-communication-telephony.md` only if implementation truth changed materially beyond the spec.

**Interfaces:**
- Consumes the completed Task 1 and Task 2 contracts.
- Produces CI/evidence only; no synthetic readiness claims.

- [ ] **Step 1: Run the complete telephony unit suite**

Run: `npx vitest run tests/unit/atlas-telephony-telnyx.test.ts tests/unit/atlas-telephony-webhook.test.ts tests/unit/atlas-telephony-call-state.test.ts`
Expected: PASS.

- [ ] **Step 2: Run repository validation used by CI**

Run the canonical lint/type/build commands from the repository workflows/package scripts.
Expected: PASS.

- [ ] **Step 3: Review diff for secret leakage and capability overclaiming**

Verify no API key/public key values can enter JSON responses, logs, UI source, tests using real credentials, or provider evidence.

Verify `emergency_calling`, SMS, recording, and inbound production readiness remain false/unclaimed.

- [ ] **Step 4: Open PR and run CI**

Create a PR from `feat/telnyx-production-readiness-20261004` to `main` with the exact test evidence and the explicit external gates still outstanding.

- [ ] **Step 5: Merge only when required checks pass**

Do not treat account approval, PR merge, or deploy success as Telnyx production verification.

- [ ] **Step 6: Configure external provider evidence when portal/runtime access is available**

Store the Telnyx API key, Voice API application/connection ID, authorized caller number, webhook URL, and public signing key in the existing organization-scoped server secret store. Do not copy secret values into GitHub.

- [ ] **Step 7: Run live readiness and one controlled non-emergency test call**

Require a verified readiness response, then confirm signed lifecycle events and monotonic ATLAS session reconciliation.

- [ ] **Step 8: Run ATLAS global production verification**

Verify the public root, health endpoint, authorized application routes, and existing P0 fail-closed deployment checks. Mark Telnyx voice production-ready only if these and the live provider test are green.
