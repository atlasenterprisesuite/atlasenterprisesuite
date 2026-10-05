# ATLAS Commercial Release Gate v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to execute this plan task-by-task. Use superpowers:test-driven-development for every production behavior change and superpowers:verification-before-completion before any completion claim.

**Goal:** Turn the approved Commercial Release Gate v1 specification into an evidence-driven, fail-closed ATLAS release authority that can distinguish an ordinary successful deployment from a commercially sellable release, while adding the minimum public and sales-led surfaces required to acquire, contract, invoice, provision, support, and renew a real customer.

**Architecture:** Extend the existing ATLAS truth chain rather than creating a parallel platform. The canonical module registry remains implementation/integration truth; a separate versioned commercial catalog references those module IDs and owns offer, sellability, pricing, support, and negotiation metadata. A pure commercial evaluator combines that catalog with exact-SHA global production evidence, public-surface evidence, enterprise/security evidence, revenue-lifecycle evidence, and external/legal evidence to produce exactly `SELLABLE` or `BLOCKED`. Public commercial routes live on the current web shell. Anonymous lead capture reuses the existing `atlas-advisory-public` Edge Function runtime with a distinct commercial-lead persistence model. Staff lifecycle actions are server-authoritative through RLS/RPC. Release evidence reuses `atlas_master_evidence_registry` and the existing GitHub-OIDC production verifier instead of adding another Edge Function slot.

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, Vitest 5, Node 22 ESM, Supabase/Postgres/RLS/RPC/Edge Functions, GitHub Actions OIDC, Cloudflare Worker production shell, existing ATLAS Release Control and Master Evidence Registry.

**Spec:** `docs/superpowers/specs/2026-10-04-commercial-release-gate-v1-design.md`

**Execution ruling:** Native/inline TDD is authorized by the project execution protocol. The local sandbox cannot resolve GitHub for a clone, so the isolated GitHub feature branch plus GitHub Actions is the authoritative TDD executor: each RED test commit must be observed failing in CI before its GREEN production commit is written. This preserves the test-first evidence requirement without pretending a local checkout exists.

## Global Constraints

- `main` remains the only canonical production source; work lands through a feature branch and PR.
- Preserve `ATLAS_MODULES` as implementation/integration readiness only. Do not turn it into commercial or production truth.
- Do not reuse ATLAS MAX `core/pro/max` intelligence plans as Enterprise Suite commercial plans. MAX remains an intelligence entitlement catalog; Commercial v1 has `atlas-business`, `atlas-enterprise`, and `atlas-custom` offers.
- Public prices, discounts, limits, support tiers, and offer contents must come from the commercial catalog; no JSX constants may invent commercial terms.
- Initial Business/Enterprise/Custom pricing may use explicit `pricing_mode: "negotiated"`; do not invent dollar amounts before margin/cost policy is approved.
- Regulated/provider-dependent capability remains `EXTERNAL_GATED`, `PREVIEW`, `INTERNAL_ONLY`, or `NOT_FOR_SALE` unless current evidence proves otherwise.
- Legal pages may be implemented and published, but the evaluator must remain `BLOCKED` until the configured legal-review/owner evidence exists. Product code does not substitute for legal counsel.
- Reuse the existing public Advisory Edge Function runtime; do not consume a new Supabase Edge Function slot for commercial lead capture.
- `atlas-advisory-public` is intentionally anonymous and MUST have an explicit source-controlled `verify_jwt = false` declaration; its own bounded origin/payload/rate-limit controls remain mandatory.
- Reuse `atlas_master_evidence_registry`; do not create a second release-evidence ledger.
- Client/browser state must never manufacture `SELLABLE`, `contracted`, `billing_authorized`, `provisioned`, `paid`, `connected`, or equivalent authoritative truth.
- Commercial gate failure must not rewrite a successful technical deployment as a failed deployment. Technical deployment truth and commercial sellability truth are separate, both fail-closed in their own domains.
- No production completion claim until CI, merge, deploy, exact-SHA global verification, commercial verification, and production E2E evidence have all been inspected.

## Review Focus

