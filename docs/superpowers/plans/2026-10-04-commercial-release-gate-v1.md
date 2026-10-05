# ATLAS Commercial Release Gate v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to execute this plan task-by-task. Use superpowers:test-driven-development for every production behavior change and superpowers:verification-before-completion before any completion claim.

**Goal:** Turn the approved Commercial Release Gate v1 specification into an evidence-driven, fail-closed ATLAS release authority that can distinguish an ordinary successful deployment from a commercially sellable release, while adding the minimum public and sales-led surfaces required to acquire, contract, invoice, provision, support, and renew a real customer.

**Architecture:** Extend the existing ATLAS truth chain rather than creating a parallel platform. The canonical module registry remains implementation/integration truth; a separate versioned commercial catalog references those module IDs and owns offer, sellability, pricing, support, and negotiation metadata. A pure commercial evaluator combines that catalog with exact-SHA global production evidence, public-surface evidence, enterprise/security evidence, revenue-lifecycle evidence, and external/legal evidence to produce exactly `SELLABLE` or `BLOCKED`. Public commercial routes live on the current web shell. Anonymous lead capture reuses the existing `atlas-advisory-public` Edge Function runtime with a distinct commercial-lead persistence model. Staff lifecycle actions are server-authoritative through RLS/RPC. Release evidence reuses `atlas_master_evidence_registry` and the existing GitHub-OIDC production verifier instead of adding another Edge Function slot.

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, Vitest 5, Node 22 ESM, Supabase/Postgres/RLS/RPC/Edge Functions, GitHub Actions OIDC, Cloudflare Worker production shell, existing ATLAS Release Control and Master Evidence Registry.

**Spec:** `docs/superpowers/specs/2026-10-04-commercial-release-gate-v1-design.md`

## Global Constraints

- `main` remains the only canonical production source; work lands through a feature branch and PR.
- Preserve `ATLAS_MODULES` as implementation/integration readiness only. Do not turn it into commercial or production truth.
- Do not reuse ATLAS MAX `core/pro/max` intelligence plans as Enterprise Suite commercial plans. MAX remains an intelligence entitlement catalog; Commercial v1 has `atlas-business`, `atlas-enterprise`, and `atlas-custom` offers.
- Public prices, discounts, limits, support tiers, and offer contents must come from the commercial catalog; no JSX constants may invent commercial terms.
- Initial Business/Enterprise/Custom pricing may use explicit `pricing_mode: "negotiated"`; do not invent dollar amounts before margin/cost policy is approved.
- Regulated/provider-dependent capability remains `EXTERNAL_GATED`, `PREVIEW`, `INTERNAL_ONLY`, or `NOT_FOR_SALE` unless current evidence proves otherwise.
- Legal pages may be implemented and published, but the evaluator must remain `BLOCKED` until the configured legal-review/owner evidence exists. Product code does not substitute for legal counsel.
- Reuse the existing public Advisory Edge Function runtime; do not consume a new Supabase Edge Function slot for commercial lead capture.
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
- Produce `CommercialCapabilityState = 'SELLABLE' | 'PREVIEW' | 'EXTERNAL_GATED' | 'INTERNAL_ONLY' | 'NOT_FOR_SALE'`.
- Produce `CommercialOfferId = 'atlas-business' | 'atlas-enterprise' | 'atlas-custom'`.
- Produce typed catalog/offer/capability/pricing/discount/support/evidence-policy readers.
- `getCommercialCatalog()` reads the versioned JSON source; `getCommercialOffer(id)` fails closed for unknown offers.
- Catalog capability entries reference canonical `ATLAS_MODULES` IDs instead of duplicating route/readiness implementation metadata.

