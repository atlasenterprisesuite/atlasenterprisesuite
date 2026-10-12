# ATLAS Memory / Knowledge Layer

Owner: Knowledge Atlas. Integrations: ATLAS Identity, Security, Assistant, Work, Supabase, every domain module.

## Product contract

ATLAS Memory is the durable organization-scoped knowledge layer for approved product decisions, requirements, workflows, configuration and evidence. It does not treat ChatGPT memory or any external chat history as a database.

Canonical flow:

`authorized source -> draft memory -> provenance -> explicit approval -> Knowledge Atlas -> authorized module retrieval -> audit`

## Truth and privacy rules

- Chat imports are never automatically approved.
- Personal conversations are not automatically ingested.
- Every record has organization scope, source type, optional source reference, lifecycle status and audit events.
- `approved` means an authorized ATLAS organization member approved the record for organizational use. It does not by itself prove an external factual claim.
- Replaced knowledge is retained as `superseded` for provenance.
- Direct browser writes are disabled; mutations go through the authenticated `atlas-memory` Edge Function.
- Paid-provider budget is $0. Search is deterministic until a separately authorized retrieval provider is verified.

## Route

- `/knowledge` — protected ATLAS Memory workspace.

## Persistence

- `public.atlas_memory_records`
- RLS read access requires active `organization_members` membership.
- Writes are server-side and audit through shared `audit_logs`.

## API

`atlas-memory?api=readiness|list|record|save|approve|import`

The import endpoint exists for explicit structured migration. It is not an automatic ChatGPT-history scraper.

## Enterprise Intelligence source provenance — 2026-10-12

This code-level phase extends the **existing** approved-memory lookup in `supabase/functions/atlas-copilot` instead of adding another data store or provider.

- Select approved records from the current organization only, with the existing service-role API plus server-side membership/role/permission context.
- Recheck each row's organization ID, approved status, sensitivity classification, ID validity and restricted/admin role before it enters model context or response source metadata.
- Supply `atlas-memory:<uuid>` source references and titles (not model-invented citations) to the immediate Assistant response; the UI labels them as organization-approved context, **not externally verified facts**.
- Reject non-approved, cross-tenant, malformed and unknown-sensitivity records; render no source when none qualifies.
- Do not pass tokens, passwords or provider secrets to client source metadata; queries use existing server-side configuration.

**Important remaining release boundaries (P0/P1):** This milestone does not yet provide source-level ACL/SCIM for external documents, a complete audit of access revocation while a model is generating, immutable citation storage for historical messages, or authenticated production E2E evidence. Those must be implemented or explicitly excluded from the final production acceptance scope. A source cited on a current response is not a guarantee of revocation-safe display of historical answers.

**Status:** feature branch implementation; do not label production-verified until exact-SHA CI, merge, deploy and authorization tests succeed.
