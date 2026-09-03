# ATLAS Aviation Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first functional ATLAS Mobility → Aviation experience with a 10-model ATLAS concept-aircraft catalog, evidence-aware aircraft detail, certification intelligence, read-only investment intelligence, saved aircraft, alerts, responsive navigation, and truthful empty/stale/restricted states without inventing production metrics.

**Architecture:** Extend the existing zero-runtime-dependency Node 22 ATLAS foundation instead of creating a second application shell. Convert the current single-module router/app entry into a small module registry, keep Site Review isolated, and add `src/modules/aviation/` with focused domain, store, service, alert, view-model, and UI files. The first persistence layer remains in memory but all UI consumers call a service boundary so durable storage can replace it later.

**Tech Stack:** Node.js >=22, native ES modules, `node:test`, `node:assert/strict`, vanilla HTML/CSS/JavaScript, existing static `server.mjs`, zero runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-03-aviation-intelligence-design.md`

## Global Constraints

- Node.js must remain `>=22`.
- Keep zero runtime dependencies for this implementation.
- Do not copy Doroni, Instagram, manufacturer, or third-party proprietary UI/assets.
- Do not present share price, valuation, market size, range, speed, certification, delivery, funding, or availability as production truth without evidence.
- The initial ATLAS aircraft lineup is internal concept data; all unvalidated engineering metrics remain `null` and render as “Not validated”.
- No securities transaction execution. Investment actions are read-only intelligence plus official-source links when available.
- Distinguish `empty`, `loading`, `ready`, `stale`, `not_configured`, `error`, and `restricted` states.
- All sensitive editing capabilities remain authorization-gated even though editing UI is not part of this slice.
- Existing `/sites/review` behavior and tests must not regress.
- No production, connected, certified, live, or operational claim without evidence.

---

## File Structure Locked for This Plan

### Core files modified

- `src/core/routes.js` — declarative route registry and Aviation route matching.
- `src/core/permissions.js` — central Aviation capabilities added to existing role model.
- `src/app.js` — thin route dispatcher only.
- `src/index.html` — shared ATLAS shell containers; module content mounted at runtime.
- `src/styles.css` — shared tokens plus shell/responsive primitives only.
- `server.mjs` — serve all recognized SPA routes through `index.html`.

### Site Review files modified/created

- `src/modules/site-review/site-review-app.js` — receives the existing Site Review boot/render/event code currently embedded in `src/app.js`.

### Aviation files created

- `src/modules/aviation/aviation-concepts.js` — internal 10-model ATLAS concept lineup and internal provenance records.
- `src/modules/aviation/aviation-status.js` — state enums, stale calculation, certification normalization, and evidence precedence/conflict rules.
- `src/modules/aviation/aviation-store.js` — deterministic in-memory aircraft/save/alert repository.
- `src/modules/aviation/aviation-service.js` — search, filters, detail composition, save toggles, investment/certification read models.
- `src/modules/aviation/aviation-alerts.js` — alert rule validation and evidence-change evaluation.
- `src/modules/aviation/aviation-ui.js` — pure view-model builders and escaping helpers.
- `src/modules/aviation/aviation-app.js` — DOM mount/render/event orchestration.
- `src/modules/aviation/aviation.css` — module-specific visual system for the approved blue-black Aviation direction.

### Tests created/modified

- `tests/routes.test.mjs`
- `tests/permissions.test.mjs`
- `tests/server.test.mjs`
- `tests/aviation-status.test.mjs`
- `tests/aviation-store.test.mjs`
- `tests/aviation-service.test.mjs`
- `tests/aviation-alerts.test.mjs`
- `tests/aviation-ui.test.mjs`
- `tests/app-regression.test.mjs` if an import-safe dispatcher test is needed after Task 1.

---

### Task 1: Generalize the ATLAS Route Registry and Module Dispatcher

**Files:**
- Modify: `src/core/routes.js`
- Modify: `src/app.js`
- Create: `src/modules/site-review/site-review-app.js`
- Modify: `tests/routes.test.mjs`

**Interfaces:**
- Produces: `resolveRoute(pathname) -> { id, module, path, params, title, status }`.
- Produces: `mountSiteReviewApp({ route })` from `site-review-app.js`.
- Later tasks consume route ids `aviation-home`, `aviation-aircraft-index`, `aviation-aircraft-detail`, `aviation-certification`, `aviation-saved`, and `aviation-alerts`.

- [ ] **Step 1: Replace the route test with failing multi-module expectations**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRoute } from '../src/core/routes.js';

test('resolves existing Site Review routes', () => {
  assert.equal(resolveRoute('/').id, 'site-review');
  assert.equal(resolveRoute('/sites/review').id, 'site-review');
});

test('resolves Aviation routes and aircraft id params', () => {
  assert.equal(resolveRoute('/mobility/aviation').id, 'aviation-home');
  assert.equal(resolveRoute('/mobility/aviation/aircraft').id, 'aviation-aircraft-index');
  const detail = resolveRoute('/mobility/aviation/aircraft/atlas-one');
  assert.equal(detail.id, 'aviation-aircraft-detail');
  assert.equal(detail.params.aircraftId, 'atlas-one');
  assert.equal(resolveRoute('/mobility/aviation/certification').id, 'aviation-certification');
  assert.equal(resolveRoute('/mobility/aviation/saved').id, 'aviation-saved');
  assert.equal(resolveRoute('/mobility/aviation/alerts').id, 'aviation-alerts');
});

test('normalizes trailing slashes and returns controlled 404s', () => {
  assert.equal(resolveRoute('/mobility/aviation/').id, 'aviation-home');
  assert.equal(resolveRoute('/unknown').status, 404);
});
```

