# ATLAS Hospitality Multi-Provider Room Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current single-provider ATLAS Hospitality room-access foundation into a governed, auditable, multi-provider access layer for authorized Vingcard, dormakaba/Saflok, SALTO, and future certified hotel access systems.

**Architecture:** Keep `atlas-hospitality-access` as the single browser-facing backend boundary. Move authorization, provider-instance resolution, room mapping, provider adapters, persistence, and audit into focused server-side modules selected through a registry. Provider secrets remain server-side; browser clients receive only normalized states and external credential references.

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, Vitest 3, Supabase Auth/Postgres/RLS/Edge Functions, Deno, GitHub Actions, Cloudflare production deployment.

**Spec:** `docs/superpowers/specs/2026-09-11-atlas-hospitality-multi-provider-access-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Target integration branch: `feat/hospitality-room-access` until PR #75 is verified.
- All provider calls are server-side.
- No master key, raw RFID/NFC payload, encoder secret, cryptographic seed, private key, provider bearer token, or vendor credential is returned to the browser or committed to Git.
- Direct remote door opening is out of scope for this milestone.
- Provider state must be one of `not_configured`, `configured_unverified`, `ready`, `degraded`, `offline`, or `disabled`.
- A provider may become `ready` only after a live, non-destructive server-side verification against the configured property/site.
- Vingcard and dormakaba/Saflok must fail closed until the authorized hotel/vendor supplies the official supported interface and credentials.
- SALTO implementation may use the documented authorized API contract; production use still requires the hotel's authorized SALTO site/account.
- Every persisted Hospitality row must be organization-scoped; provider and room operations must also be property-scoped.
- Use existing ATLAS Identity, `organization_members`, Supabase, `audit_logs`, route shell, and CI patterns instead of parallel systems.
- Run `npm ci`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, and `npm run build` before completion.

---

## File Structure

Create or modify these focused units:

- `packages/hospitality/types.ts` — normalized provider, capability, request, result, and persistence-facing types.
- `packages/hospitality/permissions.ts` — explicit Hospitality permission evaluation and fail-closed helpers.
- `packages/hospitality/access.ts` — request validation and safe audit-event construction; migrate existing logic here to use the new types.
- `packages/hospitality/provider-registry.ts` — provider adapter registration/selection and unsupported-provider failure behavior.
- `supabase/functions/atlas-hospitality-access/_shared/context.ts` — authenticated user/org context resolution.
- `supabase/functions/atlas-hospitality-access/_shared/repository.ts` — provider instance, room mapping, credential reference, and audit persistence.
- `supabase/functions/atlas-hospitality-access/_shared/errors.ts` — normalized safe error mapping/redaction.
- `supabase/functions/atlas-hospitality-access/providers/salto.ts` — SALTO adapter.
- `supabase/functions/atlas-hospitality-access/providers/vingcard.ts` — Vingcard adapter that remains unavailable without the official configured interface.
- `supabase/functions/atlas-hospitality-access/providers/dormakaba.ts` — dormakaba/Saflok adapter that remains unavailable without the official configured interface.
- `supabase/functions/atlas-hospitality-access/providers/generic.ts` — generic certified-provider contract adapter.
- `supabase/functions/atlas-hospitality-access/index.ts` — thin request router/orchestrator only.
- `supabase/migrations/20260911_hospitality_room_access.sql` — provider instances, room mappings, credential references, indexes, constraints, and RLS.
- `apps/web/src/lib/hospitalityApi.ts` — authenticated browser API client.
- `apps/web/src/modules/hospitality/HospitalityRoutes.tsx` — protected Hospitality route graph.
- `apps/web/src/modules/hospitality/RoomAccessPage.tsx` — dashboard overview.
- `apps/web/src/modules/hospitality/ProvidersPage.tsx` — provider readiness/configuration metadata view.
- `apps/web/src/modules/hospitality/RoomsPage.tsx` — room-mapping status view.
- `apps/web/src/modules/hospitality/CredentialsPage.tsx` — issue/revoke/status UI using references only.
- `apps/web/src/modules/hospitality/AuditPage.tsx` — authorized Hospitality audit view.
- `apps/web/src/modules/hospitality/hospitality.css` — responsive module styles.
- `tests/unit/hospitality-room-access.test.ts` — domain validation/permissions/audit.
- `tests/unit/hospitality-provider-registry.test.ts` — registry and provider state behavior.
- `tests/unit/hospitality-provider-adapters.test.ts` — deterministic provider adapter contract tests.
- `tests/integration/hospitality-routes.test.tsx` — protected routes and truthful UI states.
- `tests/integration/hospitality-edge-contract.test.ts` — static/runtime contract assertions for Edge Function behavior.
- `.github/workflows/hospitality-self-hosted-ci.yml` — keep branch CI focused on the complete Hospitality verification sequence.

---

### Task 1: Normalize the Hospitality domain and explicit permissions

**Files:**
- Create: `packages/hospitality/types.ts`
- Create: `packages/hospitality/permissions.ts`
- Modify: `packages/hospitality/access.ts`
- Modify: `tests/unit/hospitality-room-access.test.ts`
- Create: `tests/unit/hospitality-provider-registry.test.ts`

**Interfaces:**
- Produces `HospitalityProviderType`, `HospitalityProviderState`, `HospitalityCapability`, `ProviderContext`, `ProviderReadiness`, `IssueCredentialRequest`, `IssueCredentialResult`, `RevokeCredentialRequest`, `RevokeCredentialResult`, `CredentialStatusResult`, `HospitalityAccessAdapter`.
- Produces `hasHospitalityPermission(context, permission)` and `requireHospitalityPermission(context, permission)`.

- [ ] **Step 1: Write failing permission/state tests**

Add tests asserting:

```ts
expect(hasHospitalityPermission(actor, 'hospitality.access.issue')).toBe(true);
expect(hasHospitalityPermission(readOnlyActor, 'hospitality.access.issue')).toBe(false);
expect(() => requireHospitalityPermission(readOnlyActor, 'hospitality.access.issue'))
  .toThrow('authorization_denied');