**Steps:**
1. Add `tests/unit/commercial-catalog.test.ts` first. Assert the three offer IDs, five capability states, `catalog_version`, effective date, pricing semantics, support/discount policy IDs, explicit state for every offered capability, and that `atlas-business`/`atlas-enterprise`/`atlas-custom` are distinct from ATLAS MAX `core/pro/max` IDs.
2. Add a source-consistency assertion that every commercial `module_id` exists in `apps/web/src/modules/registry.ts`; missing module IDs fail the test.
3. Assert at least one offer is contractable with `pricing_mode: "negotiated"`, USD, billing period/term semantics, and no fabricated numeric base price.
4. Assert provider/regulatory families such as `pay`, `telecom`, clinical Health, filing/remittance, and hardware claims are not silently `SELLABLE` in the initial catalog.
5. Run `npx vitest run tests/unit/commercial-catalog.test.ts`; expect FAIL because catalog/contracts do not exist.
6. Implement the minimal typed contract and JSON catalog. Keep actual module route/readiness data in `ATLAS_MODULES`; commercial JSON references module IDs and commercial evidence-policy IDs only.
7. Export commercial types/readers from `packages/core/src/index.ts`.
8. Re-run `npx vitest run tests/unit/commercial-catalog.test.ts`; expect PASS.
9. Run `npm run typecheck`; expect PASS.
10. Commit: `feat(commercial): add canonical offer catalog`.

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
2. Add table-driven false-positive cases: wrong SHA, missing global production success, missing P0 route, missing legal review evidence, unresolved P0 security finding, required capability state not `SELLABLE`, required capability evidence stale, missing price/order semantics, browser-only payment/provisioning assertion, regulated capability falsely included, and missing catalog state. Every case must return `BLOCKED` with a stable blocker code.
3. Add tests proving optional `PREVIEW`/`EXTERNAL_GATED` capabilities excluded from the signed offer produce warnings/non-sellable capability results but do not block the whole offer.
4. Add tests proving warning-only affects process exit policy/diagnostics only; it never changes an internal `BLOCKED` decision to `SELLABLE`.
5. Run `npx vitest run tests/unit/commercial-release-decision.test.ts`; expect FAIL because evaluator does not exist.
6. Implement `scripts/lib/commercial-release.mjs` as a pure function with stable blocker/warning codes and no network I/O.
7. Re-run decision tests; expect PASS.
8. Add CLI integration tests using temporary JSON fixtures. Verify exact SHA, JSON output, nonzero exit on fail-closed `BLOCKED`, and zero diagnostic exit only when explicitly warning-only while JSON still says `BLOCKED`.
9. Run `npx vitest run tests/integration/commercial-release-cli.test.ts`; expect FAIL before CLI/contract exist.
10. Add `data/ops/commercial-release-verification.json` with gate version, required public commercial paths, evidence freshness policy, legal evidence keys, enterprise/revenue checks, and allowed offer IDs.
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
- Pricing cards consume the commercial catalog and render negotiated/fixed semantics from data only.
- Terms/Privacy expose document version, owner, effective date, and clear scope; they must not claim attorney approval unless evidence says so.
- Security page describes verified control boundaries and explicitly avoids certification claims not backed by evidence.
- Home receives clear commercial CTAs to `/pricing` and `/request-demo` while preserving existing product navigation.

**Steps:**
1. Write route/render tests first. Assert every P0 commercial route resolves without `RequireAtlasIdentity` and that commercial pages are routed before protected module fallbacks.
2. Assert pricing page imports/consumes the commercial catalog rather than containing hard-coded price literals.
3. Assert Terms/Privacy render version/owner/effective-date fields from versioned metadata and contain no `SOC 2 certified`, `HIPAA certified`, `bank`, `carrier`, or equivalent unsupported assertions.
4. Assert home includes Pricing and Request demo CTAs.
5. Run `npx vitest run tests/unit/commercial-public-routes.test.tsx`; expect FAIL because routes/pages do not exist.
6. Implement `CommercialRoutes` and minimal production-quality pages using existing ATLAS page-stack/module-card/notice patterns and a small responsive `commercial.css` where needed. Do not generate new visual assets when existing ATLAS components are sufficient.
7. Wire public route resolution in `resolveAtlasExtension.tsx` before protected product module branches.
8. Update home CTAs.
9. Re-run targeted test, `npm run typecheck`, and `npm run build`; expect PASS.
10. Commit: `feat(commercial): add public sales and trust surfaces`.

---

## Task 4: Reuse the existing public Advisory runtime for real demo/contact lead capture

