# ATLAS Aviation Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first functional ATLAS Mobility → Aviation experience with a 10-model ATLAS concept-aircraft catalog, evidence-aware aircraft detail, certification intelligence, read-only investment intelligence, saved aircraft, alerts, responsive navigation, and truthful empty/stale/restricted states without inventing production metrics.

**Architecture:** Extend the existing zero-runtime-dependency Node 22 ATLAS foundation instead of creating a second application shell. Convert the current single-module router/app entry into a small module registry, keep Site Review isolated, and add `src/modules/aviation/` with focused status, concept-data, store, service, alert, view-model, and UI files. The first persistence layer remains in memory, but all UI consumers call a service boundary so durable storage can replace it later.

**Tech Stack:** Node.js >=22, native ES modules, `node:test`, `node:assert/strict`, vanilla HTML/CSS/JavaScript, existing static `server.mjs`, zero runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-03-aviation-intelligence-design.md`

## Global Constraints

- Node.js must remain `>=22`.
- Keep zero runtime dependencies for this implementation.
- Do not copy Doroni, Instagram, manufacturer, or third-party proprietary UI/assets.
- Do not present share price, valuation, market size, range, speed, certification, delivery, funding, or availability as production truth without evidence.
- The initial ATLAS aircraft lineup is internal concept data; all unvalidated engineering metrics remain `null` and render as `Not validated`.
- No securities transaction execution. Investment actions are read-only intelligence plus official-source links when available.
- Distinguish `empty`, `loading`, `ready`, `stale`, `not_configured`, `error`, and `restricted` states.
- All sensitive editing capabilities remain authorization-gated even though editing UI is not part of this slice.
- Existing `/sites/review` behavior and tests must not regress.
- No production, connected, certified, live, or operational claim without evidence.

---

## File Structure

### Core files modified
- `src/core/routes.js` — declarative route registry and Aviation route matching.
- `src/core/permissions.js` — central Aviation capabilities.
- `src/app.js` — thin route dispatcher.
- `src/index.html` — shared ATLAS shell containers.
- `src/styles.css` — shared tokens and shell/responsive primitives.
- `server.mjs` — explicit SPA route serving.

### Site Review file created/modified
- `src/modules/site-review/site-review-app.js` — receives the existing Site Review browser bootstrap currently embedded in `src/app.js`.

### Aviation files created
- `src/modules/aviation/aviation-concepts.js` — 10 approved internal ATLAS concept records and internal provenance.
- `src/modules/aviation/aviation-status.js` — state enums, stale calculation, certification normalization, evidence precedence/conflicts.
- `src/modules/aviation/aviation-store.js` — deterministic in-memory aircraft/save/alert repository.
- `src/modules/aviation/aviation-service.js` — search, filters, detail composition, save toggles, certification/investment read models.
- `src/modules/aviation/aviation-alerts.js` — alert validation and evidence-change evaluation.
- `src/modules/aviation/aviation-ui.js` — pure view models and escaping helpers.
- `src/modules/aviation/aviation-app.js` — DOM mount/render/event orchestration.
- `src/modules/aviation/aviation.css` — approved ATLAS Aviation blue-black visual layer.

### Tests
- Modify: `tests/routes.test.mjs`, `tests/permissions.test.mjs`, `tests/server.test.mjs`.
- Create: `tests/aviation-status.test.mjs`, `tests/aviation-store.test.mjs`, `tests/aviation-service.test.mjs`, `tests/aviation-alerts.test.mjs`, `tests/aviation-ui.test.mjs`.

---

### Task 1: Generalize the ATLAS Route Registry and Dispatcher

**Files:**
- Modify: `src/core/routes.js`
- Modify: `src/app.js`
- Create: `src/modules/site-review/site-review-app.js`
- Modify: `tests/routes.test.mjs`

**Interfaces:**
- Produces: `resolveRoute(pathname) -> { id, module, path, params, title, status }`.
- Produces: `mountSiteReviewApp({ route })`.
- Later tasks consume route ids `aviation-home`, `aviation-aircraft-index`, `aviation-aircraft-detail`, `aviation-certification`, `aviation-saved`, `aviation-alerts`.

- [ ] **Step 1: Write failing multi-module route tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRoute } from '../src/core/routes.js';

test('resolves existing Site Review routes', () => {
  assert.equal(resolveRoute('/').id, 'site-review');
  assert.equal(resolveRoute('/sites/review').id, 'site-review');
});

test('resolves Aviation routes and aircraft params', () => {
  assert.equal(resolveRoute('/mobility/aviation').id, 'aviation-home');
  assert.equal(resolveRoute('/mobility/aviation/aircraft').id, 'aviation-aircraft-index');
  const detail = resolveRoute('/mobility/aviation/aircraft/atlas-a1');
  assert.equal(detail.id, 'aviation-aircraft-detail');
  assert.equal(detail.params.aircraftId, 'atlas-a1');
  assert.equal(resolveRoute('/mobility/aviation/certification').id, 'aviation-certification');
  assert.equal(resolveRoute('/mobility/aviation/saved').id, 'aviation-saved');
  assert.equal(resolveRoute('/mobility/aviation/alerts').id, 'aviation-alerts');
});

test('normalizes trailing slashes and returns controlled 404s', () => {
  assert.equal(resolveRoute('/mobility/aviation/').id, 'aviation-home');
  assert.equal(resolveRoute('/unknown').status, 404);
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `node --test tests/routes.test.mjs`

Expected: FAIL because Aviation routes are absent.

- [ ] **Step 3: Implement the route registry**

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
    return Object.freeze({ id: route.id, module: route.module, path, params, title: route.title, status: 200 });
  }
  return Object.freeze({ id: 'not-found', module: null, path, params: {}, title: 'Not Found', status: 404 });
}
```

