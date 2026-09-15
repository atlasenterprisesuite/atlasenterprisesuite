# ATLAS Open Work — Canonical Reconciliation Register

Date: 2026-09-13
Canonical target: `atlasenterprisesuite/atlasenterprisesuite` → `main`

## Purpose

ATLAS currently has substantial useful work spread across open pull requests and the divergent A-Z branch. This register prevents the project from treating every branch as a separate future product. Each open change must resolve to one of four outcomes:

- **FINISH + MERGE** — capability is still canonical and should land after evidence gates.
- **RECONCILE** — preserve unique verified work, but adapt it to stronger/newer `main` architecture.
- **CONSOLIDATE** — overlapping branches must become one implementation before merge.
- **SUPERSEDE / ARCHIVE** — current `main` or a newer program already replaces the branch; retain evidence/history, do not merge the old branch wholesale.
- **EXTERNAL-GATED** — source implementation can remain, but a provider/hardware/human validation dependency prevents a live claim.

This is a convergence register, not permission to mass-merge.

## Current open PR classification

| PR | Capability | Disposition | Auditor ruling |
|---:|---|---|---|
| #113 | Truth audit + production runner closure | FINISH + MERGE | Primary Wave 0 closure PR. Merge only after exact-head executable CI evidence. |
| #112 | Hospitality OS Core | FINISH + MERGE / RECONCILE | Strategic canonical vertical. Preserve current `/hospitality` compatibility and merge only after full core verification. |
| #111 | Native command surface | RECONCILE | Verification-only surface. Reconcile against Guided Execution/Work Soberano before deciding whether it remains independent. |
| #107 | Work Soberano | FINISH + MERGE / RECONCILE | Important execution layer; must extend current Guided Execution and existing Universal Execution contracts, not replace them. |
| #110 | ATLAS Universe UI | RECONCILE | Approved visual direction, but currently spec + RED stage. Integrate only as the canonical shell/navigation layer after module-registry convergence. |
| #88 | Hospitality Wallet / Hotel Key | EXTERNAL-GATED + RECONCILE | Keep provider-neutral credential architecture. Real hotel key issuance stays blocked until authorized PMS/lock/wallet provider integration exists. |
| #83 | Universal Execution Core documentation | RECONCILE / SUPERSEDE REVIEW | Concepts remain canonical, but current `main` already contains Guided Execution work. Preserve only deltas not already implemented. |
| #74 | Creator zero-cost core | EXTERNAL-GATED + RECONCILE | Preserve truthful local-provider registry. A real local FLUX/runtime probe is required before provider-ready claims. |
| #104 | Ride post-merge final | CONSOLIDATE | Overlaps #100. Keep a single final Ride hardening branch/PR; retire duplicate surface after evidence is preserved. |
| #100 | Ride routing + atomic compliance lifecycle | CONSOLIDATE / FINISH | Contains concrete post-merge fixes. Treat as the likely implementation source for the final Ride closure; fold #104 requirements into one verified PR. |
| #13 | A-Z closure | RECONCILE / ARCHIVE | **Never bulk-merge.** Branch is hundreds of commits both ahead and behind `main`. Use it as a capability recovery source and retire it once unique work is reconciled. |
| #5 | Site Review Center | RECONCILE | Old foundation uses in-memory persistence and preview RBAC. Reuse domain/audit ideas only after adapting to current Supabase tenant/RBAC shell. |
| #85 | Unified Intelligence with Codex | CONSOLIDATE | Overlaps #72 and #19. One intelligence bus/provider registry must survive; do not ship multiple orchestrators. |
| #73 | Full Accounting foundation recovery | RECONCILE / FINISH | High-value commercial core. Diff against current Finance/AP and A-Z accounting; merge only missing governed capabilities. |
| #82 | Creator Social Copilot | RECONCILE / SUPERSEDE REVIEW | Current `main` already contains a Business Social Publisher slice. Preserve unique social-analysis/provider contracts, remove duplicate UI/domain behavior. |
| #69 | Inclusive Communication | FINISH + MERGE / EXTERNAL-GATED | Core accessibility profile/confidence layer belongs in platform. Manual AT/Deaf/DeafBlind validation and real sign/avatar/hardware providers remain external gates. |
| #72 | OpenAI + Gemini federation / Codex contract | CONSOLIDATE / FINISH | Strong candidate for the canonical provider registry. Merge only after current-main reconciliation and real Gemini readiness evidence; consolidate #85/#19. |
| #70 | Assistant avatar + voice foundation | RECONCILE / FINISH | Approved product identity. Preserve governed `atlas-copilot` routing and truthful microphone/speech states; integrate with final shell/Universe UI. |
| #58 | Decision Compass | FINISH + MERGE / RECONCILE | Governance feature is compatible with evidence-first ATLAS. Rebase/reconcile to current shell and release controls before merge. |
| #57 | Cloudflare provider incident correlation | RECONCILE | Current ATLAS Manager has advanced since this branch. Preserve unique incident-correlation logic only if absent from current control plane. |
| #56 | Knowledge Atlas — Animal Kingdom | FINISH + MERGE | Production DB foundation reportedly exists; frontend still requires exact-head gates, current-main reconciliation and Cloudflare/public verification. |
| #43 | Supabase v2 runtime tenancy | SUPERSEDE / RECONCILE | Do not merge as authority: current approved production authority is `atlas-core`, not v2. Recover only proven tenancy/RLS improvements through deliberate migrations. |
| #27 | ATLAS Manager infrastructure status | SUPERSEDE / RECONCILE | Its Vercel-required path is obsolete under current Supabase-first/Cloudflare architecture. Preserve unique diagnostics/repair work only. |
| #39 | Personal Voice core/web flow | RECONCILE / EXTERNAL-GATED | Current `main` already has Voice surface. Recover unique consent/audit/deletion contracts; Apple/native voice remains capability-gated. |
| #36 | Connect WhatsApp Channel flow | RECONCILE / EXTERNAL-GATED | Manual handoff truth model is valid; replace development-local persistence with canonical tenant-safe persistence before commercial completion. |
| #19 | AI Collaboration Fabric | CONSOLIDATE / SUPERSEDE REVIEW | Overlaps #72/#85. Preserve governance/provider-neutral primitives only; one canonical intelligence router/orchestrator must remain. |
| #14 | Telecom MiFi | EXTERNAL-GATED | Safe unavailable-adapter pattern is acceptable; real carrier/hardware operations cannot be live until exact device, authorized bridge and read-back verification exist. |
| #12 | Core prerequisite for Health | SUPERSEDE REVIEW | Current `main` already has Core/Shell/Health structures. Close after confirming no unique governance contract remains. |
| #6 | Disease Reconstruction Lab | RECONCILE / SUPERSEDE REVIEW | Current `main` already exposes disease-reconstruction routes. Preserve only unique evidence/falsification/curability safeguards not already integrated. |