1. False-positive resistance: missing/stale/mismatched evidence must never yield `SELLABLE`.
2. Separation of truths: implementation readiness, production readiness, entitlement state, and commercial sellability remain distinct.
3. Tenant/RBAC integrity for staff sales/order/provisioning state.
4. Anonymous intake abuse controls and zero anonymous read access.
5. Exact-SHA convergence through direct and authorized Cloudflare verification paths.
6. No invented prices, legal approval, payment state, regulated capability, or provider readiness.
7. Reuse of existing release/evidence/Advisory primitives rather than duplicate systems.

---

## Task 1: Define the canonical commercial catalog and typed contract

**Files:**
- Create: `data/commercial/catalog-v1.json`
- Create: `packages/core/src/commercial.ts`
- Modify: `packages/core/src/index.ts`
- Create: `tests/unit/commercial-catalog.test.ts`

**Interfaces:**
- `CommercialCapabilityState = 'SELLABLE' | 'PREVIEW' | 'EXTERNAL_GATED' | 'INTERNAL_ONLY' | 'NOT_FOR_SALE'`.
- `CommercialOfferId = 'atlas-business' | 'atlas-enterprise' | 'atlas-custom'`.
- `getCommercialCatalog(): CommercialCatalog` reads the versioned JSON source.
- `getCommercialOffer(id: CommercialOfferId): CommercialOffer` fails closed for unknown/malformed offers.
- Catalog capability entries reference canonical `ATLAS_MODULES` IDs instead of duplicating route/readiness implementation metadata.

**Steps:**
1. Add `tests/unit/commercial-catalog.test.ts` first. Assert the three offer IDs, five capability states, `catalog_version`, effective date, pricing semantics, support/discount policy IDs, explicit state for every offered capability, and that Enterprise commercial IDs remain distinct from ATLAS MAX `core/pro/max` IDs.
2. Add a source-consistency assertion that every commercial `module_id` exists in `apps/web/src/modules/registry.ts`; missing module IDs fail the test.
3. Assert at least one offer is contractable with `pricing_mode: "negotiated"`, USD, billing period/term semantics, and no fabricated numeric base price.
4. Assert provider/regulatory families such as `pay`, `telecom`, clinical Health, filing/remittance, and hardware claims are not silently `SELLABLE` in the initial catalog.
5. Run `npx vitest run tests/unit/commercial-catalog.test.ts`; expect FAIL because catalog/contracts do not exist.
6. Implement the minimal typed contract and JSON catalog. Keep actual module route/readiness data in `ATLAS_MODULES`; commercial JSON references module IDs and commercial evidence-policy IDs only.
7. Export commercial types/readers from `packages/core/src/index.ts`.
8. Re-run targeted test and `npm run typecheck`; expect PASS.
9. Commit: `feat(commercial): add canonical offer catalog`.

---

## Task 2: Implement the deterministic fail-closed commercial decision engine

**Files:**
- Create: `scripts/lib/commercial-release.mjs`
- Create: `scripts/verify-commercial-release.mjs`
- Create: `data/ops/commercial-release-verification.json`
- Modify: `package.json`
- Create: `tests/unit/commercial-release-decision.test.ts`
- Create: `tests/integration/commercial-release-cli.test.ts`

**Interfaces:**
- `evaluateCommercialRelease(input)` returns `{ ok, outcome, offer_id, catalog_version, evaluated_sha, blockers, warnings, capabilities, checks }`.
- Final outcome is exactly `SELLABLE` or `BLOCKED`.
- Required input groups: exact-SHA global production result, public commercial surface, enterprise/security readiness, revenue readiness, legal/external evidence, and catalog capability evidence.
- CLI: `node scripts/verify-commercial-release.mjs --offer <id> --expected-sha <sha> --global-result <path> --evidence <path> --json-output <path> [--mode fail-closed|warning-only]`.

