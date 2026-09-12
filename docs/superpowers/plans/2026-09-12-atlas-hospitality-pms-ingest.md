# ATLAS Hospitality PMS Ingest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated, authenticated-by-provider PMS ingestion boundary that normalizes authorized OPERA Cloud events into ATLAS stays/room assignments with replay protection and idempotency, while representing Mews, Cloudbeds, Infor HMS, and future PMS connectors fail-closed until their official contracts are verified.

**Architecture:** `atlas-hospitality-pms-ingest` is a separate Edge Function from browser JWT APIs. It resolves a configured PMS instance server-side, verifies the vendor-specific webhook/auth contract before trusting the payload, writes the canonical integration-event ledger, normalizes events through a connector registry, and projects stays/room assignments. It never trusts org/property identifiers only because they appear in a webhook body and never issues a wallet key directly; it emits an eligibility outcome consumed by the Wallet Delivery plan.

**Tech Stack:** TypeScript 5.7, Vitest 3.2.6, Supabase Edge Functions/Deno, Supabase Postgres/service-role repository, official Oracle OHIP APIs/events, existing ATLAS Hospitality shared domain.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-hospitality-wallet-hotel-key-design.md`

**Depends on:** `docs/superpowers/plans/2026-09-12-atlas-hospitality-wallet-key-core.md`

## Global Constraints

- Use official PMS APIs/webhooks only; do not invent undocumented endpoints, signatures, or event fields.
- OPERA Cloud/OHIP is the first real connector target.
- Mews, Cloudbeds, Infor HMS, and generic PMS connectors remain `configured_unverified` until their documented auth/event contracts and authorized credentials are available.
- `atlas-hospitality-pms-ingest` does not use an ATLAS user JWT as vendor authentication.
- No shared universal webhook secret across properties; every PMS instance resolves its own server-side configuration.
- Provider instance identity may be carried in the webhook URL/query as a public routing identifier, but org/property scope is loaded from ATLAS persistence and never trusted from event body alone.
- Read the raw request body once, verify signature/token against that exact body, then parse/normalize it.
- Every accepted inbound event must hit `hospitality_integration_events` before projection; duplicate events must be no-ops.
- Raw vendor payloads are not stored in business tables.
- No wallet credential is issued in this plan; only stay/assignment projection plus eligibility/audit output is produced.

---

## File Structure

- `packages/hospitality/pms.ts` — normalized PMS connector types/events/readiness and projection input types.
- `supabase/functions/atlas-hospitality-pms-ingest/_shared/pms-registry.ts` — instance/config-to-connector selection.
- `supabase/functions/atlas-hospitality-pms-ingest/_shared/runtime-config.ts` — server-only per-instance config loading and type checking.
- `supabase/functions/atlas-hospitality-pms-ingest/_shared/process-event.ts` — idempotent event normalization/projection/eligibility orchestration.
- `supabase/functions/atlas-hospitality-pms-ingest/connectors/oracle-opera.ts` — OHIP connector.
- `supabase/functions/atlas-hospitality-pms-ingest/connectors/mews.ts` — fail-closed boundary until official contract verification.
- `supabase/functions/atlas-hospitality-pms-ingest/connectors/cloudbeds.ts` — fail-closed boundary until official contract verification.
- `supabase/functions/atlas-hospitality-pms-ingest/connectors/infor.ts` — fail-closed boundary until official contract verification.
- `supabase/functions/atlas-hospitality-pms-ingest/connectors/generic.ts` — certified connector boundary.
- `supabase/functions/atlas-hospitality-pms-ingest/index.ts` — thin HTTP ingress router.
- `supabase/functions/_shared/hospitality/repository.ts` — extend with PMS instance/stay/assignment/event projection writes.
- `docs/hospitality/providers/ORACLE_OPERA_OHIP.md` — exact official contract evidence used by code.
- `tests/unit/hospitality-pms-connectors.test.ts` — registry/readiness/normalization tests.
- `tests/integration/hospitality-pms-ingest-contract.test.ts` — ingress/auth/idempotency/static security contract.
- `tests/integration/hospitality-pms-projection.test.ts` — deterministic projection/lifecycle tests.

---

### Task 1: Define the normalized PMS connector contract and registry

**Files:**
- Create: `packages/hospitality/pms.ts`
- Create: `supabase/functions/atlas-hospitality-pms-ingest/_shared/pms-registry.ts`
- Create: `supabase/functions/atlas-hospitality-pms-ingest/_shared/runtime-config.ts`
- Create: `tests/unit/hospitality-pms-connectors.test.ts`

**Interfaces:**

```ts
export interface HospitalityPmsConnector {
  readonly providerType: HospitalityPmsProviderType;
  readonly capabilities: readonly HospitalityPmsCapability[];
  readiness(context: PmsProviderContext): Promise<PmsReadiness>;
  syncReservations?(context: PmsProviderContext, cursor?: string): Promise<PmsSyncResult>;
  getReservation?(context: PmsProviderContext, reservationId: string): Promise<NormalizedStay>;
  verifyRoomAssignment?(context: PmsProviderContext, reservationId: string): Promise<NormalizedRoomAssignment>;
  verifyWebhook?(context: PmsProviderContext, request: VerifiedWebhookInput): Promise<void>;
  normalizeWebhook?(context: PmsProviderContext, payload: unknown): Promise<NormalizedPmsEvent[]>;
}
```

Initial capabilities are exactly `reservation.read`, `reservation.events`, `guest.reference.read`, `checkin.read`, `checkout.read`, `room.assignment.read`, `room.change.events`, `property.read`.

- [ ] **Step 1: Write failing registry and type tests**

Test known provider types, unsupported type rejection, and fail-closed behavior when runtime config is missing.

```ts
expect(() => pmsConnectorFor(instanceWith('unknown'))).toThrow('unsupported_pms_provider_type');
expect((await pmsConnectorFor(operaInstance).readiness(context)).state).toBe('configured_unverified');
```

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/unit/hospitality-pms-connectors.test.ts
```

