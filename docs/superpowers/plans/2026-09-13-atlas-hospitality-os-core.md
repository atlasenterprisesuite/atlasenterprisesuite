# ATLAS Hospitality OS Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the ATLAS Hospitality Core + Property Operating Model as a tenant-safe, multi-brand, multi-property foundation that preserves existing room-access behavior and prepares Hotel and Restaurant operations without exposing unimplemented PMS/POS functionality as live.

**Architecture:** Extend the existing `packages/hospitality` domain and current Hospitality web routes. Introduce canonical property hierarchy contracts, fail-closed scope/permission helpers, core event/audit envelopes, and property-aware UI/navigation while reusing ATLAS Identity, Organization/Tenant, existing room-access permissions, AtlasShell, Universal Execution/Audit boundaries, and the existing `/hospitality/access/*` routes.

**Tech Stack:** TypeScript, React 18, React Router, Vitest, existing ATLAS shell/identity patterns, Supabase-backed ATLAS infrastructure where already present.

**Spec:** `docs/superpowers/specs/2026-09-13-atlas-hospitality-os-core-design.md`

## Global Constraints

- Preserve one ATLAS identity and tenant model; do not create a Hospitality-specific identity silo.
- Every Hospitality record must resolve to `organizationId`; property-scoped records must resolve to `propertyId`.
- Fail closed when organization identity, property scope, permission, or provenance is unverifiable.
- Existing room-access routes and permission strings remain valid.
- Do not implement or simulate a PMS, POS, payment processor, OTA connector, accounting engine, or inventory engine in this slice.
- Do not present catalog-only Hotel/Restaurant actions as operationally live.
- Sensitive operations preserve audit/evidence and approval references where required.
- Reuse current ATLAS accessibility and responsive patterns.
- Verification gate before completion: `npm ci`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run build`.
- No merge or deployment from this plan without explicit approval.

---

## File Structure

- `packages/hospitality/types.ts` — extend existing Hospitality contracts with the property hierarchy while preserving room-access types.
- `packages/hospitality/permissions.ts` — extend permission vocabulary and expose fail-closed capability checks.
- `packages/hospitality/scope.ts` — canonical organization/property/outlet scope validation.
- `packages/hospitality/core-events.ts` — typed property-context events and audit/evidence envelopes.
- `apps/web/src/modules/hospitality/hospitalityContext.ts` — browser-safe selected-property context contract/cache.
- `apps/web/src/modules/hospitality/HospitalityOverviewPage.tsx` — property-aware Hospitality OS overview.
- `apps/web/src/modules/hospitality/PropertiesPage.tsx` — first property catalog surface; read-only unless a real mutation backend exists.
- `apps/web/src/modules/hospitality/HospitalitySubnav.tsx` — extend existing navigation while preserving room-access links.
- `apps/web/src/modules/hospitality/HospitalityRoutes.tsx` — add overview/properties and retain compatibility redirects.
- `apps/web/src/modules/hospitality/hospitality.css` — responsive/touch-safe styling for the first Hospitality OS surfaces.
- `tests/unit/hospitality-core-types.test.ts` — canonical hierarchy contract tests.
- `tests/unit/hospitality-scope.test.ts` — organization/property fail-closed tests.
- `tests/unit/hospitality-permissions.test.ts` — new + existing permission compatibility tests.
- `tests/unit/hospitality-core-events.test.ts` — event/audit envelope tests.
- `tests/unit/hospitality-context.test.ts` — selected-property cache/context tests.
- `tests/integration/hospitality-os-routes.test.tsx` — overview/properties/room-access compatibility tests.
- `tests/integration/hospitality-os-boundaries.test.ts` — no-fake-live action and scope boundary tests.

---

### Task 1: Canonical Hospitality hierarchy contracts

**Files:**
- Modify: `packages/hospitality/types.ts`
- Create: `tests/unit/hospitality-core-types.test.ts`

**Interfaces:**
- Consumes: existing `HospitalityPermission`, `HospitalityActorContext`, `ProviderContext`, room-access provider contracts.
- Produces: `HospitalityBrand`, `HospitalityProperty`, `HospitalityOutlet`, `HospitalitySpace`, `HospitalityOperationalUnit`, `HospitalityPropertyType`, `HospitalityOutletType`, `HospitalitySpaceType`, `HospitalityPropertyContext`.

- [ ] **Step 1: Write the failing hierarchy contract test**

```ts
import { describe, expect, it } from 'vitest';
import type {
  HospitalityBrand,
  HospitalityOutlet,
  HospitalityOperationalUnit,
  HospitalityProperty,
  HospitalityPropertyContext,
  HospitalitySpace
} from '../../packages/hospitality/types';

