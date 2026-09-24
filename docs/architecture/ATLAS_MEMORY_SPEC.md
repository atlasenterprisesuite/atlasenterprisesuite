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