expect(PROVIDER_STATES).toEqual([
  'not_configured',
  'configured_unverified',
  'ready',
  'degraded',
  'offline',
  'disabled'
]);
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```bash
npx vitest run tests/unit/hospitality-room-access.test.ts tests/unit/hospitality-provider-registry.test.ts
```

Expected: FAIL because the new types/helpers do not exist.

- [ ] **Step 3: Implement minimal normalized types and permission helpers**

Use this permission vocabulary exactly:

```ts
export type HospitalityPermission =
  | 'hospitality.access.read'
  | 'hospitality.access.issue'
  | 'hospitality.access.revoke'
  | 'hospitality.access.configure'
  | 'hospitality.access.audit'
  | 'hospitality.access.admin';
```

Admin permission may satisfy other Hospitality permissions, but broad role names must not be checked inside domain functions.

- [ ] **Step 4: Refactor existing request validation/audit construction to the new types**

Preserve the current validity rule: `expiresAt` must parse and be strictly after `startsAt`. Preserve the rule that audit metadata contains references/statuses only, not credential payloads or secrets.

- [ ] **Step 5: Run tests and typecheck**

```bash
npx vitest run tests/unit/hospitality-room-access.test.ts tests/unit/hospitality-provider-registry.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/hospitality tests/unit/hospitality-room-access.test.ts tests/unit/hospitality-provider-registry.test.ts
git commit -m "refactor(hospitality): normalize access domain and permissions"
```

---

### Task 2: Add Supabase persistence and RLS

**Files:**
- Create: `supabase/migrations/20260911_hospitality_room_access.sql`
- Create: `tests/integration/hospitality-schema-contract.test.ts`

**Interfaces:**
- Produces tables `hospitality_provider_instances`, `hospitality_room_mappings`, `hospitality_credential_references`.
- Every table exposes `org_id`; provider/room/credential rows also expose `property_id`.

- [ ] **Step 1: Write a failing schema contract test**

Read the migration as text and assert it contains all three table names, `enable row level security`, and policies tied to active `organization_members` rows using `auth.uid()`.

Example assertions:

```ts
expect(sql).toContain('create table if not exists public.hospitality_provider_instances');
expect(sql).toContain('create table if not exists public.hospitality_room_mappings');
expect(sql).toContain('create table if not exists public.hospitality_credential_references');
expect(sql.match(/enable row level security/g)?.length).toBe(3);
expect(sql).toContain('organization_members');
expect(sql).toContain('auth.uid()');
```

- [ ] **Step 2: Run the test and confirm failure**