**Files:**
- Create: `supabase/migrations/20261004_atlas_commercial_leads.sql`
- Modify: `supabase/functions/atlas-advisory-public/index.ts`
- Create: `apps/web/src/modules/commercial/commercialPublicApi.ts`
- Modify: `apps/web/src/modules/commercial/CommercialLeadPage.tsx`
- Modify: `supabase/config.toml` only if the live/source JWT declaration for `atlas-advisory-public` is absent and the existing deployment policy requires an explicit entry.
- Create: `tests/integration/commercial-lead-intake.test.ts`

**Interfaces:**
- `public.atlas_commercial_leads`: organization-scoped lead record with reference, intent (`request-demo`/`contact`), person/business contact fields, notes, source route, lifecycle status, timestamps, and audit-safe metadata.
- Anonymous role receives no table read/write grants.
- Existing `atlas-advisory-public` Edge Function gains a bounded action discriminator while preserving Business Launch 360 compatibility.
- `submitCommercialLead(input)` uses the same public Edge Function endpoint; it never writes directly to PostgREST.

**Steps:**
1. Write integration contract tests first. Require RLS, no `anon` table grants, service-role persistence path, bounded status/intent values, indexes, and staff read permission through an existing appropriate organization permission.
2. Require the Edge Function to preserve current Business Launch 360 flow while supporting an explicit commercial-lead action. Assert origin allowlist, payload cap, honeypot, email validation, duplicate/rate limit handling, and no anonymous read API.
3. Assert request-demo/contact page submits via `commercialPublicApi.ts` and returns only a reference, never internal IDs/customer records.
4. Run `npx vitest run tests/integration/commercial-lead-intake.test.ts tests/integration/business-launch-360-commercial.test.ts`; expect new commercial test FAIL while existing Launch 360 test remains PASS.
5. Implement migration and Edge Function branch with minimal duplication by extracting shared request validation helpers inside the same runtime file.
6. Implement client API and form states: idle/loading/success/error/disabled; preserve accessibility labels.
7. Re-run both integration tests; expect PASS.
8. Run `npm run typecheck` and `npm run build`; expect PASS.
9. Commit: `feat(commercial): add governed public lead intake`.

---

## Task 5: Add the server-authoritative sales-led order and provisioning lifecycle

**Files:**
- Create: `supabase/migrations/20261004_atlas_commercial_lifecycle.sql`
- Create: `apps/web/src/modules/commercial/commercialAdminApi.ts`
- Create: `apps/web/src/modules/commercial/CommercialPipelinePage.tsx`
- Modify: `apps/web/src/modules/advisory/AdvisoryRoutes.tsx`
- Create: `tests/integration/commercial-lifecycle.test.ts`

**Interfaces:**
- `public.atlas_commercial_orders` links organization, commercial lead, offer ID/catalog version, negotiated order economics, lifecycle state, contract evidence, billing evidence, provisioning evidence, renewal data, and audit timestamps.
- Allowed state machine: `proposal -> negotiated -> contracted -> billing_authorized -> provisioned -> onboarding -> active -> renewal_due -> renewed | terminated`, with narrowly defined correction/cancellation transitions.
- Server RPCs own creation/transition; browser cannot directly mutate lifecycle columns.
- `contracted` requires contract/order evidence; `billing_authorized` requires accepted commercial authorization and billing evidence; `provisioned` requires prior billing authorization and provisioning evidence; `active` requires onboarding/provisioning evidence.
- Discounts above catalog policy require an escalation/approval evidence reference; code never auto-approves it.