- [ ] **Step 4: Extract Site Review browser bootstrap without changing behavior**

Move the existing Site Review-specific imports and all browser initialization code currently in `src/app.js` into `src/modules/site-review/site-review-app.js`. The move begins with the imports of `hasCapability`, review store/service, audit engine, and Site Review UI helpers, and includes the existing state, DOM lookups, render functions, event listeners, and initialization calls. Remove only the current `resolveRoute` import and unsupported-route guard. Wrap the moved browser initialization in:

```js
export function mountSiteReviewApp({ route }) {
  if (route.module !== 'site-review') {
    throw new Error('Site Review received an incompatible route');
  }
  // the moved Site Review initialization executes here, unchanged
}
```

The comment above is descriptive documentation inside the plan, not code to ship. The implementation must contain the moved existing code, not that comment.

- [ ] **Step 5: Replace `src/app.js` with the dispatcher**

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

- [ ] **Step 6: Run regression tests**

Run: `npm test`

Expected: all current tests and route tests PASS.

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
- Adds: `aviation.view`, `aviation.search`, `aviation.save`, `aviation.alerts.manage`, `aviation.sources.view`, `aviation.sources.manage`, `aviation.records.manage`, `aviation.investment.view`, `aviation.admin`.

- [ ] **Step 1: Add failing capability tests**

```js
test('owner receives every Aviation capability', () => {
  for (const capability of [
    'aviation.view', 'aviation.search', 'aviation.save', 'aviation.alerts.manage',
    'aviation.sources.view', 'aviation.sources.manage', 'aviation.records.manage',
    'aviation.investment.view', 'aviation.admin'
  ]) assert.equal(hasCapability('owner', capability), true);
});

test('client can research and save but cannot manage Aviation records', () => {
  assert.equal(hasCapability('client', 'aviation.view'), true);
  assert.equal(hasCapability('client', 'aviation.search'), true);
  assert.equal(hasCapability('client', 'aviation.save'), true);
  assert.equal(hasCapability('client', 'aviation.alerts.manage'), true);
  assert.equal(hasCapability('client', 'aviation.sources.manage'), false);
  assert.equal(hasCapability('client', 'aviation.records.manage'), false);
  assert.equal(hasCapability('client', 'aviation.admin'), false);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test tests/permissions.test.mjs`

- [ ] **Step 3: Implement capability groups**

```js
const AVIATION_RESEARCH = [
  'aviation.view', 'aviation.search', 'aviation.save', 'aviation.alerts.manage',
  'aviation.sources.view', 'aviation.investment.view'
];
const AVIATION_MANAGE = ['aviation.sources.manage', 'aviation.records.manage', 'aviation.admin'];
const ALL_AVIATION = [...AVIATION_RESEARCH, ...AVIATION_MANAGE];
```

