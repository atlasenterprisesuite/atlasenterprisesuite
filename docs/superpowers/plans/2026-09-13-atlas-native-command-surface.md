# ATLAS Native Command Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing ATLAS web shell the native command surface for complete module discovery, reusable approved blueprints, and the existing sovereign orchestrator.

**Architecture:** Extend the current React/React Router shell rather than creating another application. Add a governed navigation registry, a Library-derived blueprint catalog, and an authenticated orchestrator UI that consumes the existing orchestrator health/readiness and execution boundaries. Preserve tenant identity, approval, evidence and audit semantics and never manufacture operational state.

**Tech Stack:** TypeScript, React, React Router, Vitest, existing ATLAS execution/orchestrator packages and CSS system.

**Spec:** `docs/superpowers/specs/2026-09-13-atlas-native-command-surface-design.md`

## Global Constraints
- Canonical product surface is `www.atlasenterprisesuite.com`.
- Reuse approved Library blueprints before generating new visual assets.
- No fake live metrics, provider connections, runtime health or operational state.
- Preserve ATLAS Identity, tenant isolation, RBAC, Approval Center, Evidence and Audit boundaries.
- No merge, deploy, provider spend or irreversible infrastructure mutation without explicit approval.
- Every task follows RED -> GREEN -> REFACTOR and ends with focused verification and a coherent commit.

---

### Task 1: Governed Navigation Registry

**Files:**
- Create: `apps/web/src/navigation/atlasNavigation.ts`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Test: `tests/unit/atlas-navigation.test.ts`

**Interfaces:**
- Produces: `AtlasNavigationItem`, `atlasNavigation`, `implementedNavigationItems()`.
- Consumes: existing React Router `NavLink` and shell organization context.

- [ ] **Step 1: Write the failing test** asserting canonical labels are unique, implemented items have absolute routes, and Blueprints/Orchestrator are implemented destinations.
- [ ] **Step 2: Run** `npx vitest run tests/unit/atlas-navigation.test.ts` and observe failure because the registry does not exist.
- [ ] **Step 3: Implement** a typed registry with `id`, `label`, `route`, `group`, `availability: 'implemented' | 'catalog'`, and optional `requiresIdentity`; update `AtlasShell` to render it without fake links for catalog-only entries.
- [ ] **Step 4: Run** the focused test and existing shell/navigation integration tests; require PASS.
- [ ] **Step 5: Commit** `feat(navigation): add governed ATLAS module registry`.

### Task 2: Responsive Accessible Module Menu

**Files:**
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `tests/integration/atlas-shell-navigation.test.tsx`

**Interfaces:**
- Consumes: `atlasNavigation` from Task 1.
- Produces: accessible desktop sidebar and mobile/tablet menu using the same registry.

- [ ] **Step 1: Write failing integration tests** for menu open/close, active route, keyboard-focusable implemented links and non-clickable catalog items.
- [ ] **Step 2: Run** `npx vitest run tests/integration/atlas-shell-navigation.test.tsx`; require RED for missing behavior.
- [ ] **Step 3: Implement** one responsive shell: persistent desktop groups and a compact mobile/tablet menu with `aria-expanded`, explicit unavailable state and no `href="#"`.
- [ ] **Step 4: Run** focused integration tests; require PASS.
- [ ] **Step 5: Commit** `feat(shell): make ATLAS navigation responsive and accessible`.

### Task 3: Reusable Blueprint Catalog

**Files:**
- Create: `apps/web/src/modules/blueprints/blueprintCatalog.ts`
- Create: `apps/web/src/modules/blueprints/BlueprintsPage.tsx`
- Create: `apps/web/src/modules/blueprints/blueprints.css`
- Modify: `apps/web/src/App.tsx`
- Test: `tests/integration/blueprints-route.test.tsx`

**Interfaces:**
- Produces: `BlueprintRecord` and `blueprintCatalog`; `/blueprints` route.
- Record fields: `id`, `title`, `domain`, `sourceLabel`, `provenance`, `moduleRoute`, `implementationStatus`.

- [ ] **Step 1: Write failing route tests** requiring the approved Universe, Enterprise Master, Identity, Payroll, CRM, Inventory and Venezuela catalog entries; assert `Open module` only exists when `moduleRoute` is a real implemented route.
- [ ] **Step 2: Run** `npx vitest run tests/integration/blueprints-route.test.tsx`; require RED.
- [ ] **Step 3: Implement** governed metadata and the responsive catalog. Reuse existing Library provenance labels; do not generate replacement images or claim unimplemented modules are live.
- [ ] **Step 4: Run** focused test; require PASS.
- [ ] **Step 5: Commit** `feat(blueprints): add canonical reusable blueprint catalog`.

### Task 4: Orchestrator Readiness Client

**Files:**
- Create: `apps/web/src/modules/orchestrator/orchestratorClient.ts`
- Test: `tests/unit/orchestrator-client.test.ts`

