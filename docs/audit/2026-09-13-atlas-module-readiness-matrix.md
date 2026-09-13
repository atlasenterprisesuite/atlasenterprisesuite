# ATLAS Enterprise Suite — Module Readiness Matrix

Date: 2026-09-13
Canonical source reviewed: `main` at `ea8c347e9421033bee1c39fd279c392fbe2aaad6`

## Status vocabulary

- **VERIFIED PROD** — current production evidence exists for the capability itself.
- **DEPLOYED / BLOCKED** — deployed component exists, but a current production gate is blocked.
- **IMPLEMENTED MAIN** — implementation is present in current `main`; exact-current-main production deployment is not proven.
- **PARTIAL MAIN** — meaningful implementation exists in `main`, but required commercial scope is incomplete.
- **OPEN / RECONCILE** — implementation exists on an open branch/PR and must be reconciled before becoming canonical.
- **DESIGNED** — approved design/spec/plan exists without enough canonical implementation evidence.
- **EXTERNAL-GATED** — depends on authorized provider/hardware/human validation for a live claim.
- **MISSING FROM CURRENT MAIN** — required commercial capability is not represented as a canonical current-main module/package at the audited level.

## Platform and shared services

| Capability | Current state | Evidence / remaining gate |
|---|---|---|
| Core tenancy / governance | DEPLOYED / NEEDS ATTENTION | Authoritative `atlas-core` is healthy; governance verifier passes but reports `needs_attention`. Current-main exact artifact still not production-proven. |
| Identity / Auth / Organization / RBAC | DEPLOYED / BLOCKED | Real identity functions and UI exist. Runtime verifier reports `privileged_mfa_incomplete`; leaked-password protection disabled; production identity RPC source drift exists. |
| Audit / security events | IMPLEMENTED + DEPLOYED BACKEND | Identity/governance/release audit structures exist. Needs current-main end-to-end verification and security closure. |
| Universal / Guided Execution | IMPLEMENTED MAIN | `/execution/:workflowId` and current Guided Execution landed in `main`; Work Soberano/native-command/Universal docs still need convergence. |
| Approval Center | PARTIAL MAIN / RECONCILE | Shared execution/governance concepts exist; final universal surface and “approve all” governance behavior require canonical consolidation. |
| ATLAS Assistant | OPEN / RECONCILE | Current intelligence runtime exists; approved avatar/voice shell remains open in #70 and must converge with final shell. |
| Intelligence / ATLAS Copilot | VERIFIED PROD for current OpenAI request path | Current runtime verifier passes OpenAI request verification. Gemini/Codex/provider federation branches remain unmerged/unverified as live providers. |
| ATLAS MCP / agent registry | IMPLEMENTED MAIN | Shared packages exist; execution authority/provider truth still must converge with intelligence branches. |
| Observability | VERIFIED PROD backend | Current production verifier reports observability operational. Web/release integration still needs exact-main deployment proof. |
| Release control | VERIFIED PROD backend | Release-control verifier passes. Current web artifact is not proven to equal current `main`. |
| Backup / restore / disaster recovery | PARTIAL / NOT CURRENTLY PROVEN | Historical architecture and release controls exist; fresh restore rehearsal evidence is still required. |
| Notifications / universal search | PARTIAL / MISSING COMMERCIAL GATE | No complete current-main cross-suite commercial verification found. |
| Settings / Security Center | PARTIAL MAIN | Identity/settings/security concepts exist, but final unified Settings/Security module and privileged MFA/passkey policy are incomplete. |
| Passkeys / biometrics / ATLAS OS identity | DESIGNED / OPEN HISTORICAL WORK | Approved direction exists, but it is not part of audited current `main` production behavior. |
| ATLAS Universe shell | OPEN / RECONCILE | #110 is spec + RED stage. Must become the canonical shell layer, not a parallel app. |
| Work Soberano | OPEN / RECONCILE | #107 remains a draft implementation and must extend current Guided/Universal Execution. |

## Core commercial business suite