**Steps:**
1. Write unit tests for a fully valid synthetic fixture => `SELLABLE`.
2. Add table-driven false-positive cases: wrong SHA, missing global production success, missing P0 route, missing legal review evidence, unresolved P0 security finding, required capability not `SELLABLE`, stale required evidence, missing price/order semantics, browser-only payment/provisioning assertion, regulated capability falsely included, and missing catalog state. Every case returns `BLOCKED` with a stable blocker code.
3. Add tests proving optional `PREVIEW`/`EXTERNAL_GATED` capabilities excluded from the signed offer produce warnings but do not block the whole offer.
4. Add tests proving warning-only affects process exit/diagnostics only; it never changes an internal `BLOCKED` decision to `SELLABLE`.
5. Run `npx vitest run tests/unit/commercial-release-decision.test.ts`; expect FAIL.
6. Implement the pure evaluator with stable blocker/warning codes and no network I/O.
7. Re-run decision tests; expect PASS.
8. Add CLI integration tests with temporary JSON fixtures; require exact SHA, JSON output, nonzero exit on fail-closed `BLOCKED`, and zero diagnostic exit only in explicit warning-only while JSON remains `BLOCKED`.
9. Run `npx vitest run tests/integration/commercial-release-cli.test.ts`; expect FAIL before CLI/contract exist.
10. Add `data/ops/commercial-release-verification.json` with gate version, required public paths, evidence freshness policy, legal evidence keys, enterprise/revenue checks, and allowed offer IDs.
11. Implement CLI and add `verify:commercial` to `package.json`.
12. Re-run both tests and `npm run typecheck`; expect PASS.
13. Commit: `feat(commercial): add fail-closed release evaluator`.

---

## Task 3: Add the public commercial surface without inventing commercial truth

**Files:**
- Create: `apps/web/src/modules/commercial/CommercialRoutes.tsx`
- Create: `apps/web/src/modules/commercial/CommercialPricingPage.tsx`
- Create: `apps/web/src/modules/commercial/CommercialLeadPage.tsx`
- Create: `apps/web/src/modules/commercial/CommercialLegalPage.tsx`
- Create: `apps/web/src/modules/commercial/CommercialSecurityPage.tsx`
- Create: `apps/web/src/modules/commercial/commercial.css`
- Modify: `apps/web/src/extensions/resolveAtlasExtension.tsx`
- Modify: `apps/web/src/components/FuturisticEnterpriseHome.tsx`
- Create: `tests/unit/commercial-public-routes.test.tsx`

**Interfaces:**
- Public routes: `/pricing`, `/request-demo`, `/contact`, `/terms`, `/privacy`, `/security`.
- `/status` remains owned by the existing status surface.
- Pricing consumes the commercial catalog only.
- Terms/Privacy expose document version, owner, effective date, and clear scope; they do not claim attorney approval unless evidence says so.
- Security describes verified control boundaries and avoids unsupported certification claims.

**Steps:**
1. Write route/render tests first; require every P0 commercial route without `RequireAtlasIdentity` and before protected module fallbacks.
2. Assert Pricing consumes catalog data and contains no invented price literals.
3. Assert Terms/Privacy render version/owner/effective-date metadata and contain no unsupported `SOC 2 certified`, `HIPAA certified`, bank/carrier-equivalent claims.
4. Assert home includes Pricing and Request demo CTAs.
5. Run `npx vitest run tests/unit/commercial-public-routes.test.tsx`; expect FAIL.
6. Implement pages using existing ATLAS page-stack/module-card/notice patterns and only minimal responsive CSS; reuse existing assets.
7. Wire public routing and update home CTAs.
8. Re-run targeted test, `npm run typecheck`, and `npm run build`; expect PASS.
9. Commit: `feat(commercial): add public sales and trust surfaces`.

---

## Task 4: Reuse the existing public Advisory runtime for real demo/contact lead capture

**Files:**
- Create: `supabase/migrations/20261004235000_atlas_commercial_leads.sql`
- Modify: `supabase/functions/atlas-advisory-public/index.ts`
- Create: `apps/web/src/modules/commercial/commercialPublicApi.ts`
- Modify: `apps/web/src/modules/commercial/CommercialLeadPage.tsx`
- Modify: `supabase/config.toml`
- Create: `tests/integration/commercial-lead-intake.test.ts`

**Interfaces:**
- `public.atlas_commercial_leads`: organization-scoped lead with reference, intent (`request-demo`/`contact`), person/business contact fields, notes, source route, lifecycle status, timestamps, and audit-safe metadata.
- Anonymous receives no table read/write grants.
- Existing `atlas-advisory-public` gains a bounded action discriminator while preserving Business Launch 360 compatibility.
- `submitCommercialLead(input)` uses the same Edge Function endpoint and never writes directly to PostgREST.
- `supabase/config.toml` explicitly declares `[functions.atlas-advisory-public] verify_jwt = false`; the function remains protected by its bounded anonymous-input controls rather than a fabricated JWT requirement.

