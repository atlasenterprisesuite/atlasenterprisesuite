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
- The current message determines the initial profile. Short follow-ups can
  inherit a higher effort level from the last 12 authorized conversation messages,
  considering up to the last 4 user turns; assistant/tool text cannot force
  escalation. This is bounded per-conversation continuity, **not** global
  analysis of all previous ChatGPT or ATLAS chats.
- Long/high-assurance engineering or security tasks use `deep`, conventional
  analysis `balanced`, and short simple requests `fast`.
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
- Broader cross-chat/history-wide adaptation is not implemented. It would
  require explicit source consent, per-document ACL/revocation, tenant-scoped
  retrieval and provenance/retention rules; no other user's history can be
  inferred from a chat ID or model-generated text.
- Adaptive requests are prepared server-side after authenticated conversation
  checks and are bound to tenant, actor, session and request ID. Provider
  readiness checks must use the resolved `fast | balanced | deep` profile
  rather than the unsupported `auto` string. The background path uses the
  same authorized preparation and cost policy.
- Negative tests must cover explicit manual overrides, unknown profiles,
  zero-cost denial, missing provider readiness, cross-tenant/session/request
  replay, revoked conversation lookup, budget exhaustion, audit failure and no
  secret leakage. These are not all covered by production E2E yet.
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
- Tests: 13/13 GitHub workflows passed at historical branch SHA
  `e4093a36ffe9609d5e815acd47f265527c8c9943` before the later
  authorized preflight regression repair. This **does not** certify a newer
  commit; the latest exact-SHA CI must be checked separately.
- Production: unchanged, unknown readiness; **NO-GO**.