- [ ] **Step 2: Run the route test and verify it fails**

Run: `node --test tests/routes.test.mjs`

Expected: FAIL because Aviation routes are not yet defined.

- [ ] **Step 3: Implement a declarative route resolver**

Replace `src/core/routes.js` with a registry that normalizes paths and matches one dynamic aircraft segment:

```js
const ROUTES = Object.freeze([
  { id: 'site-review', module: 'site-review', pattern: /^\/$|^\/sites\/review$/, title: 'ATLAS Site Review Center' },
  { id: 'aviation-home', module: 'aviation', pattern: /^\/mobility\/aviation$/, title: 'ATLAS Aviation Intelligence' },
  { id: 'aviation-aircraft-index', module: 'aviation', pattern: /^\/mobility\/aviation\/aircraft$/, title: 'Aircraft Intelligence' },
  { id: 'aviation-aircraft-detail', module: 'aviation', pattern: /^\/mobility\/aviation\/aircraft\/([^/]+)$/, title: 'Aircraft Detail', paramNames: ['aircraftId'] },
  { id: 'aviation-certification', module: 'aviation', pattern: /^\/mobility\/aviation\/certification$/, title: 'Certification Tracker' },
  { id: 'aviation-saved', module: 'aviation', pattern: /^\/mobility\/aviation\/saved$/, title: 'Saved Aircraft' },
  { id: 'aviation-alerts', module: 'aviation', pattern: /^\/mobility\/aviation\/alerts$/, title: 'Aviation Alerts' }
]);

function normalizePath(pathname) {
  const raw = String(pathname ?? '/').split('?')[0].split('#')[0];
  if (raw === '/') return '/';
  return `/${raw.replace(/^\/+|\/+$/g, '')}`;
}

export function resolveRoute(pathname) {
  const path = normalizePath(pathname);
  for (const route of ROUTES) {
    const match = path.match(route.pattern);
    if (!match) continue;
    const params = Object.fromEntries((route.paramNames ?? []).map((name, index) => [name, decodeURIComponent(match[index + 1])]));
    return Object.freeze({ ...route, pattern: undefined, paramNames: undefined, path, params, status: 200 });
  }
  return Object.freeze({ id: 'not-found', module: null, path, params: {}, title: 'Not Found', status: 404 });
}
```

- [ ] **Step 4: Extract existing Site Review bootstrap from `src/app.js`**

Move the current Site Review imports, state, DOM references, rendering functions, event listeners, and initialization into `src/modules/site-review/site-review-app.js`. Wrap execution in:

```js
export function mountSiteReviewApp({ route }) {
  if (route.module !== 'site-review') throw new Error('Site Review received an incompatible route');
  // existing Site Review initialization body
}
```

Keep behavior unchanged. Do not refactor Site Review domain logic in this task.

- [ ] **Step 5: Make `src/app.js` a dispatcher**

```js
import { resolveRoute } from './core/routes.js';

const route = resolveRoute(window.location.pathname);

async function boot() {
  if (route.status === 404) {
    document.body.innerHTML = '<main class="panel-empty"><h1>404</h1><p>ATLAS route not found.</p></main>';
    return;
  }

  if (route.module === 'site-review') {
    const { mountSiteReviewApp } = await import('./modules/site-review/site-review-app.js');
    mountSiteReviewApp({ route });
    return;
  }

  if (route.module === 'aviation') {
    const { mountAviationApp } = await import('./modules/aviation/aviation-app.js');
    mountAviationApp({ route });
  }
}

boot().catch((error) => {
  console.error(error);
  document.body.innerHTML = '<main class="panel-empty"><h1>ATLAS error</h1><p>The requested module could not start.</p></main>';
});
```

The Aviation import may fail until Task 7, so do not manually browse Aviation routes before that task. Route unit tests remain deterministic.

- [ ] **Step 6: Run existing and route tests**

Run: `npm test`

Expected: all current tests plus route tests PASS. Site Review tests must remain green.

- [ ] **Step 7: Commit**

```bash
git add src/core/routes.js src/app.js src/modules/site-review/site-review-app.js tests/routes.test.mjs
git commit -m "refactor: add ATLAS module route dispatcher"
```

---

### Task 2: Extend Central Permissions for Aviation

**Files:**
- Modify: `src/core/permissions.js`
- Modify: `tests/permissions.test.mjs`

**Interfaces:**
- Consumes: existing `capabilitiesForRole(role)` and `hasCapability(role, capability)`.
- Produces Aviation capabilities: `aviation.view`, `aviation.search`, `aviation.save`, `aviation.alerts.manage`, `aviation.sources.view`, `aviation.sources.manage`, `aviation.records.manage`, `aviation.investment.view`, `aviation.admin`.