- [ ] **Step 3: Implement normalized event/stay/assignment types**

Use opaque guest references only. A normalized event contains:

```ts
export type NormalizedPmsEvent = {
  sourceEventId: string;
  sourceVersion: string;
  eventType: HospitalityIntegrationEventType;
  reservationId: string;
  guestReference: string | null;
  occurredAt: string;
  stay?: NormalizedStay;
  roomAssignment?: NormalizedRoomAssignment | null;
};
```

`NormalizedStay` must include external reservation ID, status, arrival/departure, checked-in/out timestamps. `NormalizedRoomAssignment` must include external PMS room ID plus validity start/expiry; no raw guest profile fields.

- [ ] **Step 4: Implement runtime config lookup**

Use `ATLAS_HOSPITALITY_PMS_CONFIG_JSON` keyed by PMS provider-instance UUID. Each entry must contain a matching `providerType`; mismatch throws `pms_configuration_mismatch`. Missing config returns a connector whose readiness is `configured_unverified` with blocker `pms_runtime_configuration_required`.

Do not log or return config objects.

- [ ] **Step 5: Implement registry selection**

Map exact provider types to connector factories. Unknown types throw; no fallback from one vendor to another.

- [ ] **Step 6: Run tests/typecheck and commit**

```bash
npx vitest run tests/unit/hospitality-pms-connectors.test.ts
npm run typecheck
git add packages/hospitality/pms.ts supabase/functions/atlas-hospitality-pms-ingest tests/unit/hospitality-pms-connectors.test.ts
git commit -m "feat(hospitality): add normalized PMS connector registry"
```

---

### Task 2: Implement the Oracle OPERA Cloud/OHIP connector from official contract evidence

**Files:**
- Create: `docs/hospitality/providers/ORACLE_OPERA_OHIP.md`
- Create: `supabase/functions/atlas-hospitality-pms-ingest/connectors/oracle-opera.ts`
- Modify: `tests/unit/hospitality-pms-connectors.test.ts`

**Interfaces:**
- `createOracleOperaConnector(config, fetchImpl)` implements `HospitalityPmsConnector`.
- Config is server-only and contains only values required by the exact authorized OHIP contract.

- [ ] **Step 1: Record the official contract before writing network code**

From Oracle's current official OHIP/Hospitality API documentation, record in `ORACLE_OPERA_OHIP.md`:

- official documentation URL(s) and access date;
- OAuth/application-key/enterprise/property headers actually required;
- the exact non-destructive property or reservation-read endpoint used for readiness;
- the exact event/webhook authentication mechanism used for the target OHIP event path;
- the exact reservation/check-in/checkout/room-assignment fields mapped to ATLAS;
- any event IDs/version/timestamps available for replay/idempotency.

If any of these are unavailable in official documentation or authorized property material, code must return `configured_unverified` with blocker `oracle_ohip_contract_required`; do not guess.

- [ ] **Step 2: Write deterministic failing tests from sanitized fixtures matching that documented contract**

Tests must cover: missing config, auth rejection (401/403), property mismatch, successful non-destructive readiness, check-in normalization, checkout normalization, room assignment/change normalization, malformed payload, and no guest PII leakage beyond opaque reference.