**Steps:**
1. Write integration tests first for RLS, no `anon` grants, service-role persistence, bounded status/intent values, indexes, staff organization permission, and explicit JWT policy.
2. Require the Edge Function to preserve Launch 360 while supporting commercial-lead action; assert origin allowlist, payload cap, honeypot, email validation, rate limit, and no anonymous read API.
3. Assert request-demo/contact submits via `commercialPublicApi.ts` and returns only a reference.
4. Run `npx vitest run tests/integration/commercial-lead-intake.test.ts tests/integration/business-launch-360-commercial.test.ts`; expect new test FAIL and existing test PASS.
5. Implement migration and Edge Function branch with shared validation helpers inside the same runtime.
6. Implement client API and complete idle/loading/success/error/disabled form states.
7. Re-run tests, `npm run typecheck`, and `npm run build`; expect PASS.
8. Commit: `feat(commercial): add governed public lead intake`.

---

## Task 5: Add the server-authoritative sales-led order and provisioning lifecycle

**Files:**
- Create: `supabase/migrations/20261004235500_atlas_commercial_lifecycle.sql`
- Create: `apps/web/src/modules/commercial/commercialAdminApi.ts`
- Create: `apps/web/src/modules/commercial/CommercialPipelinePage.tsx`
- Modify: `apps/web/src/modules/advisory/AdvisoryRoutes.tsx`
- Create: `tests/integration/commercial-lifecycle.test.ts`

**Interfaces:**
- `public.atlas_commercial_orders` links organization, lead, offer/catalog version, negotiated economics, lifecycle state, contract evidence, billing evidence, provisioning evidence, renewal data, and audit timestamps.
- Allowed sequence: `proposal -> negotiated -> contracted -> billing_authorized -> provisioned -> onboarding -> active -> renewal_due -> renewed | terminated`, plus explicitly enumerated cancellation/correction transitions.
- `atlas_create_commercial_order(...)` and `atlas_transition_commercial_order(...)` own writes; direct browser mutation is revoked.
- `contracted` requires contract/order evidence; `billing_authorized` requires billing evidence; `provisioned` requires prior billing authorization plus provisioning evidence; `active` requires onboarding/provisioning evidence.
- Discounts above catalog policy require escalation/approval evidence; code never auto-approves.

**Steps:**
1. Write integration tests first for RLS/grants, tenant scope, evidence requirements, allowed transitions, and forbidden jumps.
2. Add negative tests: CRM/lead closed-won alone cannot provision; browser update denied; `proposal -> provisioned` denied; missing contract/billing/provisioning evidence denied; cross-org references denied.
3. Require negotiated terms to record currency, period/term, recurring/implementation amount when known, pricing mode, catalog version, and discount basis. Negotiated offers may omit list price but not currency/term semantics.
4. Run `npx vitest run tests/integration/commercial-lifecycle.test.ts`; expect FAIL.
5. Implement migration with RLS and security-definer RPCs following current Advisory/Release patterns; revoke direct authenticated mutations.
6. Re-run integration test; expect PASS.
7. Implement authenticated admin API using existing organization/session helpers.
8. Add `/advisory/commercial-pipeline` to protected Advisory navigation. UI actions refresh authoritative server state after each transition.
9. Add UI assertions for loading/empty/error/disabled states and no optimistic paid/provisioned labels.
10. Run targeted tests, `npm run typecheck`, and `npm run build`; expect PASS.
11. Commit: `feat(commercial): govern contract billing and provisioning lifecycle`.

---

## Task 6: Bind commercial release evidence to existing Release Control and Master Evidence Registry

**Files:**
- Create: `supabase/migrations/20261004235900_commercial_release_evidence.sql` only if a constrained server RPC is required; do not create another evidence table.
- Modify: `supabase/functions/atlas-cloudflare-production-http-verify/index.ts`
- Modify: `supabase/functions/_shared/github-oidc-scope.ts` only if helper tests show allowlisting belongs there.
- Create: `tests/integration/commercial-release-evidence.test.ts`
- Modify: `tests/integration/cloudflare-authorized-production-verifier.test.ts`

**Interfaces:**
- Add `commercial-release-verify.yml` to the OIDC workflow allowlist while retaining repository owner/repo/ref/audience/workflow/SHA validation.
- Add an OIDC-authorized machine action that persists a sanitized snapshot into `public.atlas_master_evidence_registry` with `source_type='machine_verification'`, production environment, exact expected/deployed SHA, P0/P1 impact, offer/catalog/gate version metadata, and GitHub run/evidence reference.
- No secrets, customer PII, raw contract text, or provider credentials in evidence metadata.
- Evidence remains append-only; later evaluations supersede with new records.

