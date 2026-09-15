# ATLAS Hospitality NFC + BLE Hybrid V2.1 — Sovereign SDD Handoff

Execute the approved ATLAS Hospitality NFC + BLE Hybrid V2.1 implementation using Superpowers Subagent-Driven Development.

Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
Execution branch: `feat/hospitality-wallet-hotel-key`
Control-plane authority: ATLAS Manager on Supabase `atlas-core`
Public edge: Cloudflare

Read first and treat as binding:

1. `docs/superpowers/specs/2026-09-13-atlas-hospitality-nfc-ble-hybrid-v2-design.md`
2. `docs/superpowers/plans/2026-09-13-atlas-hospitality-nfc-ble-hybrid-v2.md`
3. `docs/superpowers/specs/2026-09-12-atlas-hospitality-wallet-hotel-key-design.md`
4. `docs/superpowers/plans/2026-09-12-atlas-hospitality-wallet-hotel-key-implementation.md`
5. `docs/architecture/ATLAS_MANAGER_SPEC.md`

## Mandatory prerequisite reconciliation

Before V2.1 Task 1, inspect the execution branch for the complete Wallet Hotel Key prerequisite implementation.

The prerequisite is complete only if its Core → PMS Ingest → Wallet Delivery implementation and verification evidence are actually present in git. A prior chat/PR comment claimed an ephemeral final SHA `10980a4d88594df3787c41c7e399b32d32e5daf0`, but that SHA was not resolvable in GitHub. Do not treat that report alone as implementation evidence.

If the prerequisite implementation is absent or partial:

- execute `docs/superpowers/plans/2026-09-12-atlas-hospitality-wallet-hotel-key-implementation.md` and its three detailed plans first;
- preserve the V2.1 spec/plan/handoff already committed to the branch;
- publish every reviewed prerequisite task commit to `feat/hospitality-wallet-hotel-key` so the work is durable in the canonical repository;
- rerun the prerequisite final gate before starting the V2.1 delta.

If equivalent prerequisite code already exists on another reachable branch/commit, reconcile it into the execution branch without force-reset/force-push, review the resulting diff, and rerun the final gate.

## Sovereign execution protocol

- Use an isolated git worktree.
- Fetch current `origin/main` before implementation and reconcile newer `main` changes into the feature branch without force-reset or force-push.
- Preserve all approved Hospitality specs/plans/handoffs and all newer `main` changes.
- Maintain this plan's ledger under `.superpowers/sdd/2026-09-13-atlas-hospitality-nfc-ble-hybrid-v2/progress.md`.
- Run the required SDD preflight pair/interface scan and record rulings in the ledger.
- Use a fresh implementer per non-batched task, TDD, task-scoped spec review, task-scoped quality/security review, fix/re-review loops, and a final whole-branch review.
- Execute V2.1 Task 1 → Task 8 continuously after the prerequisite gate passes.
- Publish each task's reviewed commits to `feat/hospitality-wallet-hotel-key` after the task gate is clean so no completed work remains only in an ephemeral worktree.
- Never invent undocumented Onity DirectKey endpoints, BLE frames, NFC credential formats, cryptographic fields, provider tokens, or wallet behavior.
- Do not create `hospitality_device_credentials` or `payload_data`.
- Never store or expose raw NFC/RFID dumps, reproducible card UIDs, BLE unlock frames, facility/master keys, encoder secrets, private keys, decrypted provisioning tokens, provider bearer tokens, or reusable guest unlock secrets.
- Onity DirectKey remains `configured_unverified` and fail-closed until official authorized provider/property configuration is verified.
- A photo identifying Onity hardware is discovery evidence only and never proves DirectKey/BLE readiness.
- Remote door unlock remains out of scope.

## External side-effect gates

Do not perform any of the following without a separate explicit human approval at that point:

- merge to `main`;
- production Supabase migration/DDL application;
- production Edge Function deployment;
- production Cloudflare deployment or routing changes;
- production secret creation/rotation;
- provider onboarding that incurs cost;
- provider-credit spend;
- enabling a live property automation policy;
- issuing a real guest credential at a live hotel;
- any physical access test against a live room.

Feature-branch commits and pushes required to make reviewed SDD work durable are authorized. Do not force-push.

## Final verification

On the exact final feature-branch SHA run:

```bash
npm ci
npm audit --audit-level=high
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Also run the focused V2.1 suite:

```bash
npx vitest run \
  tests/unit/hospitality-hybrid-access.test.ts \
  tests/unit/hospitality-onity-adapter.test.ts \
  tests/integration/hospitality-hybrid-schema-contract.test.ts \
  tests/integration/hospitality-hybrid-api-contract.test.ts \
  tests/integration/hospitality-hybrid-lifecycle.test.ts \
  tests/integration/hospitality-hybrid-ui-contract.test.tsx \
  tests/integration/hospitality-security-contract.test.ts
```

Run the prerequisite Wallet/PMS focused suites as required by their binding plans on the same final SHA.

## Completion report

Report:

- final durable GitHub SHA;
- prerequisite Wallet Hotel Key status and durable task commits;
- V2.1 Task 1–8 status/commit ledger;
- RED/GREEN evidence per task;
- per-task spec/quality review outcomes;
- final whole-branch review verdict;
- exact final verification commands/results;
- all `Ruling:` lines from the ledger;
- Onity readiness and blocker;
- remaining Wallet/NFC/provider/property external prerequisites;
- production actions intentionally not performed;
- exact classification values:
  - `implementation_verified`
  - `external_gates_pending`
  - `production_ready`

If official Onity/property onboarding is still unavailable after all code/tests pass, the expected truthful classification is:

```text
implementation_verified = true
external_gates_pending = true
production_ready = false
```

Do not describe the system as 100% production-ready until the controlled authorized live-property validation required by the spec is completed.