**Steps:**
1. Write integration tests first for table/RLS/grants, tenant scoping, immutable evidence references, allowed transitions, and forbidden jumps.
2. Add explicit negative tests: closed-won CRM/lead alone cannot provision; browser cannot update table; `proposal -> provisioned` fails; missing contract evidence blocks `contracted`; missing billing evidence blocks `billing_authorized`; cross-org lead/order references fail.
3. Require negotiated terms to record currency, billing period/term, recurring/implementation amounts when known, pricing mode, catalog version, and discount basis. `negotiated` offers may leave list price absent but cannot leave currency/term semantics ambiguous.
4. Run `npx vitest run tests/integration/commercial-lifecycle.test.ts`; expect FAIL because lifecycle schema/RPCs do not exist.
5. Implement migration with RLS and security-definer RPCs following existing Advisory/Release Control patterns. Revoke direct authenticated INSERT/UPDATE/DELETE unless a narrowly justified path exists.
6. Re-run integration tests; expect PASS.
7. Implement authenticated `commercialAdminApi.ts` using existing ATLAS organization/session helpers.
8. Add `/advisory/commercial-pipeline` to protected Advisory navigation. The page lists real leads/orders and exposes only transitions allowed by server state; all success states come from refreshed server records.
9. Add UI contract tests to `commercial-lifecycle.test.ts` or a focused `tests/unit/commercial-pipeline-ui.test.tsx`; verify loading/empty/error/disabled states and no optimistic `paid/provisioned` labels.
10. Run targeted tests, `npm run typecheck`, and `npm run build`; expect PASS.
11. Commit: `feat(commercial): govern contract billing and provisioning lifecycle`.

---

## Task 6: Bind commercial release evidence to existing Release Control and Master Evidence Registry

**Files:**
- Create: `supabase/migrations/20261004_commercial_release_evidence.sql` only if an RPC is needed to constrain machine-written commercial evidence; do not create another evidence table.
- Modify: `supabase/functions/atlas-cloudflare-production-http-verify/index.ts`
- Modify: `supabase/functions/_shared/github-oidc-scope.ts` only if helper tests show workflow allowlisting belongs there.
- Create: `tests/integration/commercial-release-evidence.test.ts`
- Modify: `tests/integration/cloudflare-authorized-production-verifier.test.ts`

**Interfaces:**
- Add `commercial-release-verify.yml` to the OIDC workflow allowlist while retaining repository owner, repository, `refs/heads/main`, audience, workflow-ref, and SHA validation.
- Add an OIDC-authorized machine action that persists a sanitized commercial verification snapshot into `public.atlas_master_evidence_registry` with `source_type='machine_verification'`, `environment='production'`, exact `expected_sha`/`deployed_sha`, P0/P1 impact, offer/catalog/gate version metadata, and a source reference to the GitHub run/evidence artifact.
- No secret, customer PII, contract text, or raw provider credential may enter evidence metadata.
- Evidence remains append-only; a later evaluation supersedes via a new record rather than mutation.

**Steps:**
1. Write integration tests first requiring reuse of `atlas_master_evidence_registry`, no second evidence table, and OIDC allowlisting of exactly the canonical deployment/global/commercial workflows.
2. Test that wrong repo/ref/workflow/audience/SHA fails before persistence.
3. Test payload sanitation/size bounds and stable mapping of `SELLABLE`/`BLOCKED` to evidence status/impact without exposing secrets/PII.
4. Run `npx vitest run tests/integration/commercial-release-evidence.test.ts tests/integration/cloudflare-authorized-production-verifier.test.ts`; expect commercial test FAIL.
5. Implement the minimal persistence path inside the existing authorized verifier runtime, using service-role only server-side if required. Do not add a new public Edge Function.
6. If a DB RPC is required, make it server-only and validate exact SHA, source type, metadata size, and append-only behavior.
7. Re-run targeted tests; expect PASS.
8. Commit: `feat(commercial): persist exact-sha release evidence`.

---

## Task 7: Extend canonical global production verification with the commercial public routes

**Files:**
- Modify: `data/ops/global-production-verification.json`
- Modify: `scripts/verify-global-production.mjs` only if new named check aggregation is needed; preserve portable route-driven behavior.
- Modify: `supabase/functions/atlas-cloudflare-production-http-verify/index.ts`
- Modify: `.github/workflows/global-production-verify.yml`
- Modify: `.github/workflows/cloudflare-deploy.yml`
- Modify: `tests/integration/global-production-verification.test.ts`
- Create: `tests/integration/commercial-public-production-contract.test.ts`

**Interfaces:**
- Required commercial routes: `/pricing`, `/request-demo`, `/contact`, `/terms`, `/privacy`, `/security` plus existing `/`, `/suite`, `/status`.
- Direct and authorized verifiers must agree on the same required paths and exact SHA.
- HSTS/CSP and `/api/v1/health` remain P0.
- Increment global verifier contract/version consistently wherever the existing tests require version lockstep.

