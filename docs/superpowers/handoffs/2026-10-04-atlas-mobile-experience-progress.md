# SDD ledger — plan: docs/superpowers/plans/2026-10-04-atlas-mobile-experience.md

Execution method: Native / inline.

Ruling: local worktree unavailable because the execution container cannot resolve github.com; use the already-isolated feature branch `spec/atlas-mobile-experience-2026-10-04` as the workspace and GitHub Actions as the executable test environment — preserves branch isolation and test evidence, but test turnaround depends on CI rather than local commands — cost if wrong: slower feedback and less direct local inspection.

Pre-flight shared interfaces:
- Foundation -> Assistant: `MobileRuntimeSnapshot` / capability state consumed by Assistant mobile UI. Clean; Assistant will import shared domain types rather than duplicate them.
- Foundation -> Evidence/Support: mobile gateway and settings shell consumed by privacy/billing/diagnostics. Clean; sensitive state remains server-authoritative.
- Foundation/Evidence -> Apple native: normalized runtime/permission/billing envelopes consumed by bridge payloads. Clean; native bridge must not imply a native host exists.
- Evidence/Support -> Master closeout: persisted preferences, diagnostics and billing states consumed by final account/preferences/about and production checks. Clean.

Global gate: no `verified`, `granted`, `paid`, `active`, `restored`, `connected` or equivalent success state without authenticated/current evidence.

Foundation Task 1: Ruling: GitHub Contents commits each file mutation separately, so the task cannot be represented by one atomic implementation commit through this connector; preserve the exact RED→GREEN sequence and focused file set instead — cost if wrong: noisier history, not a runtime behavior change.

Foundation Task 1: complete (RED head `e8547bb`: ATLAS Mobile CI run `37190368107` failed only because `packages/mobile-experience/runtime` and `permissions` did not exist; GREEN head `96a656e`: run `37190492605`, job `111401447161`, `npm ci` success, 2 test files / 8 tests passed).

Foundation Task 2: complete (RED head `095b53d`: ATLAS Mobile CI run `37190829696`, job `111402452121`; existing runtime/permission tests passed and gateway suites failed only because `supabase/functions/atlas-mobile/index.ts` did not exist. GREEN head `4a9d518`: run `37191040896`, job `111403081639`; auth, organization scope, CORS, fail-closed status and sanitized audit contract tests passed).

Foundation Task 3: complete (RED head `c06d108`: ATLAS Mobile CI run `37191154423`, job `111403429670`; existing tests passed and the client suite failed only because `apps/web/src/mobile/runtime.ts` did not exist. GREEN head `c650be2`: run `37191265405`, job `111403774748`; web runtime classification, authenticated gateway client and explicit loading/ready/error/stale hook states passed).

Foundation Task 4: complete (RED head `a602aee`: ATLAS Mobile CI run `37191520019`, job `111404519529`; 22 prior tests passed and settings tests failed only because `MobileSettingsRoutes` / `mobileSettings.css` did not exist. GREEN head `73e83e5`: run `37191830263`, job `111405471918`; mobile contracts, gateway contracts and consolidated settings route/shell tests all passed).

Foundation Task 5: RED prepared at head `65fe89e`; focused CI run `37192030215` is queued. Implementation remains blocked by the TDD gate until the RED failure is observed.