| Module | Current state | Auditor ruling |
|---|---|---|
| Finance | PARTIAL MAIN | Canonical web Finance routes exist; full commercial breadth still depends on Accounting/Revenue/treasury reconciliation. |
| Accounting | PARTIAL MAIN + OPEN / RECONCILE | `packages/accounting` and AP/current Finance exist; #73 and A-Z contain broader accounting. Recover missing AR/GL/bank/reconciliation/close selectively. |
| Accounts Payable | IMPLEMENTED MAIN | Current route and CI workflow exist. Needs exact-current-main executable gate + production verification. |
| Accounts Receivable | MISSING/INCOMPLETE CURRENT MAIN | Commercial requirement; broader implementation exists historically/A-Z but is not a complete canonical current-main surface. |
| General Ledger / Journals / Close | PARTIAL / RECONCILE | Domain work exists across accounting/A-Z/backend, but a full current-main commercial workflow is not proven. |
| Cash / Bank reconciliation | OPEN / RECONCILE | Recover verified accounting capability from A-Z/#73; do not duplicate sources of truth. |
| CRM | MISSING FROM CURRENT MAIN commercial surface | Required for commercial v1. Recover/rebuild against current tenant/RBAC architecture. |
| Sales / Revenue Ops | PARTIAL MAIN + RECONCILE | Business social and automotive sales reporting exist; canonical CRM/sales order/revenue pipeline remains incomplete. |
| Inventory | MISSING FROM CURRENT MAIN module surface | Required commercial v1; A-Z contains recoverable work. |
| Purchasing / Vendors | MISSING FROM CURRENT MAIN module surface | Required commercial v1; reconcile A-Z rather than create a third implementation. |
| POS | MISSING FROM CURRENT MAIN module surface | Universal Execution POS plans exist, but canonical current-main functional POS is not established. |
| Projects / Work | PARTIAL / OPEN | Guided Execution exists; full Projects/Work business module and Work Soberano remain incomplete. |
| HR / People | MISSING FROM CURRENT MAIN top-level module | Large People/HR work exists historically/A-Z; must be recovered selectively. |
| Payroll | PARTIAL MAIN | Dedicated current-main web module exists; commercial payroll calculation/compliance/provider scope still requires complete verification. |
| Time & Attendance / Timecards | MISSING/RECONCILE | Historical/A-Z People work exists; not a complete current-main module. |
| Recruiting / Assessments | MISSING/RECONCILE | Historical/A-Z designs/work exist; not canonical current-main commercial surface. |
| Compensation / Benefits | MISSING/RECONCILE | Required People depth; no complete current-main module verified. |
| Analytics / reporting hub | MISSING/FRAGMENTED | Individual reports exist, but universal Analytics/reporting module is not complete. |
| Multi-company / consolidation | PARTIAL BACKEND / RECONCILE | Database/accounting artifacts exist, but commercial UI/workflows and performance hardening remain incomplete. |

## Vertical and ecosystem modules