```ts
expect(events[0]).toMatchObject({
  eventType: 'stay.checkin_confirmed',
  reservationId: 'RES-100',
  sourceEventId: 'evt-100'
});
expect(JSON.stringify(events[0])).not.toMatch(/passport|driver.?license|date.?of.?birth/i);
```

- [ ] **Step 3: Run and confirm RED**

```bash
npx vitest run tests/unit/hospitality-pms-connectors.test.ts
```

- [ ] **Step 4: Implement readiness/auth and normalization exactly to the recorded contract**

Inject `fetchImpl`. Base URL must be normalized and constrained to the documented Oracle OHIP host family/environment from configuration; reject non-HTTPS endpoints. Never accept a webhook-body property ID as scope authority—compare it to the ATLAS-configured external property ID and reject mismatch.

- [ ] **Step 5: Re-run connector tests and commit**

```bash
npx vitest run tests/unit/hospitality-pms-connectors.test.ts
npm run typecheck
git add docs/hospitality/providers/ORACLE_OPERA_OHIP.md supabase/functions/atlas-hospitality-pms-ingest/connectors/oracle-opera.ts tests/unit/hospitality-pms-connectors.test.ts
git commit -m "feat(hospitality): add governed OPERA OHIP connector"
```

---

### Task 3: Add explicit fail-closed Mews, Cloudbeds, Infor, and generic PMS boundaries

**Files:**
- Create: `supabase/functions/atlas-hospitality-pms-ingest/connectors/mews.ts`
- Create: `supabase/functions/atlas-hospitality-pms-ingest/connectors/cloudbeds.ts`
- Create: `supabase/functions/atlas-hospitality-pms-ingest/connectors/infor.ts`
- Create: `supabase/functions/atlas-hospitality-pms-ingest/connectors/generic.ts`
- Modify: `supabase/functions/atlas-hospitality-pms-ingest/_shared/pms-registry.ts`
- Modify: `tests/unit/hospitality-pms-connectors.test.ts`

**Interfaces:**
- Each adapter implements the normalized connector interface.
- No undocumented network path is introduced.

- [ ] **Step 1: Write failing fail-closed tests**

For each provider, assert readiness without a verified contract is `configured_unverified`, capabilities contain only those proven by configured metadata, and webhook normalization throws `official_pms_contract_required` rather than accepting arbitrary JSON.

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/unit/hospitality-pms-connectors.test.ts
```

- [ ] **Step 3: Implement minimal adapters**

Each connector may expose a non-destructive readiness probe only when its runtime config explicitly declares a reviewed contract version and verified endpoint/auth mode. Otherwise return:

```ts
{
  state: 'configured_unverified',
  blocker: 'official_pms_contract_required',
  checkedAt: new Date().toISOString(),
  capabilities: []
}
```

No connector may share secrets with another property.

- [ ] **Step 4: Run tests and commit**

```bash
npx vitest run tests/unit/hospitality-pms-connectors.test.ts
npm run typecheck
git add supabase/functions/atlas-hospitality-pms-ingest/connectors supabase/functions/atlas-hospitality-pms-ingest/_shared/pms-registry.ts tests/unit/hospitality-pms-connectors.test.ts
git commit -m "feat(hospitality): add fail-closed PMS provider boundaries"
```

---

### Task 4: Build the dedicated PMS webhook ingress with provider auth, replay protection, and idempotency

**Files:**
- Create: `supabase/functions/atlas-hospitality-pms-ingest/index.ts`
- Create: `supabase/functions/atlas-hospitality-pms-ingest/_shared/process-event.ts`
- Modify: `supabase/functions/_shared/hospitality/repository.ts`
- Create: `tests/integration/hospitality-pms-ingest-contract.test.ts`

**Interfaces:**
- HTTP route accepts `POST` only plus health-safe `OPTIONS` only if an approved browser origin is ever required; normal PMS webhooks do not need browser CORS.
- Routing identifier: `provider_instance_id` query parameter.
- Provider instance is loaded server-side by ID; org/property/provider type come from that row.
- Connector verifies auth/signature before payload normalization or event processing.

- [ ] **Step 1: Write failing ingress/security contract tests**

Assert source contains: provider-instance lookup before event processing, raw-body capture, connector `verifyWebhook`, `insertIntegrationEventOnce`, correlation ID, no `resolveContext`/user JWT requirement, and no body-derived `.org_id`/`.property_id` trust.

```ts
expect(source).toContain('provider_instance_id');
expect(source).toContain('verifyWebhook');
expect(source).toContain('insertIntegrationEventOnce');
expect(source).not.toContain('resolveContext(req)');
expect(source).not.toMatch(/body\.(org_id|property_id)/);
```

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/integration/hospitality-pms-ingest-contract.test.ts
```