```bash
npx vitest run tests/integration/hospitality-schema-contract.test.ts
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement tables, constraints, and indexes**

Required constraints:

```sql
provider_type text not null check (provider_type in ('salto_ks','salto_space_hospitality','vingcard_vconnect','vingcard_vostio','vingcard_visionline','dormakaba_ambiance_cloud','dormakaba_ambiance_soap','dormakaba_ambiance_rest','dormakaba_pms_bridge','generic_certified')),
state text not null check (state in ('not_configured','configured_unverified','ready','degraded','offline','disabled'))
```

Credential status must be constrained to `issued`, `revoked`, `expired`, `failed`, or `unknown`.

Do not add columns for secret/token/private-key values.

- [ ] **Step 4: Add RLS**

For authenticated read/write paths, require a matching active `organization_members` row where `organization_members.org_id = target.org_id` and `organization_members.user_id = auth.uid()`. Writes that require configure/issue/revoke permissions remain additionally enforced in the Edge Function; RLS is the tenant isolation boundary.

- [ ] **Step 5: Run schema contract and full integration tests**

```bash
npx vitest run tests/integration/hospitality-schema-contract.test.ts
npm run test:integration
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260911_hospitality_room_access.sql tests/integration/hospitality-schema-contract.test.ts
git commit -m "feat(hospitality): add provider room and credential persistence"
```

---

### Task 3: Split the Edge Function into context, repository, errors, and provider registry

**Files:**
- Create: `supabase/functions/atlas-hospitality-access/_shared/context.ts`
- Create: `supabase/functions/atlas-hospitality-access/_shared/repository.ts`
- Create: `supabase/functions/atlas-hospitality-access/_shared/errors.ts`
- Create: `supabase/functions/atlas-hospitality-access/_shared/provider-registry.ts`
- Modify: `supabase/functions/atlas-hospitality-access/index.ts`
- Create: `tests/integration/hospitality-edge-contract.test.ts`

**Interfaces:**
- `resolveContext(req): Promise<{ userId: string; orgId: string; role: string; permissions: HospitalityPermission[] }>`
- `loadProviderInstance(orgId, propertyId)`
- `loadRoomMapping(orgId, propertyId, roomId, providerInstanceId)`
- `insertCredentialReference(...)`
- `updateCredentialReferenceStatus(...)`
- `writeHospitalityAudit(...)`
- `providerFor(instance): HospitalityAccessAdapter`

- [ ] **Step 1: Write failing static contract tests**

Assert the Edge Function no longer contains global single-provider variables `ATLAS_HOSPITALITY_PROVIDER_ID`, `ATLAS_HOSPITALITY_PROVIDER_ENDPOINT`, or `ATLAS_HOSPITALITY_PROVIDER_TOKEN`, and imports the new shared modules.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/hospitality-edge-contract.test.ts
```

Expected: FAIL against the current single-provider implementation.

- [ ] **Step 3: Implement context resolution**

Authenticate with the bearer token, resolve the active organization membership for `data.user.id`, and convert the existing role to a temporary permission set only in this boundary. Use owner/admin/platform_admin => all Hospitality permissions; other active members => `hospitality.access.read` only until a canonical permission table exists.

- [ ] **Step 4: Implement repository helpers**

All queries must include `.eq('org_id', ctx.orgId)` and property filters where applicable. Credential persistence stores `provider_credential_id` only; never store raw credential data.

- [ ] **Step 5: Implement normalized errors**

Map failures to the spec error names. Redact headers, tokens, raw provider bodies, and secret values. Preserve safe HTTP/provider status codes as metadata.

- [ ] **Step 6: Implement registry selection**

`providerFor(instance)` must throw `provider_not_configured` for absent/disabled config and `unsupported_provider_type` for unknown types. It must not silently fall back to another vendor.

- [ ] **Step 7: Reduce `index.ts` to routing/orchestration**

Keep supported API operations explicit: `readiness`, `providers`, `rooms`, `credentials`, `issue`, `revoke`, `credential-status`, `audit`.

- [ ] **Step 8: Run focused tests and typecheck**

```bash
npx vitest run tests/integration/hospitality-edge-contract.test.ts tests/unit/hospitality-provider-registry.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/atlas-hospitality-access tests/integration/hospitality-edge-contract.test.ts
git commit -m "refactor(hospitality): introduce provider registry and scoped repository"
```

---

### Task 4: Implement SALTO adapter against the authorized documented contract

**Files:**
- Create: `supabase/functions/atlas-hospitality-access/providers/salto.ts`
- Create: `tests/unit/hospitality-provider-adapters.test.ts`

