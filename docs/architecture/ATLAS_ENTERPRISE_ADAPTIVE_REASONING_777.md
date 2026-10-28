# ATLAS Enterprise DNA/RNA 777 — Adaptive reasoning (E0)

Date: 2026-10-28
Status: **Branch-only implementation; CI, production and authenticated E2E unverified**
Base main commit: `6f7bc8bf7ccb4c50afb347281c934b4cf1925786`
Related open draft work: PR #781 (Enterprise DNA) and PR #812 (P0 verification).

## Intent
Reuse the canonical `/assistant` surface, `atlas-copilot` intelligence gateway,
provider registry, cost policy and tool governance. This is an independent ATLAS
capability inspired by publicly documented enterprise AI workflows, not a copy
of OpenAI's internal model, subscription, authorization system or private code.

## Implemented contract in this isolated branch (not production)
- `intent: 'auto'` selects a deterministic `fast | balanced | deep` profile
  before provider routing. Manual profiles remain authoritative.
- The first classifier uses only the **current submitted message**. It does
  not yet measure the entire authenticated conversation. Long or high-assurance
  engineering/security tasks use `deep`, conventional analysis `balanced`,
  simple messages `fast`.
- The classifier returns only `profile` and a fixed reason category, never
  the text, actor identity, tenant or sensitive source material.
- The existing provider verification, explicit-mode no-fallback rule, tenant
  permission checks, Tool Gateway, budget denial and emergency-budget guards
  are not changed or bypassed.
- The canonical web UI and native copilot UI offer Adaptive as default; server
  compatibility preserves `balanced` for legacy clients that omit `intent`.
- Persisted routing evidence includes `requested_profile` and
  `selection_reason`, and the response reports the actually resolved profile.

## Explicit exclusions / remaining P0 work
- No cross-chat or history-wide inference, source ingestion, ACL rewriting,
  assistant permission elevation, implicit model entitlement, billing activation,
  enterprise account upgrade or synchronization of ChatGPT private chats.
- Full conversation-aware adaptation requires loading history **after**
  authenticated tenant and conversation lookup, revalidating permissions before
  retrieval, respecting source consent and bounded token/cost budgets, and
  preventing prompt-injection from client metadata or retrieved text.
- Negative tests must cover explicit manual overrides, unknown profiles,
  zero-cost denial, missing provider readiness, cross-tenant history spoofing,
  revocation during routing, budget exhaustion, audit failure and no secret leakage.
- CI TypeScript/Vitest, authenticated E2E and deployed exact-SHA must pass
  before any production claim. Do not merge/deploy while P0 is open.

## References / continuity
- `docs/architecture/ATLAS_ENTERPRISE_INTELLIGENCE_PARITY.md`
- `docs/superpowers/specs/2026-09-15-atlas-unified-ai-chat-design.md`
- `docs/superpowers/specs/2026-10-04-atlas-max-design.md`
- PR #781 specification: `docs/superpowers/specs/2026-10-12-atlas-enterprise-intelligence-dna.md`
- PR #812 governance baseline

## Verification ledger
- Source edits: isolated branch only; not merged.
- Tests: TDD cases authored; no RED/GREEN or full CI outcome asserted until observed.
- Production: unchanged, unknown readiness; **NO-GO**.
