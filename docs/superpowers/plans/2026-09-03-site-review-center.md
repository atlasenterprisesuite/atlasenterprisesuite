# ATLAS Site Review Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a dependency-light ATLAS application foundation and deliver a working Site Review Center with visual review domain logic, permissions, deterministic technical audits, responsive UI, and verified tests.

**Architecture:** Browser-native ES modules keep the first repository foundation portable and easy to test. Domain logic lives outside UI code behind explicit store/service interfaces, allowing persistence and backend adapters to change later without rewriting product behavior.

**Tech Stack:** HTML5, CSS3, JavaScript ES modules, Node.js 22+ built-in `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-03-site-review-center-design.md`

## Global Constraints

- Do not copy Wix source code, proprietary UI assets, or proprietary backend behavior.
- Do not fabricate site metrics, provider connectivity, deployment status, or production data.
- Keep the first foundation at zero runtime dependencies.
- Centralize permissions.
- Keep domain logic independently testable from the browser UI.
- Do not merge to `main` until tests are verified.

---

### Task 1: Repository test foundation

**Files:**
- Create: `package.json`
- Create: `tests/review-store.test.mjs`
- Create: `tests/review-service.test.mjs`
- Create: `tests/permissions.test.mjs`
- Create: `tests/audit-engine.test.mjs`

**Interfaces:**
- Consumes: Node.js built-in test runner.
- Produces: executable specifications for the initial domain API.

- [ ] Write failing tests for sessions, issues, replies, filters, permissions, and audit rules.
- [ ] Run `npm test` and confirm failure occurs because production modules do not yet exist.
- [ ] Commit the red test suite.

### Task 2: Review store and service

**Files:**
- Create: `src/modules/site-review/review-store.js`
- Create: `src/modules/site-review/review-service.js`

**Interfaces:**
- Produces: `createMemoryReviewStore()`, `createReviewService({ store, now, id })`.

- [ ] Implement the smallest domain model that satisfies tests.
- [ ] Validate URLs, coordinates, enums, and missing records.
- [ ] Implement issue filtering and replies.
- [ ] Run tests and keep all review-domain tests green.

### Task 3: Central permission model

**Files:**
- Create: `src/core/permissions.js`

**Interfaces:**
- Produces: `hasCapability(role, capability)`, `capabilitiesForRole(role)`.

- [ ] Implement explicit role-to-capability mapping.
- [ ] Run permission tests.

### Task 4: Deterministic audit engine

**Files:**
- Create: `src/modules/site-review/audit-engine.js`

**Interfaces:**
- Produces: `auditDocument(markup, pageUrl)`, `providerDependentFindings()`.

- [ ] Parse deterministic HTML signals without external services.
- [ ] Report actual passes/detections.
- [ ] Report provider-dependent checks as `not_configured`.
- [ ] Run audit tests.

### Task 5: ATLAS shell and Site Review UI

**Files:**
- Create: `src/index.html`
- Create: `src/styles.css`
- Create: `src/app.js`
- Create: `src/core/routes.js`
- Create: `src/modules/site-review/site-review-ui.js`

**Interfaces:**
- Consumes domain service, permissions, and audit engine.
- Produces responsive `/sites/review` browser experience.

- [ ] Build ATLAS navigation shell.
- [ ] Add site URL form and review session creation.
- [ ] Add desktop/tablet/mobile viewport selector.
- [ ] Add review canvas with coordinate pins.
- [ ] Add issue drawer/list with filters and status actions.
- [ ] Add technical audit panel.
- [ ] Add empty/error/permission/not-configured states.

### Task 6: Static runtime and verification

**Files:**
- Create: `server.mjs`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Produces: local static server and documented commands.

- [ ] Serve `src/` using Node built-ins only.
- [ ] Run full `npm test`.
- [ ] Start local server and verify `/` and `/sites/review` return HTTP 200.
- [ ] Verify key browser assets return HTTP 200.
- [ ] Review repository diff for secrets and placeholder production claims.
- [ ] Open a PR into `main` only after verification evidence exists.