**Interfaces:**
- Implements `HospitalityAccessAdapter` for `salto_ks` and `salto_space_hospitality` modes.
- Consumes only server-side configuration references resolved for the provider instance.

- [ ] **Step 1: Write failing deterministic adapter tests**

Inject a fake `fetch` implementation. Test readiness authentication/site verification, normalized timeout/offline handling, successful issue response containing only an external provider reference, revoke success, and rejection of malformed responses.

Example safe assertion:

```ts
expect(result).toEqual({
  providerCredentialId: 'salto-ref-123',
  state: 'issued',
  providerStatusCode: 201
});
expect(JSON.stringify(result)).not.toMatch(/token|secret|keyBytes|masterKey/i);
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/hospitality-provider-adapters.test.ts
```

- [ ] **Step 3: Implement readiness**

Readiness must verify authorization and the configured site/property using a non-destructive request. Environment/config presence alone returns `configured_unverified`, never `ready`.

- [ ] **Step 4: Implement issue/revoke/status using normalized requests/results**

Do not copy raw mobile-key or credential cryptographic material into ATLAS. For SALTO Space Hospitality, expose only capabilities actually provided by the authorized Hospitality interface; do not inherit all KS capabilities automatically.

- [ ] **Step 5: Run focused tests**

```bash
npx vitest run tests/unit/hospitality-provider-adapters.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/atlas-hospitality-access/providers/salto.ts tests/unit/hospitality-provider-adapters.test.ts
git commit -m "feat(hospitality): add governed SALTO access adapter"
```

---

### Task 5: Add Vingcard and dormakaba/Saflok fail-closed adapters

**Files:**
- Create: `supabase/functions/atlas-hospitality-access/providers/vingcard.ts`
- Create: `supabase/functions/atlas-hospitality-access/providers/dormakaba.ts`
- Modify: `tests/unit/hospitality-provider-adapters.test.ts`

**Interfaces:**
- Implements the same adapter contract.
- Supports Vingcard modes `vingcard_vconnect`, `vingcard_vostio`, `vingcard_visionline`.
- Supports dormakaba modes `dormakaba_ambiance_cloud`, `dormakaba_ambiance_soap`, `dormakaba_ambiance_rest`, `dormakaba_pms_bridge`.

- [ ] **Step 1: Add failing tests for missing official interface configuration**

For both vendors, an instance without a verified official integration config must return `configured_unverified` or `not_configured` and must refuse `issueCredential` with `provider_not_ready`.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/hospitality-provider-adapters.test.ts
```

- [ ] **Step 3: Implement adapter shells with explicit readiness boundaries**

The adapters may call only configured official PMS/API bridge endpoints supplied for the authorized property. Do not invent request paths, encoder commands, packet formats, ports, or proprietary credential payloads.

When no supported interface definition is configured, return:

```ts
{
  state: 'configured_unverified',
  blocker: 'official_provider_interface_required',
  checkedAt: new Date().toISOString()
}
```

- [ ] **Step 4: Add deterministic tests for safe provider-error normalization**

Ensure vendor error bodies are reduced to safe status/code metadata and never echoed whole to the browser.

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/unit/hospitality-provider-adapters.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/atlas-hospitality-access/providers tests/unit/hospitality-provider-adapters.test.ts
git commit -m "feat(hospitality): add Vingcard and dormakaba provider boundaries"
```

---

### Task 6: Add generic certified-provider adapter and complete registry coverage

**Files:**
- Create: `supabase/functions/atlas-hospitality-access/providers/generic.ts`
- Modify: `supabase/functions/atlas-hospitality-access/_shared/provider-registry.ts`
- Modify: `tests/unit/hospitality-provider-registry.test.ts`

- [ ] **Step 1: Write failing registry coverage test**

Assert every provider type in `HospitalityProviderType` resolves to exactly one adapter family and an arbitrary string fails closed.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/hospitality-provider-registry.test.ts
```

- [ ] **Step 3: Implement generic adapter**

It may support a documented certified JSON bridge only when configuration declares explicit capabilities and a successful non-destructive readiness probe validates the configured property. It must never infer capabilities from an endpoint existing.

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/unit/hospitality-provider-registry.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-hospitality-access/providers/generic.ts supabase/functions/atlas-hospitality-access/_shared/provider-registry.ts tests/unit/hospitality-provider-registry.test.ts
git commit -m "feat(hospitality): add certified provider registry fallback"
```

---

### Task 7: Complete issue, revoke, status, room-mapping, and audit API flows