Owner/admin receive `ALL_AVIATION`; developer receives research plus source/record management; designer/reviewer/client receive `AVIATION_RESEARCH`. Preserve all existing Site Review capabilities.

- [ ] **Step 4: Run tests**

Run: `node --test tests/permissions.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/permissions.js tests/permissions.test.mjs
git commit -m "feat: add Aviation capabilities"
```

---

### Task 3: Add Truthful Status and Evidence Rules

**Files:**
- Create: `src/modules/aviation/aviation-status.js`
- Create: `tests/aviation-status.test.mjs`

**Interfaces:**
- `dataState({ value, lastVerifiedAt, now, staleAfterMs, configured=true, error=null })`.
- `normalizeCertificationStage(sourceStage)`.
- `selectEvidence(evidence[]) -> { primary, conflicts }`.

- [ ] **Step 1: Write failing tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { dataState, normalizeCertificationStage, selectEvidence } from '../src/modules/aviation/aviation-status.js';

const NOW = new Date('2026-09-03T12:00:00Z').getTime();

test('distinguishes data states', () => {
  assert.equal(dataState({ configured: false, now: NOW }).status, 'not_configured');
  assert.equal(dataState({ value: null, now: NOW }).status, 'empty');
  assert.equal(dataState({ value: 'x', lastVerifiedAt: '2026-09-03T11:00:00Z', now: NOW, staleAfterMs: 7200000 }).status, 'ready');
  assert.equal(dataState({ value: 'x', lastVerifiedAt: '2026-09-01T11:00:00Z', now: NOW, staleAfterMs: 7200000 }).status, 'stale');
  assert.equal(dataState({ error: new Error('source failed'), now: NOW }).status, 'error');
});

test('normalizes certification wording without inventing approval', () => {
  assert.equal(normalizeCertificationStage('flight testing'), 'testing');
  assert.equal(normalizeCertificationStage('type certification issued'), 'approved');
  assert.equal(normalizeCertificationStage('marketing announcement'), 'announced');
  assert.equal(normalizeCertificationStage('unclear wording'), 'unknown');
});