describe('Hospitality Core hierarchy', () => {
  it('requires organization and property identity across property-scoped contracts', () => {
    const brand: HospitalityBrand = {
      id: 'brand-1', organizationId: 'org-1', name: 'ATLAS Hotels', status: 'active'
    };
    const property: HospitalityProperty = {
      id: 'property-1', organizationId: 'org-1', brandId: brand.id,
      name: 'ATLAS Orlando', type: 'hotel', status: 'active', timeZone: 'America/New_York'
    };
    const outlet: HospitalityOutlet = {
      id: 'outlet-1', organizationId: 'org-1', propertyId: property.id,
      name: 'Lobby Restaurant', type: 'restaurant', status: 'active'
    };
    const space: HospitalitySpace = {
      id: 'space-1', organizationId: 'org-1', propertyId: property.id,
      outletId: outlet.id, name: 'Table 10', type: 'table', status: 'active'
    };
    const unit: HospitalityOperationalUnit = {
      id: 'unit-1', organizationId: 'org-1', propertyId: property.id,
      name: 'Food & Beverage', type: 'food_and_beverage', status: 'active'
    };
    const context: HospitalityPropertyContext = {
      organizationId: 'org-1', propertyId: property.id
    };

    expect({ brand, property, outlet, space, unit, context }).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run tests/unit/hospitality-core-types.test.ts`

Expected: FAIL because the new core types are not exported yet.

- [ ] **Step 3: Add the minimal hierarchy contracts without changing existing room-access signatures**

Add discriminated string unions for property/outlet/space/unit types and records that always include `organizationId`; property-scoped records include `propertyId` exactly as required by the test.

- [ ] **Step 4: Run the focused test and existing Hospitality unit tests**

Run: `npx vitest run tests/unit/hospitality-core-types.test.ts tests/unit/hospitality-access.test.ts`

Expected: PASS; if the legacy test path differs, run the existing unit test file returned by repository search instead of inventing a replacement.

- [ ] **Step 5: Commit**

```bash
git add packages/hospitality/types.ts tests/unit/hospitality-core-types.test.ts
git commit -m "feat: add Hospitality property hierarchy contracts"
```

---

### Task 2: Tenant and property scope validator

**Files:**
- Create: `packages/hospitality/scope.ts`
- Create: `tests/unit/hospitality-scope.test.ts`

**Interfaces:**
- Consumes: `HospitalityPropertyContext`.
- Produces: `HospitalityScope`, `assertHospitalityScope(actor, resource)`, `canAccessHospitalityScope(actor, resource)`.

- [ ] **Step 1: Write failing fail-closed scope tests**

```ts
import { describe, expect, it } from 'vitest';
import { assertHospitalityScope, canAccessHospitalityScope } from '../../packages/hospitality/scope';

describe('Hospitality scope', () => {
  const actor = { organizationId: 'org-1', propertyIds: ['property-1'] };

  it('allows the authorized property', () => {
    expect(canAccessHospitalityScope(actor, { organizationId: 'org-1', propertyId: 'property-1' })).toBe(true);
  });

  it('denies another property by default', () => {
    expect(canAccessHospitalityScope(actor, { organizationId: 'org-1', propertyId: 'property-2' })).toBe(false);
  });

  it('denies another organization and throws from the assertion helper', () => {
    const resource = { organizationId: 'org-2', propertyId: 'property-1' };
    expect(canAccessHospitalityScope(actor, resource)).toBe(false);
    expect(() => assertHospitalityScope(actor, resource)).toThrow(/scope/i);
  });
});
```

- [ ] **Step 2: Run focused test and confirm RED**

Run: `npx vitest run tests/unit/hospitality-scope.test.ts`

- [ ] **Step 3: Implement exact-match, fail-closed scope logic**

`canAccessHospitalityScope` returns false for blank/missing organization ids, mismatched organizations, missing property ids on property-scoped resources, or unauthorized properties. `assertHospitalityScope` throws `HospitalityScopeError` with no secret/provider data in the message.

- [ ] **Step 4: Run test and confirm GREEN**

Run: `npx vitest run tests/unit/hospitality-scope.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/hospitality/scope.ts tests/unit/hospitality-scope.test.ts
git commit -m "feat: enforce Hospitality tenant and property scope"
```

---

### Task 3: Permission vocabulary and backward compatibility

**Files:**
- Modify: `packages/hospitality/types.ts`
- Modify: `packages/hospitality/permissions.ts`
- Create: `tests/unit/hospitality-permissions.test.ts`

**Interfaces:**
- Consumes: existing six `hospitality.access.*` permissions.
- Produces new permission strings: `hospitality.property.read`, `hospitality.property.manage`, `hospitality.reservation.read`, `hospitality.reservation.manage`, `hospitality.frontdesk.checkin`, `hospitality.frontdesk.checkout`, `hospitality.housekeeping.manage`, `hospitality.maintenance.manage`, `hospitality.restaurant.order.read`, `hospitality.restaurant.order.manage`, `hospitality.restaurant.refund`, `hospitality.audit.read`, `hospitality.audit.admin`.
- Produces `hasHospitalityPermission(permissions, required)` with fail-closed semantics.

- [ ] **Step 1: Write compatibility test**

```ts
import { describe, expect, it } from 'vitest';
import { hasHospitalityPermission } from '../../packages/hospitality/permissions';

describe('Hospitality permissions', () => {
  it('keeps room-access permissions valid', () => {
    expect(hasHospitalityPermission(['hospitality.access.issue'], 'hospitality.access.issue')).toBe(true);
  });

  it('supports property permissions and fails closed for missing capability', () => {
    expect(hasHospitalityPermission(['hospitality.property.read'], 'hospitality.property.read')).toBe(true);
    expect(hasHospitalityPermission([], 'hospitality.property.manage')).toBe(false);
  });
});
```

- [ ] **Step 2: Run focused test and confirm RED for new vocabulary**

Run: `npx vitest run tests/unit/hospitality-permissions.test.ts`

- [ ] **Step 3: Extend the permission union and evaluator without wildcard/root shortcuts**

Do not add `*`, implicit admin inheritance, or AI/root bypasses. Any broader-role mapping belongs to the existing ATLAS authorization layer, not this helper.

- [ ] **Step 4: Run new and existing room-access permission tests**

Run: `npx vitest run tests/unit/hospitality-permissions.test.ts tests/unit/hospitality-permissions*.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/hospitality/types.ts packages/hospitality/permissions.ts tests/unit/hospitality-permissions.test.ts
git commit -m "feat: extend Hospitality permission contracts"
```

---

### Task 4: Core property events and audit evidence envelope

**Files:**
- Create: `packages/hospitality/core-events.ts`
- Create: `tests/unit/hospitality-core-events.test.ts`

**Interfaces:**
- Produces event types `hospitality.property.created`, `hospitality.property.context_selected`.
- Produces `createHospitalityAuditEnvelope(input)` and `HospitalityAuditEnvelope`.

- [ ] **Step 1: Write failing event/audit tests**

```ts
import { describe, expect, it } from 'vitest';
import { createHospitalityAuditEnvelope, createPropertyContextSelectedEvent } from '../../packages/hospitality/core-events';

describe('Hospitality core events', () => {
  it('preserves organization/property provenance', () => {
    const event = createPropertyContextSelectedEvent({
      organizationId: 'org-1', propertyId: 'property-1', actorId: 'user-1', occurredAt: '2026-09-13T14:00:00.000Z'
    });
    expect(event.type).toBe('hospitality.property.context_selected');
    expect(event.organizationId).toBe('org-1');
    expect(event.propertyId).toBe('property-1');
  });

  it('requires an explicit result state in audit evidence', () => {
    const audit = createHospitalityAuditEnvelope({
      eventId: 'evt-1', organizationId: 'org-1', propertyId: 'property-1',
      actorId: 'user-1', action: 'hospitality.property.context_select',
      subjectId: 'property-1', timestamp: '2026-09-13T14:00:00.000Z',
      permissionDecision: 'allowed', result: 'success'
    });
    expect(audit.result).toBe('success');
  });
});
```

- [ ] **Step 2: Run focused test and confirm RED**

Run: `npx vitest run tests/unit/hospitality-core-events.test.ts`

- [ ] **Step 3: Implement immutable event builders with no side effects**

Builders validate non-empty organization/property/actor ids and return plain JSON-safe objects. Audit result is one of `success | failure | blocked`; optional `approvalReference` and `evidenceReferences` are retained when supplied.

- [ ] **Step 4: Run focused test and confirm GREEN**

Run: `npx vitest run tests/unit/hospitality-core-events.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/hospitality/core-events.ts tests/unit/hospitality-core-events.test.ts
git commit -m "feat: add Hospitality core events and audit envelope"
```

---

### Task 5: Property selection context for the web app

**Files:**
- Create: `apps/web/src/modules/hospitality/hospitalityContext.ts`
- Create: `tests/unit/hospitality-context.test.ts`

**Interfaces:**
- Produces `HospitalitySelectedProperty`, `getCachedHospitalityProperty()`, `setCachedHospitalityProperty(value)`, `clearCachedHospitalityProperty()`, `ATLAS_HOSPITALITY_PROPERTY_EVENT`.

- [ ] **Step 1: Write failing cache/context tests**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearCachedHospitalityProperty,
  getCachedHospitalityProperty,
  setCachedHospitalityProperty
} from '../../apps/web/src/modules/hospitality/hospitalityContext';

beforeEach(() => localStorage.clear());

describe('Hospitality property context', () => {
  it('round-trips organization/property identity', () => {
    setCachedHospitalityProperty({ organizationId: 'org-1', propertyId: 'property-1', propertyName: 'ATLAS Orlando' });
    expect(getCachedHospitalityProperty()?.propertyId).toBe('property-1');
  });

  it('clears invalid or stale context explicitly', () => {
    setCachedHospitalityProperty({ organizationId: 'org-1', propertyId: 'property-1', propertyName: 'ATLAS Orlando' });
    clearCachedHospitalityProperty();
    expect(getCachedHospitalityProperty()).toBeNull();
  });
});
```

- [ ] **Step 2: Run focused test and confirm RED**

Run: `npx vitest run tests/unit/hospitality-context.test.ts --environment jsdom`

- [ ] **Step 3: Implement a minimal local cache contract**

Use a versioned localStorage key. Reject malformed JSON or missing ids by clearing/returning null. Dispatch a browser event only after successful set/clear. This cache is UX context only and never authorization truth.

- [ ] **Step 4: Run focused test and confirm GREEN**

Run: `npx vitest run tests/unit/hospitality-context.test.ts --environment jsdom`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/hospitality/hospitalityContext.ts tests/unit/hospitality-context.test.ts
git commit -m "feat: add Hospitality selected property context"
```

---

### Task 6: Hospitality OS overview and property catalog surfaces

**Files:**
- Create: `apps/web/src/modules/hospitality/HospitalityOverviewPage.tsx`
- Create: `apps/web/src/modules/hospitality/PropertiesPage.tsx`
- Modify: `apps/web/src/modules/hospitality/hospitality.css`
- Create: `tests/integration/hospitality-os-boundaries.test.ts`

**Interfaces:**
- Consumes selected property context and existing AtlasShell/identity wrapping from routes.
- Produces a Hospitality OS overview and a property catalog surface with truthful capability status.

- [ ] **Step 1: Write failing boundary test for no fake-live actions**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Hospitality OS UI boundaries', () => {
  it('does not expose unimplemented PMS/POS actions as live controls', () => {
    const overview = readFileSync(resolve(process.cwd(), 'apps/web/src/modules/hospitality/HospitalityOverviewPage.tsx'), 'utf8');
    expect(overview).not.toContain('Create reservation');
    expect(overview).not.toContain('Open POS');
    expect(overview).toContain('Hotel Operations');
    expect(overview).toContain('Restaurant Operations');
  });
});
```

- [ ] **Step 2: Run focused integration test and confirm RED**

Run: `npx vitest run tests/integration/hospitality-os-boundaries.test.ts`

- [ ] **Step 3: Implement overview and properties pages**

Overview shows: current property context (or explicit no-property state), existing Room Access as operational, and Hotel Operations / Restaurant Operations as `Foundation` or `Planned` status cards without executable fake actions. Properties page renders a typed read-only property catalog from a small in-module adapter/interface; if there is no verified backend source, render an explicit empty/unconfigured state rather than mock operational data.

- [ ] **Step 4: Add responsive/touch-safe styling using existing Hospitality CSS tokens/patterns**

Ensure keyboard focus remains visible, cards stack on narrow widths, and interactive controls meet existing touch target conventions.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run tests/integration/hospitality-os-boundaries.test.ts`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/modules/hospitality/HospitalityOverviewPage.tsx apps/web/src/modules/hospitality/PropertiesPage.tsx apps/web/src/modules/hospitality/hospitality.css tests/integration/hospitality-os-boundaries.test.ts
git commit -m "feat: add Hospitality OS overview and property surfaces"
```

---

### Task 7: Property-aware navigation and legacy room-access compatibility

**Files:**
- Modify: `apps/web/src/modules/hospitality/HospitalitySubnav.tsx`
- Modify: `apps/web/src/modules/hospitality/HospitalityRoutes.tsx`
- Create: `tests/integration/hospitality-os-routes.test.tsx`

**Interfaces:**
- Produces routes `/hospitality/overview`, `/hospitality/properties`.
- Preserves `/hospitality/access`, `/hospitality/access/providers`, `/hospitality/access/rooms`, `/hospitality/access/credentials`, `/hospitality/access/audit`.

- [ ] **Step 1: Write failing route compatibility test**

```tsx
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Hospitality OS route contract', () => {
  it('adds OS routes and preserves room-access routes', () => {
    const routes = readFileSync(resolve(process.cwd(), 'apps/web/src/modules/hospitality/HospitalityRoutes.tsx'), 'utf8');
    expect(routes).toContain('/hospitality/overview');
    expect(routes).toContain('/hospitality/properties');
    expect(routes).toContain('/hospitality/access');
    expect(routes).toContain('/hospitality/access/providers');
    expect(routes).toContain('/hospitality/access/rooms');
    expect(routes).toContain('/hospitality/access/credentials');
    expect(routes).toContain('/hospitality/access/audit');
  });
});
```

- [ ] **Step 2: Run focused test and confirm RED**

Run: `npx vitest run tests/integration/hospitality-os-routes.test.tsx`

- [ ] **Step 3: Extend subnav and routes**

Make `/hospitality` redirect to `/hospitality/overview`. Add Overview and Properties to subnav before the existing Access destinations. Keep all existing access paths unchanged. Keep wildcard fallback inside Hospitality pointed to overview, not a dead page.

- [ ] **Step 4: Run route test plus existing Hospitality integration suite**

Run: `npx vitest run tests/integration/hospitality-os-routes.test.tsx tests/integration/hospitality-*.test.ts*`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/hospitality/HospitalitySubnav.tsx apps/web/src/modules/hospitality/HospitalityRoutes.tsx tests/integration/hospitality-os-routes.test.tsx
git commit -m "feat: integrate Hospitality OS navigation"
```

---

### Task 8: Regression gate, scope review, and readiness evidence

**Files:**
- Modify only if evidence identifies a real defect in Tasks 1-7.
- Update: `docs/hospitality/IMPLEMENTATION_STATUS.md` only with verified results.

**Interfaces:**
- Consumes all previous tasks.
- Produces fresh verification evidence; does not merge or deploy.

- [ ] **Step 1: Install dependencies from lockfile**

Run: `npm ci`

Expected: exit code 0.

- [ ] **Step 2: Run TypeScript contracts**

Run: `npm run typecheck`

Expected: exit code 0.

- [ ] **Step 3: Run unit suite**

Run: `npm run test:unit`

Expected: zero failing tests.

- [ ] **Step 4: Run integration suite**

Run: `npm run test:integration`

Expected: zero failing tests, including legacy Hospitality access/schema/edge contracts.

- [ ] **Step 5: Build production web bundle**

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 6: Perform explicit contract review**

Verify from the diff and tests:
- every new property-scoped contract carries organization + property identity;
- cross-property access denies by default;
- legacy `hospitality.access.*` permissions remain valid;
- all existing `/hospitality/access/*` routes remain reachable;
- no fake PMS/POS/payment/OTA/inventory/accounting control is labeled operational;
- no secrets, provider credentials, or production mutations were introduced.

- [ ] **Step 7: Update readiness status only with observed evidence**

Record exact command, exit status, test counts where available, and blockers. If a command cannot run because CI/runner infrastructure is unavailable, record it as blocked rather than pass.

- [ ] **Step 8: Commit verified readiness record**

```bash
git add docs/hospitality/IMPLEMENTATION_STATUS.md
git commit -m "docs: record Hospitality OS core verification"
```

Do not merge and do not deploy.