**Files:**
- Modify: `supabase/functions/atlas-hospitality-access/index.ts`
- Modify: `supabase/functions/atlas-hospitality-access/_shared/repository.ts`
- Modify: `tests/integration/hospitality-edge-contract.test.ts`

- [ ] **Step 1: Write failing orchestration contract tests**

Assert issue flow requires: authenticated org, `hospitality.access.issue`, provider state `ready`, provider capability `credential.issue`, verified room mapping, non-empty assignment reference, and valid time window. Assert revoke requires `hospitality.access.revoke` and a credential reference belonging to the same org/property/provider.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/hospitality-edge-contract.test.ts
```

- [ ] **Step 3: Implement readiness/list endpoints**

Return arrays of provider instances with truthful states and capabilities; room listings return ATLAS/provider mapping status, not secrets.

- [ ] **Step 4: Implement issue flow**

Persist the normalized credential reference only after provider success. If persistence fails after provider success, record `persistence_failed` in audit and return a non-success response requiring reconciliation; do not falsely report issuance as fully recorded.

- [ ] **Step 5: Implement revoke/status flow**

Resolve the stored provider credential reference server-side. Update ATLAS status only after provider response. Expiry may also be derived when `expires_at <= now()`.

- [ ] **Step 6: Implement audit endpoint**

Require `hospitality.access.audit`; return Hospitality audit rows scoped to the active organization/property and sanitized metadata only.

- [ ] **Step 7: Run tests and typecheck**

```bash
npx vitest run tests/integration/hospitality-edge-contract.test.ts
npm run typecheck
```

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/atlas-hospitality-access tests/integration/hospitality-edge-contract.test.ts
git commit -m "feat(hospitality): complete credential lifecycle API"
```

---

### Task 8: Build the authenticated Hospitality browser client and route graph

**Files:**
- Create: `apps/web/src/lib/hospitalityApi.ts`
- Modify: `apps/web/src/modules/hospitality/HospitalityRoutes.tsx`
- Create: `apps/web/src/modules/hospitality/ProvidersPage.tsx`
- Create: `apps/web/src/modules/hospitality/RoomsPage.tsx`
- Create: `apps/web/src/modules/hospitality/CredentialsPage.tsx`
- Create: `apps/web/src/modules/hospitality/AuditPage.tsx`
- Modify: `apps/web/src/modules/hospitality/RoomAccessPage.tsx`
- Modify: `apps/web/src/modules/hospitality/hospitality.css`
- Create: `tests/integration/hospitality-routes.test.tsx`

**Interfaces:**
- `hospitalityRequest(api, init)` uses the existing ATLAS access token and refresh/session behavior rather than creating a second auth store.
- Route graph: `/hospitality/access`, `/hospitality/access/providers`, `/hospitality/access/rooms`, `/hospitality/access/credentials`, `/hospitality/access/audit`.

- [ ] **Step 1: Write failing route/UI tests**

Tests must verify protected navigation destinations, provider `Not configured`/`Configured — verification required`/`Ready` labels, issue button disabled unless the provider is `ready` and permission exists, revoke action hidden without revoke permission, and no input labeled token/secret/master key.

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/integration/hospitality-routes.test.tsx
```

- [ ] **Step 3: Implement `hospitalityApi.ts`**

Reuse `getAtlasAccessToken()` and the existing Supabase URL/publishable-key pattern. Expose typed functions: `getHospitalityReadiness`, `listHospitalityProviders`, `listHospitalityRooms`, `listHospitalityCredentials`, `issueHospitalityCredential`, `revokeHospitalityCredential`, `getHospitalityAudit`.

- [ ] **Step 4: Expand routes**

Keep `RequireAtlasIdentity` around the entire Hospitality route graph. Do not add unprotected duplicate routes in `App.tsx`.

- [ ] **Step 5: Convert Room Access to dashboard**

Show current organization, property context, providers, mapping summary, credential summary, and blockers. Do not fabricate hotel counts; real empty state is acceptable.

- [ ] **Step 6: Implement Providers, Rooms, Credentials, Audit pages**

All actions must reflect loading/empty/error/success/disabled states. Configuration pages display safe metadata and secret-reference status only, never actual secret values.

- [ ] **Step 7: Extend responsive CSS**

Verify provider cards and tables collapse or scroll safely below 900px and forms become one column below 640px.

- [ ] **Step 8: Run UI tests, integration tests, and build**

```bash
npx vitest run tests/integration/hospitality-routes.test.tsx
npm run test:integration
npm run build
```

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/hospitalityApi.ts apps/web/src/modules/hospitality tests/integration/hospitality-routes.test.tsx
git commit -m "feat(hospitality): add multi-provider room access workspace"
```