test('prefers authority evidence and preserves conflicts', () => {
  const result = selectEvidence([
    { id: 'mfg', trustClass: 'primary_party', claimKey: 'cert.stage', value: 'testing', retrievedAt: '2026-09-03T10:00:00Z' },
    { id: 'faa', trustClass: 'primary_authority', claimKey: 'cert.stage', value: 'review', retrievedAt: '2026-09-03T09:00:00Z' }
  ]);
  assert.equal(result.primary.id, 'faa');
  assert.deepEqual(result.conflicts.map((item) => item.id), ['mfg']);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test tests/aviation-status.test.mjs`

- [ ] **Step 3: Implement deterministic logic**

Use state precedence `error > not_configured > empty > stale > ready`. A non-null value with invalid/missing `lastVerifiedAt` is `stale`. Certification output is limited to `announced`, `application`, `accepted`, `testing`, `review`, `approved`, `operational`, `suspended`, `unknown`. Evidence trust order is `primary_authority > primary_party > internal_verified > secondary_reputable > unverified`, with newest retrieval time breaking ties.

- [ ] **Step 4: Run tests and commit**

Run: `node --test tests/aviation-status.test.mjs`

```bash
git add src/modules/aviation/aviation-status.js tests/aviation-status.test.mjs
git commit -m "feat: add Aviation evidence truth rules"
```

---

### Task 4: Create the 10-Model Concept Catalog and Memory Store

**Files:**
- Create: `src/modules/aviation/aviation-concepts.js`
- Create: `src/modules/aviation/aviation-store.js`
- Create: `tests/aviation-store.test.mjs`

**Interfaces:**
- `ATLAS_CONCEPT_AIRCRAFT` frozen array.
- `ATLAS_INTERNAL_SOURCES` frozen array.
- `createMemoryAviationStore()` with aircraft/source/save/alert methods.

- [ ] **Step 1: Write failing store tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ATLAS_CONCEPT_AIRCRAFT } from '../src/modules/aviation/aviation-concepts.js';
import { createMemoryAviationStore } from '../src/modules/aviation/aviation-store.js';

test('ships exactly ten internal concepts with no invented performance metrics', () => {
  assert.equal(ATLAS_CONCEPT_AIRCRAFT.length, 10);
  for (const aircraft of ATLAS_CONCEPT_AIRCRAFT) {
    assert.equal(aircraft.recordClass, 'internal_concept');
    assert.equal(aircraft.certification.status, 'not_configured');
    assert.equal(aircraft.specifications.rangeMiles, null);
    assert.equal(aircraft.specifications.maxSpeedMph, null);
  }
});

test('save state is user scoped', () => {
  const store = createMemoryAviationStore();
  const aircraft = store.listAircraft();
  store.saveAircraft('u1', aircraft[0].id);
  assert.deepEqual(store.listSavedAircraft('u1'), [aircraft[0].id]);
  assert.deepEqual(store.listSavedAircraft('u2'), []);
  store.unsaveAircraft('u1', aircraft[0].id);
  assert.deepEqual(store.listSavedAircraft('u1'), []);
});
```

- [ ] **Step 2: Define the lineup exactly**

```js
const LINEUP = [
  ['atlas-a1', 'ATLAS A1', 'Urban Air Taxi', 'A compact concept for short urban mobility research.'],
  ['atlas-a2', 'ATLAS A2', 'Executive Mobility', 'A premium passenger concept for business-oriented regional mobility research.'],
  ['atlas-a3', 'ATLAS A3', 'Family Mobility', 'A multi-passenger concept focused on family and small-group mobility research.'],
  ['atlas-a4', 'ATLAS A4', 'Cargo & Logistics', 'An uncrewed-or-crewed cargo concept for logistics and supply missions.'],
  ['atlas-a5', 'ATLAS A5', 'Emergency & Medical', 'An emergency-response concept intended for future medical transport research.'],
  ['atlas-a6', 'ATLAS A6', 'Security & Response', 'A public-safety and infrastructure-response concept for authorized operations research.'],
  ['atlas-a7', 'ATLAS A7', 'Exploration & Remote Access', 'A remote-access concept for research, tourism, and difficult-terrain missions.'],
  ['atlas-a8', 'ATLAS A8', 'Personal Flight', 'A small personal-mobility concept for individual flight research.'],
  ['atlas-a9', 'ATLAS A9', 'Autonomous Mobility Research', 'A research concept for future automation and supervised autonomous-flight systems.'],
  ['atlas-a10', 'ATLAS A10', 'Hydro / Coastal Mobility', 'A coastal-mobility concept exploring compatible land-and-water operations.']
];
```

Each aircraft is built with stable slug equal to id, `manufacturer: 'ATLAS Mobility'`, `recordClass: 'internal_concept'`, `category: 'advanced_air_mobility'`, `propulsion: 'not_validated'`, `seatCount: null`, all engineering metrics `null`, certification `not_configured/unknown`, `investmentProfileId: null`, source `atlas-concept-2026-09-03`, and `updatedAt: '2026-09-03T00:00:00Z'`.

- [ ] **Step 3: Add internal provenance**

```js
export const ATLAS_INTERNAL_SOURCES = Object.freeze([Object.freeze({
  id: 'atlas-concept-2026-09-03',
  sourceType: 'internal',
  publisher: 'ATLAS Mobility',
  title: 'ATLAS Aviation concept lineup approval',
  canonicalUrl: null,
  retrievedAt: '2026-09-03T00:00:00Z',
  trustClass: 'internal_verified',
  status: 'ready'
})]);
```

- [ ] **Step 4: Implement memory store methods**

Methods: `listAircraft`, `getAircraft`, `listSources`, `getSource`, `saveAircraft`, `unsaveAircraft`, `listSavedAircraft`, `putAlert`, `listAlerts`, `setAlertEnabled`. Use `Map`/`Set`, return copies, validate ids, and set `error.code` to `aircraft_not_found` or `alert_not_found` for missing records.

- [ ] **Step 5: Run tests and commit**

Run: `node --test tests/aviation-store.test.mjs`

```bash
git add src/modules/aviation/aviation-concepts.js src/modules/aviation/aviation-store.js tests/aviation-store.test.mjs
git commit -m "feat: add ATLAS Aviation concept catalog"
```

---

### Task 5: Build Search, Filters, Detail, Save, Certification, and Investment Read Models

**Files:**
- Create: `src/modules/aviation/aviation-service.js`
- Create: `tests/aviation-service.test.mjs`

**Interfaces:**
- `createAviationService({ store, hasCapability, now=Date.now })`.
- Methods: `searchAircraft`, `getAircraftDetail`, `toggleSaved`, `listSaved`, `getCertificationTracker`, `getInvestmentIntelligence`.

- [ ] **Step 1: Write failing service tests**

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

test('detail keeps engineering metrics unvalidated', () => {
  const service = createAviationService({ store: createMemoryAviationStore(), hasCapability: allow });
  const detail = service.getAircraftDetail('atlas-a1', { role: 'owner' });
  assert.equal(detail.specifications.rangeMiles.status, 'not_configured');
  assert.equal(detail.certification.status, 'not_configured');
});

test('investment intelligence is unavailable instead of invented', () => {
  const service = createAviationService({ store: createMemoryAviationStore(), hasCapability: allow });
  const investment = service.getInvestmentIntelligence('atlas-a1', { role: 'owner' });
  assert.equal(investment.status, 'not_configured');
  assert.equal(investment.sharePrice, null);
  assert.equal(investment.minimumInvestment, null);
  assert.equal(investment.officialActionUrl, null);
});
```

- [ ] **Step 2: Implement authorization guard**

```js
function requireCapability(role, capability) {
  if (!hasCapability(role, capability)) {
    const error = new Error(`Capability required: ${capability}`);
    error.code = 'capability_required';
    throw error;
  }
}
```

Detail requires `aviation.view`, investment requires `aviation.investment.view`, save requires `aviation.save`, alerts later require `aviation.alerts.manage`.

- [ ] **Step 3: Implement null-safe metric models**

For each engineering field return `{ value, unit, status, label }`; null values use status `not_configured` and label `Not validated`, never `0`.

- [ ] **Step 4: Implement investment unavailable result exactly**

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

- [ ] **Step 5: Add permission/save tests**

Test that denied `aviation.save` throws with `error.code === 'capability_required'`. Test save toggles on first call and off on second call for the same user/aircraft.

- [ ] **Step 6: Run tests and commit**

Run: `node --test tests/aviation-service.test.mjs`

```bash
git add src/modules/aviation/aviation-service.js tests/aviation-service.test.mjs
git commit -m "feat: add Aviation intelligence service"
```

---

### Task 6: Implement Alert Rules and Evidence-Change Evaluation

**Files:**
- Create: `src/modules/aviation/aviation-alerts.js`
- Modify: `src/modules/aviation/aviation-service.js`
- Create: `tests/aviation-alerts.test.mjs`
- Modify: `tests/aviation-service.test.mjs`

**Interfaces:**
- `validateAlertRule(input)`.
- `evaluateAlertRule(rule, previousSnapshot, currentSnapshot)`.
- Service adds `createAlert`, `listAlerts`, `setAlertEnabled`.

- [ ] **Step 1: Write failing alert tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAlertRule, evaluateAlertRule } from '../src/modules/aviation/aviation-alerts.js';

test('accepts only supported event types', () => {
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

test('triggers certification change and carries new evidence ids', () => {
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

- [ ] **Step 2: Implement supported event set**

```js
const SUPPORTED_EVENTS = new Set([
  'certification_stage_changed',
  'investment_terms_changed',
  'new_primary_evidence',
  'aircraft_status_changed'
]);
```

Rules require at least one event and either `aircraftId` or `companyId`. Evaluation compares only relevant fields and never triggers solely because `lastEvaluatedAt` changed.

- [ ] **Step 3: Wire service methods with `aviation.alerts.manage`**

Persist through the Task 4 store. Use a monotonic in-store rule counter for deterministic ids.

- [ ] **Step 4: Run tests and commit**

Run: `node --test tests/aviation-alerts.test.mjs tests/aviation-service.test.mjs`

```bash
git add src/modules/aviation/aviation-alerts.js src/modules/aviation/aviation-service.js tests/aviation-alerts.test.mjs tests/aviation-service.test.mjs
git commit -m "feat: add Aviation watch alerts"
```

---

### Task 7: Build Pure Aviation View Models

**Files:**
- Create: `src/modules/aviation/aviation-ui.js`
- Create: `tests/aviation-ui.test.mjs`

**Interfaces:**
- `buildAviationHomeModel`, `buildAircraftDetailModel`, `buildCertificationModel`, `buildInvestmentModel`, `escapeHtml`.

- [ ] **Step 1: Write failing UI-model tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAircraftDetailModel, buildInvestmentModel, escapeHtml } from '../src/modules/aviation/aviation-ui.js';

test('escapes untrusted strings', () => {
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
});

test('renders null metrics as Not validated', () => {
  const model = buildAircraftDetailModel({
    id: 'atlas-a1', displayName: 'ATLAS A1', mission: 'Urban Air Taxi',
    specifications: { rangeMiles: { value: null, status: 'not_configured', label: 'Not validated' } },
    certification: { status: 'not_configured', normalizedStage: 'unknown', evidenceIds: [] },
    sources: []
  });
  assert.equal(model.specRows[0].value, 'Not validated');
});

test('investment model exposes disclosure and no offering action when unconfigured', () => {
  const model = buildInvestmentModel({
    status: 'not_configured', sharePrice: null, minimumInvestment: null,
    officialActionUrl: null,
    disclosures: ['No verified investment offering is configured for this aircraft.']
  });
  assert.equal(model.canOpenOffering, false);
  assert.equal(model.disclosures.length, 1);
});
```

- [ ] **Step 2: Implement pure models with no browser globals**

Use visible state labels exactly:

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

- [ ] **Step 3: Run tests and commit**

Run: `node --test tests/aviation-ui.test.mjs`

```bash
git add src/modules/aviation/aviation-ui.js tests/aviation-ui.test.mjs
git commit -m "feat: add Aviation view models"
```

---

### Task 8: Implement Functional Aviation UI and Approved Visual Direction

**Files:**
- Create: `src/modules/aviation/aviation-app.js`
- Create: `src/modules/aviation/aviation.css`
- Modify: `src/index.html`
- Modify: `src/styles.css`
- Modify: `src/modules/site-review/site-review-app.js`

**Interfaces:**
- Produces: `mountAviationApp({ route })`.

- [ ] **Step 1: Generalize `src/index.html` into shared shell containers**

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

Update `mountSiteReviewApp` to render its existing Site Review shell markup into these three containers before binding its existing events.

- [ ] **Step 2: Load `aviation.css` once**

`mountAviationApp` creates a `<link rel="stylesheet" href="/modules/aviation/aviation.css" data-atlas-module-style="aviation">` only if one is not already present.

- [ ] **Step 3: Render real Aviation navigation**

```html
<a href="/mobility/aviation">Overview</a>
<a href="/mobility/aviation/aircraft">Aircraft</a>
<a href="/mobility/aviation/certification">Certification</a>
<a href="/mobility/aviation/saved">Saved Aircraft</a>
<a href="/mobility/aviation/alerts">Alerts</a>
```

Current route receives `aria-current="page"`.

- [ ] **Step 4: Build Aviation home/index controls**

Required ids: `aviation-search`, `aviation-mission-filter`, `aviation-class-filter`, `aviation-reset-filters`. Search rerenders on `input`; filters on `change`; reset clears all values. Cards come only from service records and save buttons call `service.toggleSaved`.

- [ ] **Step 5: Build aircraft detail with seven working tabs**

Tabs are exactly `overview`, `specifications`, `certification`, `company`, `investment`, `documents`, `news`. Use `role="tab"`, `aria-selected`, `aria-controls`, and one visible `role="tabpanel"`. Current concept data displays `Not validated`, `Not configured`, or truthful empty states. Investment has no `Complete your investment` action.

- [ ] **Step 6: Build certification, saved, and alerts pages**

Certification lists every aircraft with `unknown / Not configured` until regulator evidence exists. Saved supports removal. Alerts supports aircraft selection, event selection, create, enable, disable, and shows `No evidence-change history yet` before real evaluations exist.

- [ ] **Step 7: Apply approved Aviation styling without using poster screenshots as UI**

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

Use CSS-based media placeholders until approved generated aircraft art is deliberately added as repository assets. The application remains fully usable without those images.

- [ ] **Step 8: Add responsive rules**

At `>=1180px`: full sidebar, wide hero/evidence layout. At `900–1179px`: compact sidebar and wrapped filters. At `<900px`: no desktop sidebar, single column, horizontally scrollable tabs, full-width cards, no document-level horizontal overflow.

- [ ] **Step 9: Manual interaction check**

Run `npm start` and verify all six Aviation routes plus `/sites/review`; test search, filters, tabs, save, alert create/disable, keyboard focus, truthful empty states, and mobile layout.

- [ ] **Step 10: Commit**

```bash
git add src/index.html src/styles.css src/modules/site-review/site-review-app.js src/modules/aviation/aviation-app.js src/modules/aviation/aviation.css
git commit -m "feat: build ATLAS Aviation interface"
```

---

### Task 9: Serve Aviation Routes and Preserve Real 404s

**Files:**
- Modify: `server.mjs`
- Modify: `tests/server.test.mjs`

**Interfaces:**
- Valid Aviation application paths serve `index.html` with HTTP 200.
- Unknown paths remain HTTP 404.

- [ ] **Step 1: Add failing server checks**

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

- [ ] **Step 2: Verify failure**

Run: `node --test tests/server.test.mjs`

- [ ] **Step 3: Add explicit app-route matcher**

```js
function isAppRoute(pathname) {
  if (pathname === '/' || /^\/sites\/review\/?$/.test(pathname)) return true;
  return /^\/mobility\/aviation(?:\/aircraft(?:\/[^/]+)?|\/certification|\/saved|\/alerts)?\/?$/.test(pathname);
}
```

In `safeTarget`, use `isAppRoute(pathname) ? '/index.html' : pathname`. Do not add a blanket SPA catch-all.

- [ ] **Step 4: Generalize startup log**

```js
console.log(`ATLAS Enterprise Suite listening on http://0.0.0.0:${port}`);
```

- [ ] **Step 5: Run full tests and commit**

Run: `npm test`

```bash
git add server.mjs tests/server.test.mjs
git commit -m "feat: serve Aviation application routes"
```

---

### Task 10: Final Regression, Truthfulness, Accessibility, and Release Gate

**Files:**
- Modify only files that fail this gate; do not expand scope.

**Interfaces:**
- Produces verified implementation evidence for review, not a production/deployment claim.

- [ ] **Step 1: Run syntax checks**

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

- [ ] **Step 2: Run complete tests**

Run: `npm test`

Expected: 0 failures.

- [ ] **Step 3: Scan for fake-production/placeholder language**

```bash
grep -RniE "coming soon|href=\"#\"|100% functional|guaranteed return|complete your investment" src/modules/aviation src/index.html || true
```

Expected: no matches. If there is a match, remove it unless it is part of a test explicitly asserting forbidden copy.

- [ ] **Step 4: Scan performance/investment fields**

```bash
grep -RniE "maxSpeedMph|rangeMiles|payloadLb|sharePrice|minimumInvestment|valuation" src/modules/aviation
```

Expected: keys/labels exist, but the ten internal concept records keep these unvalidated numeric fields `null`.

- [ ] **Step 5: Scan for obvious secrets**

```bash
grep -RniE "BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|sk-[A-Za-z0-9]|api[_-]?key\s*[:=]|token\s*[:=]" src tests || true
```

Expected: no secret material.

- [ ] **Step 6: Manual accessibility/responsive gate**

Verify desktop/tablet/mobile: no horizontal document overflow, visible focus, tab keyboard reachability, correct `aria-selected`, current nav `aria-current`, labelled buttons, status understandable without color, distinct restricted/not-configured/empty states, and Site Review regression-free.

- [ ] **Step 7: HTTP gate**

With `npm start`, verify all valid Aviation routes and `/sites/review` return 200 and `/does-not-exist` returns 404.

- [ ] **Step 8: Commit gate fixes only when changes were required**

If tracked files changed because of this gate, run:

```bash
git add -u
git commit -m "fix: close Aviation verification findings"
```

If nothing changed, do not create an empty commit.

- [ ] **Step 9: Report evidence**

Report exact test counts, syntax-check results, HTTP route results, scan results, and known limitations. Do not claim production until a separate authorized deployment gate is executed and verified.

---

## Completion Definition

All ten tasks must pass. Completion requires: Site Review regression-free; every Aviation route reachable; ten aircraft clearly labelled as internal concepts; no invented range/speed/payload/share-price/valuation/certification facts; functional search/filters/tabs/save/alerts; truthful certification/investment not-configured states; centralized permissions; usable desktop/tablet/mobile layouts; passing full tests and syntax checks; and no deployment claim without separate production evidence.