- [ ] **Step 1: Add failing Aviation capability tests**

Append:

```js
test('owner receives every Aviation capability', () => {
  for (const capability of [
    'aviation.view', 'aviation.search', 'aviation.save', 'aviation.alerts.manage',
    'aviation.sources.view', 'aviation.sources.manage', 'aviation.records.manage',
    'aviation.investment.view', 'aviation.admin'
  ]) {
    assert.equal(hasCapability('owner', capability), true);
  }
});

test('client can research and save aircraft but cannot manage evidence or records', () => {
  assert.equal(hasCapability('client', 'aviation.view'), true);
  assert.equal(hasCapability('client', 'aviation.search'), true);
  assert.equal(hasCapability('client', 'aviation.save'), true);
  assert.equal(hasCapability('client', 'aviation.alerts.manage'), true);
  assert.equal(hasCapability('client', 'aviation.sources.manage'), false);
  assert.equal(hasCapability('client', 'aviation.records.manage'), false);
  assert.equal(hasCapability('client', 'aviation.admin'), false);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/permissions.test.mjs`

Expected: FAIL because Aviation capabilities do not exist.

- [ ] **Step 3: Implement role capability groups without duplicating strings**

Use arrays such as:

```js
const AVIATION_RESEARCH = ['aviation.view', 'aviation.search', 'aviation.save', 'aviation.alerts.manage', 'aviation.sources.view', 'aviation.investment.view'];
const AVIATION_MANAGE = ['aviation.sources.manage', 'aviation.records.manage', 'aviation.admin'];
const ALL_AVIATION = [...AVIATION_RESEARCH, ...AVIATION_MANAGE];
```

Owner/admin receive `ALL_AVIATION`; developer receives research plus source/record management; designer/reviewer/client receive research capabilities only. Preserve all existing Site Review capability behavior.

- [ ] **Step 4: Run permission tests**

Run: `node --test tests/permissions.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/permissions.js tests/permissions.test.mjs
git commit -m "feat: add Aviation capabilities"
```

---

### Task 3: Add Truthful Aviation Status and Evidence Rules

**Files:**
- Create: `src/modules/aviation/aviation-status.js`
- Create: `tests/aviation-status.test.mjs`

**Interfaces:**
- Produces: `dataState({ value, lastVerifiedAt, now, staleAfterMs, configured=true, error=null })`.
- Produces: `normalizeCertificationStage(sourceStage)`.
- Produces: `selectEvidence(evidence[]) -> { primary, conflicts }`.
- Evidence trust order: `primary_authority > primary_party > internal_verified > secondary_reputable > unverified`.

- [ ] **Step 1: Write failing tests for all state types and evidence conflicts**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { dataState, normalizeCertificationStage, selectEvidence } from '../src/modules/aviation/aviation-status.js';

const NOW = new Date('2026-09-03T12:00:00Z').getTime();

test('distinguishes not_configured, empty, ready, stale and error', () => {
  assert.equal(dataState({ configured: false, now: NOW }).status, 'not_configured');
  assert.equal(dataState({ value: null, now: NOW }).status, 'empty');
  assert.equal(dataState({ value: 'x', lastVerifiedAt: '2026-09-03T11:00:00Z', now: NOW, staleAfterMs: 7200000 }).status, 'ready');
  assert.equal(dataState({ value: 'x', lastVerifiedAt: '2026-09-01T11:00:00Z', now: NOW, staleAfterMs: 7200000 }).status, 'stale');
  assert.equal(dataState({ error: new Error('source failed'), now: NOW }).status, 'error');
});

test('normalizes common certification language without inventing approval', () => {
  assert.equal(normalizeCertificationStage('flight testing'), 'testing');
  assert.equal(normalizeCertificationStage('type certification issued'), 'approved');
  assert.equal(normalizeCertificationStage('marketing announcement'), 'announced');
  assert.equal(normalizeCertificationStage('unclear wording'), 'unknown');
});