**Interfaces:**
- Produces: `OrchestratorProbeState = 'healthy' | 'degraded' | 'unavailable' | 'unknown' | 'unconfigured'`, `probeOrchestrator(signal?)`.
- Consumes: existing orchestrator `/healthz` and `/readyz` HTTP contracts.

- [ ] **Step 1: Write failing tests** for verified healthy, non-ready/degraded, network unavailable, malformed/unknown and missing-endpoint/unconfigured states.
- [ ] **Step 2: Run** `npx vitest run tests/unit/orchestrator-client.test.ts`; require RED.
- [ ] **Step 3: Implement** a fetch client that maps only verified responses to healthy and fails closed for all other cases; never sends provider secrets to the browser.
- [ ] **Step 4: Run** focused tests; require PASS.
- [ ] **Step 5: Commit** `feat(orchestrator): add fail-closed readiness client`.

### Task 5: Native Orchestrator Command Surface

**Files:**
- Create: `apps/web/src/modules/orchestrator/OrchestratorPage.tsx`
- Create: `apps/web/src/modules/orchestrator/orchestrator.css`
- Modify: `apps/web/src/App.tsx`
- Test: `tests/integration/orchestrator-route.test.tsx`

**Interfaces:**
- Consumes: `probeOrchestrator`, existing `RequireAtlasIdentity`, execution routes/components.
- Produces: authenticated `/orchestrator` with Execution Engine, Self-Healing Operations, AI Council and System Health areas.

- [ ] **Step 1: Write failing integration tests** requiring identity protection, the four areas, honest unconfigured/unknown states, and links into existing governed execution where available.
- [ ] **Step 2: Run** `npx vitest run tests/integration/orchestrator-route.test.tsx`; require RED.
- [ ] **Step 3: Implement** the native page. Reuse execution/approval/evidence/audit components or route links rather than duplicating their business logic. AI Council shows provider roles/capability boundaries, not fabricated connection badges.
- [ ] **Step 4: Run** focused tests; require PASS.
- [ ] **Step 5: Commit** `feat(orchestrator): expose sovereign command surface in ATLAS`.

### Task 6: Self-Healing Incident Intake Boundary

**Files:**
- Create: `apps/web/src/modules/orchestrator/incidents.ts`
- Create: `apps/web/src/modules/orchestrator/IncidentIntake.tsx`
- Modify: `apps/web/src/modules/orchestrator/OrchestratorPage.tsx`
- Test: `tests/unit/orchestrator-incidents.test.ts`
- Test: `tests/integration/orchestrator-incident-intake.test.tsx`

**Interfaces:**
- Produces: `IncidentDraft`, `classifyIncidentRisk()`, `buildIncidentEvidenceEnvelope()`.
- Consumes: tenant/module context and existing approval/audit boundaries.

- [ ] **Step 1: Write failing tests** proving low-risk reversible incidents can enter diagnosis while destructive, financial, permission, audit/security and irreversible categories require approval and cannot self-authorize.
- [ ] **Step 2: Run** both focused tests; require RED.
- [ ] **Step 3: Implement** incident intake, risk classification and evidence envelope. Do not implement autonomous production mutation in this task.
- [ ] **Step 4: Run** focused tests; require PASS.
- [ ] **Step 5: Commit** `feat(orchestrator): add governed self-healing incident intake`.

### Task 7: Route and Regression Integration

**Files:**
- Modify: `apps/web/src/App.tsx`
- Test: `tests/integration/native-command-surface-routes.test.tsx`

**Interfaces:**
- Consumes: navigation registry, Blueprints page and Orchestrator page.
- Produces: final route graph without regression to Finance, Payroll, Health, Hospitality, Creator or execution routes.

- [ ] **Step 1: Write failing route-graph tests** covering `/blueprints`, `/orchestrator` and representative existing routes.
- [ ] **Step 2: Run** focused route test; require RED if integration is incomplete.
- [ ] **Step 3: Make minimal route integration corrections** and preserve existing special Hospitality/extension routing behavior.
- [ ] **Step 4: Run** focused test plus `npm run test:integration`; require PASS before proceeding.
- [ ] **Step 5: Commit** `test(routes): verify ATLAS native command surface integration`.

### Task 8: Full Verification and Review Gate

**Files:**
- Modify only files required by failures discovered in verification.

**Interfaces:**
- Produces: fresh verification evidence; no merge/deploy.

- [ ] **Step 1: Run** `npm ci` and record exit status.
- [ ] **Step 2: Run** `npm run typecheck` and fix any command-surface regression until PASS.
- [ ] **Step 3: Run** `npm run test:unit` and fix regressions until PASS.
- [ ] **Step 4: Run** `npm run test:integration` and fix regressions until PASS.
- [ ] **Step 5: Run** `npm run build` and fix regressions until PASS.
- [ ] **Step 6: Review** the branch against the design: no fake state, no dead links, no duplicate orchestrator, no regenerated blueprint assets, identity/tenant boundaries preserved.
- [ ] **Step 7: Commit** only verification-driven fixes with focused messages. Keep the branch unmerged and undeployed for explicit approval.