**Steps:**
1. Write tests requiring reuse of `atlas_master_evidence_registry`, no second evidence table, and OIDC allowlisting of only canonical deployment/global/commercial workflows.
2. Test wrong repo/ref/workflow/audience/SHA rejection before persistence.
3. Test payload sanitation/size bounds and stable `SELLABLE`/`BLOCKED` evidence mapping.
4. Run targeted commercial + authorized-verifier tests; expect commercial test FAIL.
5. Implement minimal persistence inside the existing authorized verifier runtime, using service-role only server-side if needed.
6. If an RPC is necessary, make it server-only and validate exact SHA/source/metadata size/append-only behavior.
7. Re-run targeted tests; expect PASS.
8. Commit: `feat(commercial): persist exact-sha release evidence`.

---

## Task 7: Extend canonical global production verification with the commercial public routes

**Files:**
- Modify: `data/ops/global-production-verification.json`
- Modify: `scripts/verify-global-production.mjs` only if named aggregation is required; preserve route-driven behavior.
- Modify: `supabase/functions/atlas-cloudflare-production-http-verify/index.ts`
- Modify: `.github/workflows/global-production-verify.yml`
- Modify: `.github/workflows/cloudflare-deploy.yml`
- Modify: `tests/integration/global-production-verification.test.ts`
- Create: `tests/integration/commercial-public-production-contract.test.ts`

**Interfaces:**
- Required commercial routes: `/pricing`, `/request-demo`, `/contact`, `/terms`, `/privacy`, `/security` plus existing `/`, `/suite`, `/status`.
- Direct and authorized verifiers agree on the same paths and exact SHA.
- HSTS/CSP and `/api/v1/health` remain P0.
- Increment verifier contract/version consistently.

**Steps:**
1. Add regression tests first requiring the six new routes in the canonical contract and authorized verifier.
2. Assert all participate in fail-closed direct verification and authorized fallback; edge challenge never counts as direct success.
3. Assert Cloudflare exact-SHA canaries include commercial routes where the workflow explicitly enumerates probes.
4. Run targeted global/commercial production contract tests; expect FAIL against version 31.
5. Update contract, authorized verifier, outputs/canaries, and synchronized version.
6. Re-run targeted tests; expect PASS.
7. Commit: `ci(commercial): verify public release surface`.

---

## Task 8: Add the commercial verification workflow without conflating deploy success and sellability

**Files:**
- Create: `.github/workflows/commercial-release-verify.yml`
- Modify: `package.json` only if workflow-specific composition is useful.
- Create: `tests/integration/commercial-release-workflow.test.ts`
- Modify: `.github/workflows/cloudflare-deploy.yml` only when commercial verification can be chained after global verification without falsifying technical deployment status.

**Interfaces:**
- Reusable + manual workflow; inputs include offer ID and mode defaulting to fail-closed.
- Job order: prerequisite source checks -> global production verification same SHA -> gather evidence -> `verify:commercial` -> OIDC evidence persistence -> `sellable` output.
- `BLOCKED` fails the commercial workflow in fail-closed mode but never rewrites a successful deployment as failed deployment truth.
- Summary shows SHA, offer/catalog/gate versions, blocker/warning counts, final outcome; no secrets/PII.

**Steps:**
1. Write workflow contract test first for `workflow_call`, `workflow_dispatch`, `id-token: write`, exact-SHA OIDC path, global verifier reuse, `verify:commercial`, persistence, fail-closed default.
2. Assert provider deployment status alone is never sufficient and workflow is not silently path-filtered.
3. Run workflow test; expect FAIL.
4. Implement workflow with fixture/local evidence support for PR tests and production evidence path for main/manual runs. Production mode fails closed when evidence is absent.
5. Re-run test; expect PASS.
6. Commit: `ci(commercial): add sellability verification workflow`.

---

## Task 9: Make commercial release status observable inside ATLAS Release Control

**Files:**
- Create: `apps/web/src/modules/release/CommercialReleaseStatusPage.tsx`
- Create: `apps/web/src/modules/release/commercialReleaseApi.ts`
- Modify: `apps/web/src/extensions/resolveAtlasExtension.tsx`
- Modify: `apps/web/src/modules/integration/AtlasIntegrationHubs.tsx`
- Create: `tests/unit/commercial-release-status-ui.test.tsx`