test('prefers higher-trust evidence and preserves conflicting claims', () => {
  const result = selectEvidence([
    { id: 'mfg', trustClass: 'primary_party', claimKey: 'cert.stage', value: 'testing', retrievedAt: '2026-09-03T10:00:00Z' },
    { id: 'faa', trustClass: 'primary_authority', claimKey: 'cert.stage', value: 'review', retrievedAt: '2026-09-03T09:00:00Z' }
  ]);
  assert.equal(result.primary.id, 'faa');
  assert.deepEqual(result.conflicts.map((item) => item.id), ['mfg']);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/aviation-status.test.mjs`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement deterministic state and evidence logic**

`dataState` precedence must be: `error`, `not_configured`, `empty`, `stale`, `ready`. Invalid/missing `lastVerifiedAt` with a non-null value returns `stale`, not `ready`.

`normalizeCertificationStage` must lowercase/trim and map only explicit wording to: `announced`, `application`, `accepted`, `testing`, `review`, `approved`, `operational`, `suspended`, or `unknown`.

`selectEvidence` sorts by trust class first, then newest `retrievedAt`; it returns all entries with a different `value` for the same `claimKey` in `conflicts`.

- [ ] **Step 4: Run status tests**

Run: `node --test tests/aviation-status.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/aviation/aviation-status.js tests/aviation-status.test.mjs
git commit -m "feat: add Aviation evidence truth rules"
```

---

### Task 4: Create the 10-Model ATLAS Concept Catalog and Memory Store

**Files:**
- Create: `src/modules/aviation/aviation-concepts.js`
- Create: `src/modules/aviation/aviation-store.js`
- Create: `tests/aviation-store.test.mjs`

**Interfaces:**
- Produces: `ATLAS_CONCEPT_AIRCRAFT` frozen array.
- Produces: `ATLAS_INTERNAL_SOURCES` frozen array.
- Produces: `createMemoryAviationStore({ aircraft, sources })` with methods `listAircraft()`, `getAircraft(idOrSlug)`, `listSources()`, `getSource(id)`, `saveAircraft(userId, aircraftId)`, `unsaveAircraft(userId, aircraftId)`, `listSavedAircraft(userId)`, `putAlert(rule)`, `listAlerts(userId)`, `setAlertEnabled(userId, ruleId, enabled)`.

- [ ] **Step 1: Write failing deterministic store tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ATLAS_CONCEPT_AIRCRAFT } from '../src/modules/aviation/aviation-concepts.js';
import { createMemoryAviationStore } from '../src/modules/aviation/aviation-store.js';

test('ships exactly ten internal concept aircraft with no invented validated performance metrics', () => {
  assert.equal(ATLAS_CONCEPT_AIRCRAFT.length, 10);
  for (const aircraft of ATLAS_CONCEPT_AIRCRAFT) {
    assert.equal(aircraft.recordClass, 'internal_concept');
    assert.equal(aircraft.certification.status, 'not_configured');
    assert.equal(aircraft.specifications.rangeMiles, null);
    assert.equal(aircraft.specifications.maxSpeedMph, null);
  }
});

test('store returns copies and save toggle is user-scoped', () => {
  const store = createMemoryAviationStore();
  const aircraft = store.listAircraft();
  assert.equal(aircraft.length, 10);
  store.saveAircraft('u1', aircraft[0].id);
  assert.deepEqual(store.listSavedAircraft('u1'), [aircraft[0].id]);
  assert.deepEqual(store.listSavedAircraft('u2'), []);
  store.unsaveAircraft('u1', aircraft[0].id);
  assert.deepEqual(store.listSavedAircraft('u1'), []);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/aviation-store.test.mjs`

Expected: FAIL because catalog/store modules do not exist.

- [ ] **Step 3: Define the approved concept lineup**

Create exactly these internal records, using stable ids/slugs and mission labels:

```js
const LINEUP = [
  ['atlas-a1', 'atlas-a1', 'ATLAS A1', 'Urban Air Taxi'],
  ['atlas-a2', 'atlas-a2', 'ATLAS A2', 'Executive Mobility'],
  ['atlas-a3', 'atlas-a3', 'ATLAS A3', 'Family Mobility'],
  ['atlas-a4', 'atlas-a4', 'ATLAS A4', 'Cargo & Logistics'],
  ['atlas-a5', 'atlas-a5', 'ATLAS A5', 'Emergency & Medical'],
  ['atlas-a6', 'atlas-a6', 'ATLAS A6', 'Security & Response'],
  ['atlas-a7', 'atlas-a7', 'ATLAS A7', 'Exploration & Remote Access'],
  ['atlas-a8', 'atlas-a8', 'ATLAS A8', 'Personal Flight'],
  ['atlas-a9', 'atlas-a9', 'ATLAS A9', 'Autonomous Mobility Research'],
  ['atlas-a10', 'atlas-a10', 'ATLAS A10', 'Hydro / Coastal Mobility']
];
```

Each record includes:

```js
{
  id, slug, displayName, mission,
  manufacturer: 'ATLAS Mobility',
  recordClass: 'internal_concept',
  category: 'advanced_air_mobility',
  propulsion: 'not_validated',
  seatCount: null,
  description: '<mission-specific factual concept description>',
  specifications: { rangeMiles: null, maxSpeedMph: null, payloadLb: null },
  certification: { status: 'not_configured', normalizedStage: 'unknown', evidenceIds: [] },
  investmentProfileId: null,
  sourceIds: ['atlas-concept-2026-09-03'],
  updatedAt: '2026-09-03T00:00:00Z'
}
```

Create source `atlas-concept-2026-09-03` with `sourceType: 'internal'`, `trustClass: 'internal_verified'`, title `ATLAS Aviation concept lineup approval`, and no external URL.

- [ ] **Step 4: Implement the memory store**

Use `Map`/`Set` internally. Validate aircraft ids before save. Return copies to prevent callers mutating store state. Throw `aircraft_not_found` or `alert_not_found` errors with `error.code` set to that identifier.

- [ ] **Step 5: Run store tests**

Run: `node --test tests/aviation-store.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/aviation/aviation-concepts.js src/modules/aviation/aviation-store.js tests/aviation-store.test.mjs
git commit -m "feat: add ATLAS Aviation concept catalog"
```

---

### Task 5: Build Aviation Search, Filters, Detail Composition, and Investment Boundaries

**Files:**
- Create: `src/modules/aviation/aviation-service.js`
- Create: `tests/aviation-service.test.mjs`

**Interfaces:**
- Consumes: `createMemoryAviationStore`, `dataState`, `selectEvidence`.
- Produces: `createAviationService({ store, hasCapability, now=Date.now })`.
- Produces service methods: `searchAircraft({ query='', mission='', recordClass='' })`, `getAircraftDetail(idOrSlug, { role })`, `toggleSaved({ role, userId, aircraftId })`, `listSaved({ role, userId })`, `getCertificationTracker({ role })`, `getInvestmentIntelligence(idOrSlug, { role })`.

- [ ] **Step 1: Write failing search/filter/detail tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryAviationStore } from '../src/modules/aviation/aviation-store.js';
import { createAviationService } from '../src/modules/aviation/aviation-service.js';

const allow = () => true;

test('searches model and mission and combines filters', () => {
  const service = createAviationService({ store: createMemoryAviationStore(), hasCapability: allow });
  assert.equal(service.searchAircraft({ query: 'cargo' }).length, 1);
  assert.equal(service.searchAircraft({ mission: 'Emergency & Medical', recordClass: 'internal_concept' }).length, 1);
  assert.equal(service.searchAircraft({ query: 'zzzz' }).length, 0);
});

test('detail marks engineering metrics as not validated', () => {
  const service = createAviationService({ store: createMemoryAviationStore(), hasCapability: allow });
  const detail = service.getAircraftDetail('atlas-a1', { role: 'owner' });
  assert.equal(detail.specifications.rangeMiles.status, 'not_configured');
  assert.equal(detail.certification.status, 'not_configured');
});

test('investment intelligence is unavailable for internal concepts instead of inventing terms', () => {
  const service = createAviationService({ store: createMemoryAviationStore(), hasCapability: allow });
  const investment = service.getInvestmentIntelligence('atlas-a1', { role: 'owner' });
  assert.equal(investment.status, 'not_configured');
  assert.equal(investment.sharePrice, null);
  assert.equal(investment.minimumInvestment, null);
  assert.equal(investment.officialActionUrl, null);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/aviation-service.test.mjs`

Expected: FAIL because service does not exist.

- [ ] **Step 3: Implement permission-aware service creation**

The constructor must receive `hasCapability(role, capability)`. Add an internal guard:

```js
function requireCapability(role, capability) {
  if (!hasCapability(role, capability)) {
    const error = new Error(`Capability required: ${capability}`);
    error.code = 'capability_required';
    throw error;
  }
}
```

Search requires `aviation.search` only when role is supplied; read detail requires `aviation.view`; investment requires `aviation.investment.view`; save requires `aviation.save`.

- [ ] **Step 4: Implement null-safe detail composition**

For every engineering metric, return:

```js
{
  value: aircraft.specifications.rangeMiles,
  unit: 'mi',
  status: aircraft.specifications.rangeMiles == null ? 'not_configured' : 'ready',
  label: aircraft.specifications.rangeMiles == null ? 'Not validated' : String(aircraft.specifications.rangeMiles)
}
```

Certification for concept aircraft stays `not_configured` with `normalizedStage: 'unknown'`.

- [ ] **Step 5: Implement read-only investment intelligence**

For concept aircraft without `investmentProfileId`, return exactly:

```js
{
  status: 'not_configured',
  offeringClass: null,
  securityType: null,
  sharePrice: null,
  currency: null,
  minimumInvestment: null,
  valuation: null,
  offeringStatus: 'unavailable',
  officialActionUrl: null,
  disclosures: ['No verified investment offering is configured for this aircraft.']
}
```

- [ ] **Step 6: Add save permission tests and implementation**

Add a test where `hasCapability` returns false for `aviation.save` and assert `error.code === 'capability_required'`. Then implement `toggleSaved` and `listSaved` through the store.

- [ ] **Step 7: Run service tests**

Run: `node --test tests/aviation-service.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/aviation/aviation-service.js tests/aviation-service.test.mjs
git commit -m "feat: add Aviation intelligence service"
```

---

### Task 6: Implement Saved Aircraft Alert Rules and Change Evaluation

**Files:**
- Create: `src/modules/aviation/aviation-alerts.js`
- Modify: `src/modules/aviation/aviation-service.js`
- Create: `tests/aviation-alerts.test.mjs`
- Modify: `tests/aviation-service.test.mjs`

**Interfaces:**
- Produces: `validateAlertRule(input) -> normalizedRule`.
- Produces: `evaluateAlertRule(rule, previousSnapshot, currentSnapshot) -> { triggered, eventType, evidenceIds }`.
- Service adds `createAlert({ role, userId, aircraftId, eventTypes })`, `listAlerts({ role, userId })`, `setAlertEnabled({ role, userId, ruleId, enabled })`.

- [ ] **Step 1: Write failing alert validation tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAlertRule, evaluateAlertRule } from '../src/modules/aviation/aviation-alerts.js';

test('accepts only supported Aviation event types', () => {
  const rule = validateAlertRule({ aircraftId: 'atlas-a1', eventTypes: ['certification_stage_changed'] });
  assert.deepEqual(rule.eventTypes, ['certification_stage_changed']);
  assert.throws(() => validateAlertRule({ aircraftId: 'atlas-a1', eventTypes: ['price_every_second'] }), /Unsupported alert event type/);
});

test('does not trigger when evidence-backed state is unchanged', () => {
  const result = evaluateAlertRule(
    { eventTypes: ['certification_stage_changed'] },
    { certificationStage: 'testing', evidenceIds: ['e1'] },
    { certificationStage: 'testing', evidenceIds: ['e1'] }
  );
  assert.equal(result.triggered, false);
});

test('triggers certification change and carries the new evidence ids', () => {
  const result = evaluateAlertRule(
    { eventTypes: ['certification_stage_changed'] },
    { certificationStage: 'testing', evidenceIds: ['e1'] },
    { certificationStage: 'review', evidenceIds: ['e2'] }
  );
  assert.equal(result.triggered, true);
  assert.equal(result.eventType, 'certification_stage_changed');
  assert.deepEqual(result.evidenceIds, ['e2']);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/aviation-alerts.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement supported events and validation**

Supported event types are exactly:

```js
const SUPPORTED_EVENTS = new Set([
  'certification_stage_changed',
  'investment_terms_changed',
  'new_primary_evidence',
  'aircraft_status_changed'
]);
```

Rules require at least one event type and either `aircraftId` or `companyId`.

- [ ] **Step 4: Implement change evaluation**

Compare only fields relevant to the requested event. Never trigger because `lastEvaluatedAt` changed. `new_primary_evidence` triggers only when the current primary evidence id was not present previously.

- [ ] **Step 5: Wire service alert methods with `aviation.alerts.manage` capability**

Use the store methods from Task 4. IDs may be generated deterministically from a monotonic counter in the store; do not use a runtime dependency.

- [ ] **Step 6: Run alert and service tests**

Run: `node --test tests/aviation-alerts.test.mjs tests/aviation-service.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/aviation/aviation-alerts.js src/modules/aviation/aviation-service.js tests/aviation-alerts.test.mjs tests/aviation-service.test.mjs
git commit -m "feat: add Aviation watch alerts"
```

---

### Task 7: Build Pure Aviation View Models Before DOM Rendering

**Files:**
- Create: `src/modules/aviation/aviation-ui.js`
- Create: `tests/aviation-ui.test.mjs`

**Interfaces:**
- Produces: `buildAviationHomeModel({ aircraft, savedIds, query, filters })`.
- Produces: `buildAircraftDetailModel(detail)`.
- Produces: `buildCertificationModel(items)`.
- Produces: `buildInvestmentModel(investment)`.
- Produces: `escapeHtml(value)`.

- [ ] **Step 1: Write failing view-model tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAircraftDetailModel, buildInvestmentModel, escapeHtml } from '../src/modules/aviation/aviation-ui.js';

test('escapes untrusted strings before HTML interpolation', () => {
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
});

test('renders null metrics as Not validated, not zero', () => {
  const model = buildAircraftDetailModel({
    id: 'atlas-a1', displayName: 'ATLAS A1', mission: 'Urban Air Taxi',
    specifications: { rangeMiles: { value: null, status: 'not_configured', label: 'Not validated' } },
    certification: { status: 'not_configured', normalizedStage: 'unknown', evidenceIds: [] },
    sources: []
  });
  assert.equal(model.specRows[0].value, 'Not validated');
});

test('investment model always exposes disclosure when offering is not configured', () => {
  const model = buildInvestmentModel({ status: 'not_configured', sharePrice: null, minimumInvestment: null, disclosures: ['No verified investment offering is configured for this aircraft.'] });
  assert.equal(model.canOpenOffering, false);
  assert.equal(model.disclosures.length, 1);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/aviation-ui.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement pure immutable UI models**

Do not access `document`, `window`, or browser globals. Every user/source string that will be interpolated into HTML must pass through `escapeHtml` in the final renderer. View models should preserve raw values where needed for filtering but expose explicit display values.

- [ ] **Step 4: Add state labels**

Use these visible labels exactly:

```js
const STATE_LABELS = {
  empty: 'No data',
  loading: 'Loading',
  ready: 'Verified data',
  stale: 'Stale data',
  not_configured: 'Not configured',
  error: 'Source error',
  restricted: 'Restricted'
};
```

- [ ] **Step 5: Run UI tests**

Run: `node --test tests/aviation-ui.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/aviation/aviation-ui.js tests/aviation-ui.test.mjs
git commit -m "feat: add Aviation view models"
```

---

### Task 8: Implement the Functional Aviation UI and Approved Visual Direction

**Files:**
- Create: `src/modules/aviation/aviation-app.js`
- Create: `src/modules/aviation/aviation.css`
- Modify: `src/index.html`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `route`, `hasCapability`, memory store, Aviation service, Aviation UI models.
- Produces: `mountAviationApp({ route })`.

- [ ] **Step 1: Generalize `src/index.html` into a shared shell**

Replace Site-Review-only body content with stable mount containers:

```html
<body>
  <div id="atlas-shell" class="app-shell">
    <aside id="atlas-sidebar" class="sidebar" aria-label="ATLAS navigation"></aside>
    <div class="application">
      <header id="atlas-topbar" class="topbar"></header>
      <main id="atlas-module" tabindex="-1"></main>
    </div>
  </div>
  <script type="module" src="/app.js"></script>
</body>
```

Update `mountSiteReviewApp` to render its previous shell content into these containers so Site Review remains functional.

- [ ] **Step 2: Add Aviation stylesheet loading from the module**

In `mountAviationApp`, load `/modules/aviation/aviation.css` once using a `<link data-atlas-module-style="aviation">` element. Do not inline generated screenshot art as a background replacement for the UI.

- [ ] **Step 3: Build shared Aviation navigation**

Sidebar destinations must be real links:

```html
<a href="/mobility/aviation">Overview</a>
<a href="/mobility/aviation/aircraft">Aircraft</a>
<a href="/mobility/aviation/certification">Certification</a>
<a href="/mobility/aviation/saved">Saved Aircraft</a>
<a href="/mobility/aviation/alerts">Alerts</a>
```

Highlight the current route by `aria-current="page"`.

- [ ] **Step 4: Build Aviation home and aircraft index**

Required functional elements:

- Search input with id `aviation-search`.
- Mission filter with id `aviation-mission-filter`.
- Record-class filter with id `aviation-class-filter`.
- Reset button with id `aviation-reset-filters`.
- Aircraft cards generated from service data only.
- Save buttons that call `service.toggleSaved`.
- Empty state when filters produce zero results.

Search reacts on `input`; filters react on `change`; reset clears all controls and rerenders.

- [ ] **Step 5: Build the aircraft detail route with seven functional tabs**

Tabs:

```js
['overview', 'specifications', 'certification', 'company', 'investment', 'documents', 'news']
```

Each tab button uses `role="tab"`, `aria-selected`, and `aria-controls`. Only the active `role="tabpanel"` is visible. Use a horizontal scroll container below 900px.

For the current concept lineup:

- Specifications show `Not validated` for null range/speed/payload.
- Certification shows `Not configured` and explains that no regulator evidence is connected.
- Company identifies `ATLAS Mobility` as the internal concept owner.
- Investment shows the read-only unavailable state and disclosure.
- Documents and News show truthful empty/not-configured states rather than fake entries.

- [ ] **Step 6: Build certification, saved, and alerts routes**

Certification page lists all aircraft with normalized stage and visible source state. Current concept aircraft render `unknown / not configured` rather than a progress percentage.

Saved page lists the current user's saved aircraft and supports removal.

Alerts page allows event-type selection for a chosen aircraft, create, enable, and disable. The page must say “No evidence-change history yet” until evidence changes have actually been evaluated.

- [ ] **Step 7: Implement approved ATLAS Aviation styling**

`aviation.css` uses existing tokens plus module-specific variables:

```css
.aviation-module {
  --aviation-glow: rgba(85, 215, 255, .18);
  --aviation-indigo: rgba(124, 140, 255, .22);
}

.aviation-hero {
  border: 1px solid var(--line);
  border-radius: 22px;
  background:
    radial-gradient(circle at 72% 20%, var(--aviation-glow), transparent 34%),
    linear-gradient(145deg, rgba(15, 35, 60, .96), rgba(5, 13, 25, .98));
  overflow: hidden;
}
```

Use CSS aircraft-media placeholders built from gradient/silhouette framing until approved rendered assets are explicitly added as repository assets. The functional UI must never depend on a poster screenshot.

- [ ] **Step 8: Add responsive behavior**

Desktop >=1180px: full sidebar, hero + evidence rail, multi-card directory.

Tablet 900–1179px: compact sidebar, wrapped filters, evidence below when narrow.

Mobile <900px: hide desktop sidebar, single column, horizontally scrollable tabs, full-width cards, topbar navigation trigger, no horizontal page overflow.

Use existing breakpoints rather than inventing a second responsive system.

- [ ] **Step 9: Perform browser interaction checks locally**

Run: `npm start`

Verify manually:

- `/mobility/aviation`
- `/mobility/aviation/aircraft`
- `/mobility/aviation/aircraft/atlas-a1`
- `/mobility/aviation/certification`
- `/mobility/aviation/saved`
- `/mobility/aviation/alerts`
- `/sites/review`

Check search, filters, tabs, save, alert create/disable, keyboard focus, empty states, and mobile widths.

- [ ] **Step 10: Commit**

```bash
git add src/index.html src/styles.css src/modules/site-review/site-review-app.js src/modules/aviation/aviation-app.js src/modules/aviation/aviation.css
git commit -m "feat: build ATLAS Aviation interface"
```

---

### Task 9: Serve Aviation SPA Routes and Protect Existing Server Behavior

**Files:**
- Modify: `server.mjs`
- Modify: `tests/server.test.mjs`

**Interfaces:**
- Consumes: recognized frontend route prefixes.
- Produces: HTTP 200 with `index.html` for all valid Aviation app routes; still returns 404 for unknown non-file paths.

- [ ] **Step 1: Add failing server tests for Aviation routes**

Extend the existing server test using its current temporary server helper:

```js
for (const path of [
  '/mobility/aviation',
  '/mobility/aviation/aircraft',
  '/mobility/aviation/aircraft/atlas-a1',
  '/mobility/aviation/certification',
  '/mobility/aviation/saved',
  '/mobility/aviation/alerts'
]) {
  const response = await fetch(`${baseUrl}${path}`);
  assert.equal(response.status, 200, path);
  assert.match(await response.text(), /id="atlas-shell"/);
}
```

Keep existing assertions that assets return 200 and unknown routes return 404.

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/server.test.mjs`

Expected: FAIL because `safeTarget` only maps `/` and `/sites/review` to `index.html`.

- [ ] **Step 3: Add an explicit app-route matcher**

```js
function isAppRoute(pathname) {
  if (pathname === '/' || /^\/sites\/review\/?$/.test(pathname)) return true;
  return /^\/mobility\/aviation(?:\/aircraft(?:\/[^/]+)?|\/certification|\/saved|\/alerts)?\/?$/.test(pathname);
}
```

In `safeTarget`, map `isAppRoute(pathname) ? '/index.html' : pathname`.

Do not create a blanket catch-all fallback because unknown routes must remain real 404s.

- [ ] **Step 4: Update server startup message**

Change the console line from Site Review-specific wording to:

```js
console.log(`ATLAS Enterprise Suite listening on http://0.0.0.0:${port}`);
```

- [ ] **Step 5: Run server and full tests**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server.mjs tests/server.test.mjs
git commit -m "feat: serve Aviation application routes"
```

---

### Task 10: Final Regression, Truthfulness, Accessibility, and Release Gate

**Files:**
- Modify only files required by failures discovered in this gate.
- No feature expansion is allowed in this task.

**Interfaces:**
- Produces: verified implementation ready for code review/PR, not a production claim.

- [ ] **Step 1: Run syntax checks**

Run:

```bash
node --check src/app.js
node --check src/modules/site-review/site-review-app.js
node --check src/modules/aviation/aviation-app.js
node --check src/modules/aviation/aviation-service.js
node --check src/modules/aviation/aviation-store.js
node --check src/modules/aviation/aviation-status.js
node --check src/modules/aviation/aviation-alerts.js
node --check src/modules/aviation/aviation-ui.js
node --check server.mjs
```

Expected: every command exits 0.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test`

Expected: 0 failures.

- [ ] **Step 3: Scan for forbidden fake-production language and placeholders**

Run:

```bash
grep -RniE "coming soon|href=\"#\"|console\.log\(|100% functional|certified|live connection|guaranteed return|complete your investment" src/modules/aviation src/index.html || true
```

Review every match. Allowed matches must be factual explanatory copy such as “not certified” or status labels. Remove placeholder actions, fake connectivity, and transaction language.

- [ ] **Step 4: Scan for invented aircraft performance values**

Run:

```bash
grep -RniE "mph|miles|payload|sharePrice|minimumInvestment|valuation" src/modules/aviation
```

Expected: implementation keys/labels may match, but concept records must keep unvalidated numeric values `null`. Any non-null production-looking number requires source evidence or removal.

- [ ] **Step 5: Scan for obvious secret material**

Run:

```bash
grep -RniE "BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|sk-[A-Za-z0-9]|api[_-]?key\s*[:=]|token\s*[:=]" src tests || true
```

Expected: no secrets.

- [ ] **Step 6: Manual responsive/accessibility gate**

At desktop, tablet, and mobile widths verify:

- no horizontal document overflow,
- visible focus states,
- tab keyboard navigation reaches every tab button,
- `aria-selected` changes correctly,
- active navigation has `aria-current`,
- buttons have visible labels,
- status meaning remains understandable without color,
- restricted/not-configured/empty states are distinct,
- Site Review still works.

- [ ] **Step 7: HTTP gate**

With `npm start`, verify valid routes return 200 and `/does-not-exist` returns 404.

- [ ] **Step 8: Commit only if the verification gate required fixes**

```bash
git add <only-files-fixed-by-gate>
git commit -m "fix: close Aviation verification findings"
```

If no changes were required, do not create an empty commit.

- [ ] **Step 9: Prepare implementation evidence for review**

Report exact test counts, syntax-check results, HTTP route results, truthfulness-scan results, and known limitations. Do not claim deployment or production until a separate authorized deploy gate is executed and verified.

---

## Implementation Completion Definition

This plan is complete only when all ten tasks pass their own test cycle and the final gate confirms:

1. The existing Site Review module still works.
2. Every Aviation route is reachable without 404.
3. The 10 ATLAS aircraft appear as clearly labeled internal concepts.
4. No unvalidated range, speed, payload, share price, valuation, or certification claim is shown as fact.
5. Search, filters, tabs, save, and alert management are functional.
6. Certification and investment surfaces show truthful `not_configured` states until evidence exists.
7. Permission checks are centralized and enforced by services.
8. Desktop, tablet, and mobile layouts are usable.
9. Full tests and syntax checks pass.
10. No deployment claim is made without separate production evidence.
