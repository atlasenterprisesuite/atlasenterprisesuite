# ATLAS Spatial Interface — Subagent-Driven Development Handoff

Date: 2026-09-12
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Branch: `feat/atlas-spatial-interface`
Execution mode: Superpowers Subagent-Driven Development

## Binding inputs

Read first and treat as authoritative:

1. `docs/superpowers/specs/2026-09-12-atlas-spatial-interface-design.md`
2. `docs/superpowers/plans/2026-09-12-atlas-spatial-interface.md`
3. `AGENTS.md`

The design spec is the binding product authority. The implementation plan is the task-by-task argument from the spec. If they conflict, follow the spec and record the ruling in the SDD ledger.

## Execution instruction

Execute `docs/superpowers/plans/2026-09-12-atlas-spatial-interface.md` using **Superpowers Subagent-Driven Development**.

Use an isolated worktree for `feat/atlas-spatial-interface`. Reconcile the worktree with the latest `origin/main` before Task 1 without force-reset or force-push, preserving the already committed spec, plan, and handoff.

Continue automatically through all 10 tasks. Do not pause between tasks for user confirmation.

For every task use this exact cycle:

`task brief → failing test → verify RED → minimal implementation → focused tests → commit → independent spec-compliance review → independent code-quality review → fix/re-review loop if needed → mark task complete in the SDD ledger → next task`

Fresh implementer context per task. Do not let implementers dispatch their own reviewers. Use the Superpowers SDD progress ledger under that plan's own `.superpowers/sdd/...` workspace and resume from it if interrupted.

## Mandatory constraints

- Canonical repository remains `atlasenterprisesuite/atlasenterprisesuite`.
- `main` remains canonical.
- Do **not** merge to `main`.
- Do **not** deploy.
- Do **not** publish packages or releases.
- Do **not** spend provider credits or enable paid provider usage.
- Do **not** configure or execute AWS EC2.
- Do **not** perform mutations in Cloudflare, Vercel, Supabase production infrastructure, DNS, secrets, or GitHub infrastructure outside this feature branch.
- Supabase source code/migrations/Edge Function code may be implemented and tested in-repo, but no production mutation or function deployment is authorized.
- Reuse current ATLAS Identity, organization membership, shell, Supabase patterns, and shared `audit_logs`.
- No fake camera, microphone, WebGL, Voice, Connect, Automations, Health, backend, or provider readiness.
- Camera must start only after explicit user action.
- Raw video frames and instantaneous landmarks are ephemeral and must not be persisted.
- Gesture remains additive: keyboard, pointer, touch, semantic DOM, and assistive alternatives remain functional.
- Tier 3 actions require owner-module authorization.
- Tier 4 actions can never be authorized by gesture alone.
- Client-side state never grants authority.
- Do not create a second Spatial database or audit system.
- Do not weaken current identity/session/tenant/RBAC boundaries to make tests pass.
- Preserve all current routes and working functionality unless the spec explicitly replaces them.

## Task sequence

Complete the plan's 10 tasks in order:

1. Spatial domain contracts and capability model
2. Risk policy and gesture confirmation state machine
3. Vision provider contract and privacy-safe camera lifecycle
4. MediaPipe hand landmarks and deterministic gesture recognition
5. Renderer-independent scene state and procedural 3D humanoid manipulation
6. Command routing, multimodal resolution, and truthful integration readiness
7. Server-authoritative Spatial authorization and shared audit logging
8. Identity-gated routes, capability detection, settings, and support pages
9. Live Workspace, spatial cursor, Privacy Mode, deliberate confirmation, non-gesture alternatives, focus/visibility cancellation
10. Production hardening, Playwright/E2E, CI/readiness documentation, full validation, and final whole-branch review

Use the exact interfaces, values, thresholds, routes, and tests specified by the plan unless the spec requires a correction. Record any correction as `Ruling:` in the ledger.

## Required final validation

After Task 10 and before claiming implementation complete, run from repository root:

```bash
npm ci
npm run typecheck
npm run test:unit
npm run test:integration
npm test
npm run build
```

Run the plan's browser/E2E verification if Playwright dependencies/browser installation are available without paid external services. If a local browser binary is unavailable, record the exact blocker instead of claiming E2E passed.

Also run the repository's relevant security/readiness checks for the changed scope. Do not deploy merely to validate production behavior.

## Final review

After all task reviews pass, perform one broad whole-branch code review from the merge-base with current `main` through HEAD using the Superpowers requesting-code-review workflow.

If the final review finds issues, use one fix wave and one scoped re-review, then adjudicate any residual findings according to the SDD skill and record every ruling in the ledger.

## Completion output

Finish with:

- task-by-task commit list
- tests actually run and their results
- final whole-branch review verdict
- any deferred minor findings
- every `Ruling:` from the ledger, with cost if wrong
- exact remaining blockers/dependencies, if any
- branch HEAD SHA

Stop at the completed feature branch. Do not merge and do not deploy.