**Interfaces:**
- Protected route `/release/commercial`.
- Read-only status from governed Release Control/Master Evidence Registry.
- Surface latest SHA, offer/catalog/gate versions, outcome, blockers/warnings, evidence age, capability-state distribution, route status, and next required actions.
- Never infer sellability from `ATLAS_MODULES`, deployment success, or client state.

**Steps:**
1. Write UI tests first for protected routing and evidence-derived status.
2. Test loading/empty/stale/error states; stale/missing evidence displays blocked/not verified, never optimistic green.
3. Run test; expect FAIL.
4. Implement authenticated evidence read API and page.
5. Add route and Release Control navigation card.
6. Re-run test, `npm run typecheck`, and `npm run build`; expect PASS.
7. Commit: `feat(commercial): expose release sellability evidence`.

---

## Task 10: Enforce legal, security, pricing, and provisioning truth boundaries

**Files:**
- Create: `tests/integration/commercial-truth-boundaries.test.ts`
- Modify: existing files only when a failing regression proves a real boundary violation.

**Steps:**
1. Prove Pricing does not use ATLAS MAX as Enterprise pricing truth.
2. Prove `/suite` `implemented` labels cannot produce commercial `SELLABLE`.
3. Prove legal pages cannot set legal-review evidence client-side.
4. Prove direct authenticated table update cannot bypass lifecycle RPCs.
5. Prove SHA/catalog-version mismatch blocks release.
6. Prove regulated/provider-dependent capability cannot become live merely from UI/catalog text.
7. Run test; repair only actual failing boundaries.
8. Re-run; expect PASS.
9. Commit: `test(commercial): enforce commercial truth boundaries`.

---

## Task 11: Full repository verification, PR readiness, deploy, and production E2E

**Pre-merge:**
1. Run all new commercial unit/integration tests.
2. Run impacted Business Launch 360, module registry, global production, authorized verifier, Release Control/evidence, CRM, Accounting/AR, Inventory/P2P, Payroll, navigation regressions.
3. Run `npm audit --audit-level=high`.
4. Run `npm run verify:design`.
5. Run `npm run typecheck`.
6. Run `npm run test:unit`.
7. Run `npm run test:integration`.
8. Run `npm run verify:edge`.
9. Run `npm run verify:python`.
10. Run `npm run verify:neural`.
11. Run `npm run verify:navigation`.
12. Run `npm run build`.
13. Run `npm run verify:all` as the canonical aggregate.
14. Inspect PR CI; repair every real failure and never waive P0 to obtain green.
15. Merge only when mergeable and required checks are green.

**Post-merge/deploy:**
1. Confirm merged `main` SHA.
2. Confirm Cloudflare production deployment evidence matches exactly that SHA; optional Vercel status is non-authoritative.
3. Run/inspect global production verification fail-closed for the merged SHA.
4. Verify `/api/v1/health` `status: "healthy"`, HSTS, and CSP.
5. Verify anonymous `/`, `/suite`, `/pricing`, `/request-demo`, `/contact`, `/terms`, `/privacy`, `/security`, `/status`.
6. Execute one controlled request-demo submission using non-sensitive ATLAS test data and confirm only the governed staff workflow can read it.
7. Verify production-safe tenant/lifecycle negatives: no anonymous read, no cross-org read, no direct provisioning jump, no billing/provisioning truth without evidence.
8. Run commercial workflow fail-closed for the chosen offer and exact SHA.
9. Inspect Master Evidence Registry snapshot for exact SHA, offer/catalog/gate version, blocker/warning counts, and absence of secrets/PII.
10. If `BLOCKED`, report exact remaining P0 evidence. Unavoidable external blockers may include legal-review evidence or provider/human evidence; never label the release sellable until those are supplied and a fresh gate returns `SELLABLE`.
11. If and only if `SELLABLE`, record verified offer/version/SHA and proceed to entity/IP/contract package/pricing-margin policy/first-customer acquisition.

**Final evidence rule:** Green build, merged PR, Vercel status, Cloudflare deploy, or a reachable website is insufficient. Completion requires exact-SHA production verification plus a fresh Commercial Release Gate result, and the final report must distinguish technical production readiness from commercial sellability.
