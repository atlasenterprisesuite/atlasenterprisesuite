# ATLAS Historical Convergence Register

Date: 2026-09-15
Canonical target: `main`

## Status vocabulary

- **ACTIVE CURRENT-MAIN** — current work may continue, but must be reconciled to the latest `main` before merge.
- **SALVAGE** — recover unique verified capability through a new/focused current-main-based PR; do not bulk merge the historical branch.
- **SUPERSEDED** — a newer canonical implementation or PR owns the capability; preserve history but do not integrate the older branch.
- **EXTERNAL-GATED** — source may be valid, but production completion depends on provider/hardware/human authorization or validation.

## High-priority classifications

| Work | Classification | Canonical ruling |
| --- | --- | --- |
| PR #13 `release: ATLAS A-Z closure` | SALVAGE | Never bulk merge. Recover unique accounting/people/business/spatial capability module-by-module against current `main`. Its old runner/provider assumptions are historical evidence, not current truth. |
| PR #149 `ATLAS Assistant from web shell` | SALVAGE / RECONCILE | Architecture is correct: React shell owns UI; `atlas-copilot` is API. Reconcile only unique current value against newer Assistant work. |
| PR #70 old Assistant avatar/voice | SUPERSEDED | Superseded by current-mainline Assistant work in PR #161. |
| PR #161 current-mainline Assistant avatar/voice | ACTIVE CURRENT-MAIN | Preferred Assistant convergence candidate after repository-hardening closure; must rebase/reconcile with current session/module-registry changes and pass current gates. |
| PR #107 Work Soberano | SALVAGE | Extend canonical Guided/Universal Execution rather than merge a competing execution line. |
| PR #110 Universe UI | SALVAGE | Universe must consume the canonical module registry and shell; never become a parallel application. |
| PR #112 Hospitality OS core | SALVAGE / ACTIVE DOMAIN | Hospitality owner direction is valid; reconcile against the existing current-main Hospitality routes/access contracts. |
| PR #118 Hospitality U.S./hotel-key validation | EXTERNAL-GATED / SALVAGE | Preserve only authorized provider-neutral contracts; physical lock/key claims require real property/provider validation. |
| PR #88 Wallet Hotel Key | EXTERNAL-GATED / SALVAGE | Must remain subordinate to Hospitality OS and provider authorization. |
| PR #100 Ride hardening | SALVAGE | Recover only missing atomic lifecycle/routing fixes after comparison with current `main`. |
| PR #73 full Accounting foundation | SALVAGE | Recover missing AR/GL/bank/reconciliation/close slices without replacing stronger current AP/current migrations. |
| PR #155 Vitest 5 dependency update | ACTIVE DEPENDENCY REVIEW | Breaking major upgrade; merge only after the full current verification contract is green. |
| PR #166 Connected Apps gateway | ACTIVE CURRENT-MAIN | Continue as shared integration foundation; do not create provider-specific parallel control planes. |
| PR #167 Insurance verification | ACTIVE DOMAIN | Keep provider truth and verification boundaries; reconcile after shared hardening. |
| PR #171 Identity security closeout | ACTIVE SECURITY | Security work may supersede older identity findings; it must preserve the AAL2/RLS/source-reconciliation invariants and pass current gates. |

## Consolidation rule

No open PR is entitled to merge merely because it predates current `main` or previously passed a historical CI run. Before integration, compare it against current `main`, identify unique capability, discard duplicate/obsolete infrastructure assumptions, re-run the current verification contract, and preserve one canonical owner per capability.

Large historical branches are evidence and salvage sources, not alternate production truth.
