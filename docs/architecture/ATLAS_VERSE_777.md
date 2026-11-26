# ATLAS Verse 777 — Sovereign release preflight

Date: 2026-11-26  
Status: **PR / NOT DEPLOYED**  
Canonical component: ATLAS Manager + Release Control + ATLAS Cloud  
Route after approved deployment: `/cloud/verse` (protected by `RequireAtlasIdentity`)

## Purpose

ATLAS Verse is **an owned interface and reusable policy component**, not another provider, database, deployment engine or company service. It turns the existing Vercel-class, provider-neutral deployment architecture into a simple local evidence-checking tool. GitHub is canonical source/CI, Supabase ATLAS Manager is the release control plane, Cloudflare is canonical production edge. Vercel remains **optional** and may provide previews where deliberately used.

Related existing contracts:

- [ATLAS Deploy Control Plane](../superpowers/specs/2026-10-04-atlas-deploy-control-plane-design.md)
- [ATLAS Manager](../architecture/ATLAS_MANAGER_SPEC.md)
- [Master autonomous execution](../governance/ATLAS_MASTER_AUTONOMOUS_EXECUTION_PROTOCOL.md)
- Existing `/cloud/releases`, `/cloud/production-verification`, `/execution/manager/readiness`

## Implemented slice v1

1. An authenticated ATLAS Cloud route `/cloud/verse`, linked from the existing Cloud console.
2. A read-only browser-local form: source SHA, observed deployment SHA, provider, environment, deployment identity, build/runtime evidence and required/optional checks.
3. A pure, tested parser for newline-separated `required|check-name|success` or `optional|check-name|failure` entries. Duplicates and invalid statuses are rejected; 50-check limit.
4. An evidence policy that blocks missing/non-40-hex SHA, SHA mismatch, missing deployment ID, failed/unverified build or runtime, missing/failing required checks, and non-Cloudflare production claims.
5. Optional failed checks are warnings **only if the operator truthfully marked them optional based on the current GitHub rulesets**.
6. A downloadable-by-copy local JSON diagnostic report containing `productionVerified: false` and `evidenceSource: operator_input`. No browser network call to a third-party model or deployment provider is made by Verse v1.

**Limit**: Values are operator-entered and not independently authenticated, therefore even a fully green preflight returns `candidate_only`; it NEVER declares `verified_production`. It does not automate build, deploy, merge, rollback, DNS, billing or API-key management. The existing tools retain those responsibilities.

## Legacy Vercel Hobby diagnostic

The historical check `Vercel – atlas_enterprise_suite` originated from the old `winderaranguren-gifs-projects` Hobby account and could fail due to daily deployment quota. The approved Pro project is `atlasenterprisesuite`, and the Cloudflare production path does not require Vercel.

A stale failure must NOT be changed to green, suppressed or ignored if a current branch ruleset explicitly requires it. Before classifying it as optional, inspect current GitHub required check contexts and the selected provider's verified deployment target. For the previously observed two `main` rulesets, Vercel did not appear as required; rule configuration may change, so it must be rechecked before release.

## Security requirements

- The route inherits authenticated Cloud navigation; server-side authorization of real release operations remains in ATLAS Manager.
- No secrets, personal information, API keys, tokens, or cross-tenant evidence may be pasted into the form.
- No runtime status is trusted because a human entered `success`.
- Only signed/authorized backend evidence and the existing exact-SHA P0 production verifier can certify readiness.
- No new provider API connection, CI requirement, cloud purchase, Notion synchronization daemon or secret store.
- No workspace data is sent from the Verse form to Notion; Notion holds versioned architecture/handoff notes only.

## Verification contract

- `npm run typecheck`
- `npm run test:unit -- tests/unit/atlas-verse-preflight.test.ts` (or run the focused Vitest test directly)
- `npm run build`
- Existing GitHub-required Consensus, CodeQL, Build Readiness, Security Baseline, council-security gates on exact PR head SHA.
- Production E2E requires auth and exact SHA at `https://www.atlasenterprisesuite.com/cloud/verse`; a Vercel `READY` preview is NOT equivalent.

## Next owned slices (not claimed implemented)

- Read-only, authenticated `atlas-release-control` evidence ingestion into the preflight so manual entry is optional, with tenant-scoped filtering and no client secrets.
- Native GitHub ruleset/required-check snapshot through a governed backend adapter; never guess requirements.
- Durable deployment queue and rate-limit-aware deduplication reusing `packages/core/src/deploymentControl.ts`, not a new queue.
- Cloudflare Workers deployment proofs, rollback approval workflow, and immutable artifact/evidence ledger.
- Notion knowledge synchronization through permission-scoped tooling; no unattended cross-app data export without explicit authorization.

## Definition of done

This slice is **source-implemented** after the PR is created and CI checked. It is **not** merged, deployed, production-ready or a standalone Vercel replacement unless the corresponding exact-SHA evidence and operational gates prove it.
