# ATLAS Hospitality Discover — Subagent-Driven Execution Handoff

Date: 2026-09-12
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Feature branch: `feat/hospitality-discover-local-commerce`
Execution mode: Superpowers Subagent-Driven Development

## Authority

Canonical spec:
`docs/superpowers/specs/2026-09-12-atlas-hospitality-discover-local-commerce-design.md`

Execution roadmap:
`docs/superpowers/plans/2026-09-12-atlas-hospitality-discover-roadmap.md`

Plan order:
1. `docs/superpowers/plans/2026-09-12-atlas-hospitality-discover-core.md`
2. `docs/superpowers/plans/2026-09-12-atlas-hospitality-source-governance.md`
3. `docs/superpowers/plans/2026-09-12-atlas-hospitality-map-concierge.md`
4. `docs/superpowers/plans/2026-09-12-atlas-hospitality-local-commerce.md`
5. `docs/superpowers/plans/2026-09-12-atlas-hospitality-partners-campaigns-analytics.md`
6. `docs/superpowers/plans/2026-09-12-atlas-hospitality-assistant-integrations.md`

## Mandatory start sequence

1. Use `superpowers:using-git-worktrees` and execute in an isolated worktree.
2. Fetch the latest `main` and reconcile the feature branch before implementation. At handoff time the feature branch was observed as 9 commits ahead and 4 commits behind `main`; verify again rather than assuming this remains current.
3. Preserve every commit already containing the approved spec/plans. Do not force-reset or force-push the branch.
4. Run `npm ci` and the clean-baseline verification before changing implementation code.
5. Use `superpowers:subagent-driven-development` for the active plan.
6. Create and maintain the plan-specific `.superpowers/sdd/<plan-basename>/progress.md` ledger.
7. Execute one implementation task at a time. Never dispatch multiple implementers concurrently against the same worktree.
8. Every task uses TDD: failing test -> observed failure -> minimal implementation -> passing focused test -> broader applicable verification -> commit.
9. Every completed task gets an independent spec-compliance and code-quality review before the next task starts.
10. Do not merge, push to shared/protected branches, publish, deploy, or apply production migrations without the normal approval gate.

## Product rulings

- Discover & Local Commerce is a separate Hospitality domain from privileged `Hospitality Access`.
- Existing Access routes, authorization, credential handling, and provider boundaries must not be weakened or reused as public Discover authorization.
- Reuse ATLAS identity, tenant/org boundaries, Supabase, audit, shared shell/navigation, ATLAS Manager and existing module contracts.
- Do not duplicate CRM, Ride, Pay, Creator Studio, Accounting, mapping, or source-of-truth systems.
- External integrations remain fail-closed until verified.
- No fake ratings, prices, opening hours, deal inventory, conversion metrics, availability, live status, or production state.
- No unauthorized copying/scraping of protected third-party maps, descriptions, images, coupons, advertisements, or private APIs.
- Sponsored content remains visibly distinct from organic ranking and must never silently influence high-stakes recommendations.
- Public production verification is separate from build/CI success.

## First execution target

Start with:
`docs/superpowers/plans/2026-09-12-atlas-hospitality-discover-core.md`

Before Task 1, perform the SDD pre-flight conflict/interface scan required by the skill and record the table/rulings in the plan ledger.

Do not skip directly to Map, Deals, Campaigns, or Assistant work before the Core contracts they consume exist and pass review.

## Required completion evidence

For each task record:
- base commit;
- implementer identity/model;
- test failure observed before implementation;
- implementation commit(s);
- passing focused tests;
- reviewer verdict for spec compliance;
- reviewer verdict for code quality;
- any ruling/fix rounds.

For each plan run the verification required by that plan. Before declaring the complete Discover milestone source-valid, run at minimum:

```bash
npm ci
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

A green result validates repository source only. Deployment, applied schema, external provider readiness, and public production behavior require separate evidence.