- [ ] **Step 3: Implement strict request sequence**

Order must be:

```text
validate method
→ parse provider_instance_id routing identifier
→ load PMS instance server-side
→ load matching runtime config
→ read raw body
→ verify vendor auth/signature against exact raw body
→ parse JSON
→ normalize vendor event(s)
→ derive idempotency key from resolved org/property/instance + source identity/version
→ insert ledger row once
→ process only when inserted=true
→ return accepted/duplicate status with correlation_id
```

Use `crypto.randomUUID()` for correlation IDs. Duplicate events return HTTP 202 with `{ ok: true, duplicate: true, correlation_id }`; they must not project stays or trigger eligibility again.

- [ ] **Step 4: Implement bounded failure state**

On normalized processing errors, update the ledger row to `failed`, increment `attempt_count`, set a safe `last_error_code`, and preserve correlation ID. Do not persist raw payload or signature headers.

- [ ] **Step 5: Run focused tests and commit**

```bash
npx vitest run tests/integration/hospitality-pms-ingest-contract.test.ts tests/unit/hospitality-pms-connectors.test.ts
npm run typecheck
git add supabase/functions/atlas-hospitality-pms-ingest supabase/functions/_shared/hospitality/repository.ts tests/integration/hospitality-pms-ingest-contract.test.ts
git commit -m "feat(hospitality): add authenticated PMS webhook ingress"
```

---

### Task 5: Project stays/room assignments and evaluate automatic-wallet eligibility without issuing a key

**Files:**
- Modify: `supabase/functions/atlas-hospitality-pms-ingest/_shared/process-event.ts`
- Modify: `supabase/functions/_shared/hospitality/repository.ts`
- Create: `tests/integration/hospitality-pms-projection.test.ts`
- Modify: `docs/hospitality/WALLET_HOTEL_KEY_READINESS.md`

**Interfaces:**
- `processNormalizedPmsEvent(scope, event)` upserts the stay and room assignment, then returns `{ eventId, duplicate, eligibility }`.
- Room-change supersedes the previous active assignment atomically before creating the new one.
- Checkout/cancellation marks stay/assignment terminal and returns an eligibility blocker; actual credential revocation is performed in Wallet Delivery plan.

- [ ] **Step 1: Write failing projection tests**

Use deterministic mocked repository calls to verify:

- check-in creates/updates one stay and one active room assignment;
- replay does not produce a second assignment;
- room change sets prior assignment `superseded_at` and creates exactly one replacement assignment;
- checkout marks the stay `checked_out` and assignment inactive;
- event property/reservation mismatch fails closed;
- eligibility only becomes true with ready PMS/provider/mapping/policy inputs.

- [ ] **Step 2: Run and confirm RED**

```bash
npx vitest run tests/integration/hospitality-pms-projection.test.ts
```

- [ ] **Step 3: Implement projection repository helpers**

Use database uniqueness on `(org_id, property_id, pms_provider_instance_id, external_reservation_id)` for stays and one active assignment per stay enforced by transaction-safe update/insert logic. Never duplicate guest PII.

- [ ] **Step 4: Evaluate but do not issue**

After projection, load the current automation policy, access provider readiness metadata, and verified room mapping; call `evaluateWalletEligibility`. Persist a safe audit record such as `hospitality.wallet.eligibility_evaluated` with policy version, source event ID, stay/assignment IDs, eligible boolean, and blocker. Do not call `issueCredential` in this plan.

- [ ] **Step 5: Run the complete PMS milestone gate**

```bash
npm run typecheck
npx vitest run tests/unit/hospitality-pms-connectors.test.ts tests/unit/hospitality-wallet-policy.test.ts
npx vitest run tests/integration/hospitality-pms-ingest-contract.test.ts tests/integration/hospitality-pms-projection.test.ts tests/integration/hospitality-wallet-repository-contract.test.ts
npm run test:unit
npm run test:integration
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Update readiness and commit**

Document OPERA's exact verified capabilities and blockers. Mews/Cloudbeds/Infor remain explicitly unverified unless their official contracts were separately supplied and tested. State that eligible check-in events are projected/audited but wallet issuance remains disabled until Wallet Delivery plan.

```bash
git add supabase/functions docs/hospitality/WALLET_HOTEL_KEY_READINESS.md tests
git commit -m "feat(hospitality): project PMS stays and wallet eligibility"
```