**Steps:**
1. Add regression tests first requiring the six new commercial routes in the canonical production contract and authorized verifier.
2. Assert all routes participate in direct fail-closed verification and authorized edge fallback; a Cloudflare challenge may defer to authorized verification but never count as direct success.
3. Assert Cloudflare deployment exact-SHA worker probes include the commercial routes where the workflow explicitly enumerates canaries.
4. Run `npx vitest run tests/integration/global-production-verification.test.ts tests/integration/commercial-public-production-contract.test.ts`; expect FAIL against current version 31 contract.
5. Update route contract, authorized verifier, workflow outputs/canaries, and synchronized verifier version.
6. Re-run targeted tests; expect PASS.
7. Run `npm run verify:production:global -- --mode warning-only --expected-sha "$(git rev-parse HEAD)"` only in an execution environment with a checkout; if public prod is still on an older SHA, record the expected exact-SHA diagnostic rather than treating it as implementation failure.
8. Commit: `ci(commercial): verify public release surface`.

---

## Task 8: Add the commercial verification workflow without conflating deploy success and sellability

**Files:**
- Create: `.github/workflows/commercial-release-verify.yml`
- Modify: `package.json` if workflow-specific script composition is useful.
- Create: `tests/integration/commercial-release-workflow.test.ts`
- Modify: `.github/workflows/cloudflare-deploy.yml` only to trigger/advertise commercial verification after global production success if this can be done without making a commercial blocker falsify technical deployment truth.

**Interfaces:**
- Reusable + manually dispatchable workflow.
- Inputs: offer ID, mode (default `fail-closed`), optional evidence artifact/ref according to repository policy.
- Job order: repository verification prerequisites -> global production verification for same SHA -> gather commercial evidence -> run `verify:commercial` -> persist evidence through OIDC authorized runtime -> expose `sellable` output.
- A `BLOCKED` commercial decision fails this workflow in fail-closed mode, but does not rewrite an already successful deployment status.
- Workflow summary must display SHA, offer/catalog/gate versions, P0 blocker count, P1 warning count, and final commercial outcome; no secrets/PII.

**Steps:**
1. Write workflow contract test first. Require `workflow_call`, `workflow_dispatch`, `id-token: write`, main/exact-SHA OIDC path, global verifier dependency/reuse, `verify:commercial`, evidence persistence, and fail-closed default.
2. Assert workflow does not use Vercel/Cloudflare deployment status as a substitute for global production verification.
3. Assert commercial workflow is not silently path-filtered and does not expose secrets in summaries.
4. Run `npx vitest run tests/integration/commercial-release-workflow.test.ts`; expect FAIL.
5. Implement workflow with a synthetic/local evidence fixture path for PR testing and production evidence path for main/manual runs. Production mode must fail closed when required evidence is absent.
6. Re-run targeted tests; expect PASS.
7. Commit: `ci(commercial): add sellability verification workflow`.

---

## Task 9: Make the commercial release status observable inside ATLAS Release Control

**Files:**
- Create: `apps/web/src/modules/release/CommercialReleaseStatusPage.tsx`
- Create: `apps/web/src/modules/release/commercialReleaseApi.ts`
- Modify: `apps/web/src/extensions/resolveAtlasExtension.tsx`
- Modify: `apps/web/src/modules/integration/AtlasIntegrationHubs.tsx`
- Create: `tests/unit/commercial-release-status-ui.test.tsx`

**Interfaces:**
- Protected route `/release/commercial`.
- Read-only status from current Master Evidence Registry / governed Release Control API.
- Surface: latest evaluated SHA, offer/catalog/gate versions, `SELLABLE`/`BLOCKED`, P0 blockers, P1 warnings, evidence age, capability-state distribution, public-route status, and next required actions.
- Never infer sellability from `ATLAS_MODULES`, deployment success, or frontend state.

**Steps:**
1. Write UI tests first requiring protected routing and evidence-derived status.
2. Test empty/stale/error/loading states; stale/missing evidence displays `BLOCKED`/not verified, never optimistic green.
3. Run `npx vitest run tests/unit/commercial-release-status-ui.test.tsx`; expect FAIL.
4. Implement authenticated read API by reusing Release Control/evidence endpoints.
5. Add route and Release Control navigation card.
6. Re-run test, `npm run typecheck`, and `npm run build`; expect PASS.
7. Commit: `feat(commercial): expose release sellability evidence`.

