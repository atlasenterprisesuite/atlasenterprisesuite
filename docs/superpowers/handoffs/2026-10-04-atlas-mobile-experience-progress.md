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