---

### Task 9: Harden CI and security regression coverage

**Files:**
- Modify: `.github/workflows/hospitality-self-hosted-ci.yml`
- Create: `tests/integration/hospitality-security-contract.test.ts`

- [ ] **Step 1: Write failing secret-boundary test**

Scan browser Hospitality source and provider API response fixtures for forbidden browser-facing names/patterns: `master_key`, `private_key`, `provider_token`, `key_bytes`, `rfid_dump`, `encoder_secret`. Permit secret-reference metadata names only when they do not contain values.

- [ ] **Step 2: Run and confirm expected current state**

```bash
npx vitest run tests/integration/hospitality-security-contract.test.ts
```

If it passes immediately, keep it as a regression test; do not force an artificial failure by adding unsafe code.

- [ ] **Step 3: Update self-hosted CI**

Use this order:

```yaml
- run: npm ci
- run: npm run typecheck
- run: npx vitest run tests/unit/hospitality-room-access.test.ts tests/unit/hospitality-provider-registry.test.ts tests/unit/hospitality-provider-adapters.test.ts
- run: npx vitest run tests/integration/hospitality-schema-contract.test.ts tests/integration/hospitality-edge-contract.test.ts tests/integration/hospitality-routes.test.tsx tests/integration/hospitality-security-contract.test.ts
- run: npm run test:unit
- run: npm run test:integration
- run: npm run build
```

- [ ] **Step 4: Run complete local/reachable validation**

```bash
npm ci
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/hospitality-self-hosted-ci.yml tests/integration/hospitality-security-contract.test.ts
git commit -m "test(hospitality): harden provider and credential boundaries"
```

---

### Task 10: Production-readiness verification and PR evidence

**Files:**
- Modify only if verification exposes a concrete defect.
- Update PR #75 discussion with evidence after checks run.

- [ ] **Step 1: Verify branch diff is focused**

```bash
git diff --stat main...feat/hospitality-room-access
git diff --check main...feat/hospitality-room-access
```

Expected: no whitespace errors; changes limited to Hospitality, shared route wiring needed for Hospitality, tests, migrations, CI, and approved docs.

- [ ] **Step 2: Verify no secrets are committed**

Inspect changed files and Git diff for credential/token/private-key material. Environment variable names and secret reference names are acceptable; secret values are not.

- [ ] **Step 3: Verify provider readiness semantics**

With no vendor credentials configured, Vingcard/dormakaba/SALTO instances must not display `ready`. With an authorized SALTO test configuration, only a successful non-destructive site/property probe may transition SALTO to `ready`.

- [ ] **Step 4: Verify route behavior**

Confirm the built SPA reaches:

```text
/hospitality/access
/hospitality/access/providers
/hospitality/access/rooms
/hospitality/access/credentials
/hospitality/access/audit
```

Authenticated users without required action permissions must see disabled/denied states rather than successful mutations.

- [ ] **Step 5: Record external blockers truthfully**

PR evidence must state that real Vingcard/dormakaba issuance is blocked until the authorized property/vendor supplies the official supported integration definition and credentials. Do not mark those providers production-ready from mocks.

- [ ] **Step 6: Run final verification**

```bash
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Expected: PASS before requesting merge.

- [ ] **Step 7: Do not merge or deploy solely from unit/mock evidence**

Merge/deployment may proceed only after repository validation is green. Provider-specific production validation remains a separate evidence gate for each actual hotel property.

---

## Self-Review Results

- **Spec coverage:** provider registry, permissions, RLS, room mappings, credential references, issue/revoke/status, audit, SALTO, Vingcard, dormakaba/Saflok, generic provider, UI routes, error boundaries, testing, security, readiness states, and production gates are each mapped to a task.
- **Placeholder scan:** no implementation placeholders are used. Vendor-specific proprietary paths are intentionally not invented; their absence is an explicit fail-closed requirement, not unfinished design.
- **Type consistency:** provider states, provider families, permission names, route names, credential references, and adapter method names match the approved design.
- **Scope check:** this remains one subsystem because every vendor adapter implements the same normalized ATLAS Hospitality contract and shares the same data/authorization/UI lifecycle.