| Module | Current state | Auditor ruling |
|---|---|---|
| Creator Studio | IMPLEMENTED MAIN + EXTERNAL-GATED | Current web/package/edge implementation exists. Zero-cost/local providers and social publishing require truthful provider readiness. |
| Social Publisher | IMPLEMENTED MAIN / RECONCILE | Business Social Publisher is in current `main`; reconcile unique #82 Social Copilot work instead of duplicating. |
| ATLAS Voice | PARTIAL MAIN + EXTERNAL-GATED | Current Voice module exists; Personal Voice/provider/native capabilities remain gated/reconciliation work. |
| ATLAS Connect | OPEN / EXTERNAL-GATED | WhatsApp Channel manual-handoff branch is truthful but lacks canonical production persistence/live provider publishing. |
| Hospitality | PARTIAL MAIN + OPEN | Current Hospitality module/package/access adapter exists. Hospitality OS Core #112 should become owner; Wallet/Hotel Key stays subordinate/external-gated. |
| Ride | IMPLEMENTED MAIN + OPEN HARDENING | Current module/package exists; final routing/transactional compliance hardening must consolidate #100/#104. |
| Health | PARTIAL MAIN | Health Research/frontier/disease routes and shared package exist. Clinical provider/live-hospital claims remain gated and many health concepts are research-only. |
| Learning / Education | PARTIAL MAIN | Learning/neuroplasticity exists; the full global K–university/postgraduate education system remains incomplete. |
| Knowledge Atlas | OPEN / RECONCILE | Animal Kingdom branch has governed work but is not yet current-main/publicly verified; broader Knowledge Atlas is incomplete. |
| ATLAS Tax | PARTIAL MAIN | IRS monitor package/workflow exists; full tax preparation/filing/compliance product is not current-main complete and filing rails must stay gated. |
| ATLAS Pay | MISSING / EXTERNAL-GATED | Financial-rail product remains incomplete; real money movement requires regulated provider integration and explicit controls. |
| Insurance Hub | MISSING/PLANNED | No complete canonical current-main module established. |
| Telecom | OPEN / EXTERNAL-GATED | #14 correctly uses unavailable-adapter semantics; real carrier/hardware control is not verified. |
| GPS / Spatial / 4D maps | RECONCILE / HISTORICAL | A-Z contains spatial work; current-main canonical product surface is incomplete. |
| CleanScan 3D | MISSING/PLANNED | No complete audited current-main module. |
| ATLAS Drive | MISSING/PLANNED | No complete audited current-main native storage/product module. |
| ATLAS Office Intelligence (Docs/Sheets/Present/Mail/etc.) | DESIGNED / NOT CURRENT MAIN | Historical approved product family exists; no complete canonical implementation audited in current `main`. |
| Site Review Center | OPEN / RECONCILE | #5 has an old in-memory foundation; must migrate to current Supabase/tenant/RBAC architecture. |
| Decision Compass | OPEN / RECONCILE | #58 has governed design/implementation but remains unverified/unmerged. |
| Inclusive Communication | OPEN + EXTERNAL/HUMAN-GATED | #69 provides strong accessibility foundation; real AT/sign-language/human validation gates remain. |
| Parks / AutoWash / Venezuela / other experimental verticals | DESIGNED / HISTORICAL / RECONCILE | Keep as roadmap unless a current-main capability and business owner are proven; they must not block commercial v1. |

## Public and commercial product

| Capability | Current state | Auditor ruling |
|---|---|---|
| `www.atlasenterprisesuite.com` public website | BLOCKED | Currently protected by Cloudflare Access, so anonymous commercial/public verification fails. |
| Protected enterprise workspace | PARTIAL / ACCESS-GATED | Zero Trust exists at the domain boundary, but exact current-main web deployment is not proven. |
| Public product/module pages | MISSING/NOT PUBLICLY VERIFIED | Required before commercial-complete claim. |
| Contact / request-demo flow | MISSING/NOT PUBLICLY VERIFIED | Required commercial gate. |
| Terms of Service / Privacy in production navigation | MISSING/NOT VERIFIED | Draft legal text exists outside current public site, but production routes/navigation were not found/verified. |
| Enterprise onboarding | PARTIAL BACKEND / INCOMPLETE SURFACE | Organization provisioning/invitation backend exists; public/commercial onboarding and privileged MFA gate remain incomplete. |

## Commercial-v1 cut line

ATLAS should **not** wait for every ambitious vertical to reach full production depth. Commercial v1 should close this minimum canonical line first:

1. Core identity/tenant/RBAC/audit/security + privileged MFA.
2. Stable shell/module registry/Guided Execution/Approvals/Assistant.
3. Finance + Accounting AP/AR/GL/bank/reconciliation/reporting.
4. CRM + Sales + Purchasing + Inventory.
5. HR + Payroll foundation + Time/Recruiting essentials.
6. POS + Projects/Work foundation.
7. Creator/Hospitality/Ride/Health/Learning surfaced truthfully at their actual readiness state.
8. Observability/release/backup/rollback/security/tenant isolation gates.
9. Public marketing/legal/contact surface separated from the protected workspace.
10. Exact current release deployed and independently verified on Cloudflare/domain.

Everything beyond that line can continue as governed vertical expansion without holding the entire Enterprise Suite hostage to unfinished provider integrations.