---

## Task 10: Lock down legal, security, pricing, and provisioning false claims with cross-system regression tests

**Files:**
- Create: `tests/integration/commercial-truth-boundaries.test.ts`
- Modify: existing files only when a failing regression proves a real boundary violation.

**Interfaces:**
- Commercial UI may display only catalog-sourced offer terms.
- Legal page publication is distinct from legal-review evidence.
- Commercial status is distinct from module registry readiness and ATLAS MAX entitlement state.
- Contract/billing/provisioning state is server-authoritative.
- External/regulated modules cannot be included as production-live in a sellable offer without their own current evidence.

**Steps:**
1. Add cross-file tests proving Pricing does not use ATLAS MAX plan catalog as Enterprise pricing truth.
2. Add tests proving `/suite` `implemented` labels cannot produce commercial `SELLABLE`.
3. Add tests proving legal pages cannot set `legal_reviewed=true` client-side.
4. Add tests proving direct authenticated table update cannot bypass lifecycle RPCs.
5. Add tests proving evidence SHA/catalog version mismatch blocks release.
6. Run `npx vitest run tests/integration/commercial-truth-boundaries.test.ts`; expect any uncovered boundary to FAIL.
7. Apply only the minimal fixes required by failing assertions.
8. Re-run test; expect PASS.
9. Commit: `test(commercial): enforce commercial truth boundaries`.

---

## Task 11: Full repository verification, PR readiness, deploy, and production E2E

**Files:**
- No feature expansion. Modify only files required to repair failures discovered by verification.

**Pre-merge verification:**
1. Run targeted commercial unit/integration suite.
2. Run existing Business Launch 360, module registry, global production verifier, Cloudflare authorized verifier, Release Control/evidence, CRM, Accounting/AR, Inventory/P2P, Payroll, and navigation regression suites affected by the changes.
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
13. Run `npm run verify:all` as the canonical aggregate gate.
14. Inspect CI on the implementation PR. Repair every real failure; do not waive P0 failures to obtain green.
15. Ensure the commercial PR is mergeable and required CI checks are green before merge.

**Post-merge/deploy verification:**
1. Confirm merged `main` SHA.
2. Confirm Cloudflare production deployment evidence corresponds to exactly that SHA; optional Vercel status is not authoritative.
3. Run/inspect `ATLAS Global Production Verification` in `fail-closed` mode for the merged SHA.
4. Verify `/api/v1/health` returns `status: "healthy"` and HSTS/CSP pass.
5. Verify anonymous public P0 commercial routes: `/`, `/suite`, `/pricing`, `/request-demo`, `/contact`, `/terms`, `/privacy`, `/security`, `/status`.
6. Execute one controlled request-demo submission using non-sensitive ATLAS test data and verify the generated reference appears only in the governed staff workspace; do not use a real prospect without consent.
7. Verify tenant isolation and lifecycle negative cases against production-safe test records: no anonymous read, no cross-org read, no direct provisioning jump, no billing/provisioning state without evidence.
8. Run the commercial workflow in fail-closed mode for the chosen offer and exact SHA.
9. Inspect the persisted Master Evidence Registry snapshot for exact SHA, offer/catalog/gate version, blocker/warning counts, and no secrets/PII.
10. If the outcome is `BLOCKED`, report the exact remaining P0 evidence requirements. Expected unavoidable external blockers may include legal-review evidence or other human/provider evidence; do not mark the release sellable until those are supplied and a fresh gate returns `SELLABLE`.
11. If and only if the outcome is `SELLABLE`, record the verified offer/version/SHA and proceed to the next business program: entity/IP/contract package/pricing-margin policy/first-customer acquisition.

**Final evidence rule:** A green build, merged PR, Vercel status, Cloudflare deploy, or reachable website by itself is insufficient. Completion requires exact-SHA production verification plus a fresh Commercial Release Gate result, and the final report must clearly distinguish technical production readiness from commercial sellability.