## Consolidation decisions

### Intelligence

Canonical direction: one `atlas-copilot` / intelligence bus with a provider registry and explicit provider readiness. Reconcile #72, #85 and #19 into one implementation; OpenAI remains current verified runtime evidence, Gemini/Codex/Copilot remain truthful capability states until separately proven.

### Ride

Canonical direction: one post-merge hardening PR. Use #100 as the concrete transactional/routing fix source unless diff review disproves that choice; absorb #104 acceptance criteria and retire duplicate branch state.

### Hospitality

Canonical direction: Hospitality OS Core (#112) owns the domain model. Wallet/Hotel Key (#88) becomes a subordinate integration capability, never a parallel Hospitality application.

### Shell / execution

Canonical direction: current `main` Guided Execution + Universal Execution primitives remain the execution base. Work Soberano (#107), native command surface (#111), Universal Execution docs (#83) and Universe UI (#110) must converge around the same workflow/approval/evidence/RBAC state rather than introducing alternate shells or workflow engines.

### Supabase

Canonical production authority remains `atlas-core` (`ggmanzcgtlrvqfoccgsh`). `atlas-core-v2` and v2 branches are evidence/recovery sources until an explicit audited cutover is approved. No branch may silently change the production backend authority.

## Exit rule

The open-work backlog is considered controlled when every PR above has either:

1. merged into current `main` with exact evidence;
2. had unique verified work reconciled into another canonical PR and then been closed as superseded;
3. been explicitly retained as an external-gated adapter with truthful UI state; or
4. been archived after proving it contains no unique required capability.

No open PR is allowed to remain indefinitely as an undocumented alternate ATLAS architecture.
