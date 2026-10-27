# Memory Archive 777 — PostgreSQL security gate (draft, no production application)

Base: cb1611380f732740e30f8060ff2eadfab74763ff

## Canonical reuse confirmed
- public.atlas_memory_records exists (20260922033000_atlas_memory_core.sql), including org scope, source_hash, source_ref, status draft/approved/superseded, and uniqueness on (organization_id, source_type, source_hash).
- public.atlas_library_assets exists (20260924005000_atlas_library_ingestion.sql), including provenance metadata, content_hash, duplicate_of, memory_record_id and org-scoped unique source identity.
- public.organization_members active membership controls RLS reads; restricted records are limited to owner/admin/platform_admin.
- atlas-memory Edge Function owns mutations. Imported conversations must remain drafts until explicit approval.
- execution_workflows / execution_tasks and execution_evidence are canonical for Work OS. Do not create a second task table.

## Blocking mismatches
1. New TypeScript contract has tenantId text plus organizationId string; existing memory table has organization_id UUID but no tenant_id. Define authoritative mapping and enforce it server-side before any ingest.
2. Existing memory unique index keys on source_hash rather than source_id + source_hash; two distinct sources with identical content could conflict. A receipt ledger must retain both source references without duplicating content.
3. Existing library ingestion source_system check does not include chatgpt_conversation_export. Adding that value requires explicit source semantics, sensitivity defaults, and migration testing.
4. The existing public.atlas_memory_records schema lacks a durable revocation tombstone/receipt model. Approval, consent withdrawal, and restore semantics require design review.
5. Need to inspect latest later migrations, Edge Function auth, audit_logs constraints and permissions before writing SQL. Never infer schema from a single migration.

## Proposed schema delta (not applied)
Create a narrowly scoped ingestion receipt table only after checking schema compatibility: organization_id UUID, source_system, source_id, source_sha256, canonical_sha256, source_version, status (staged/revoked), consent evidence, immutable creation metadata and unique (organization_id,source_system,source_id,source_sha256). References to approved knowledge must be nullable and org-safe. No original chat text in receipt table. Sensitive raw objects live in governed private storage with content-addressed SHA-256 keys.

## Required negative tests
- Anon and revoked members: no SELECT, INSERT, UPDATE or DELETE.
- Tenant A cannot access tenant B even when source_id/hash match.
- Concurrent duplicate imports produce exactly one receipt and consistent audit; different source IDs sharing content preserve separate provenance.
- Exception mid-transaction rolls back receipt, knowledge draft, audit together.
- Tampered bytes fail SHA-256; restoration verifies digest before reactivation.
- Revocation blocks retrieval immediately and invalidates derived search indexes.
- Browser cannot invoke privileged definer functions or service_role paths.
- Work OS task linking verifies same organization and authorized workflow.
- Explicit approval required for any imported chat becoming approved knowledge.

## Gate
No SQL migration, database test, or production access was executed at this stage. Requires isolated PostgreSQL and verified grants, RLS, triggers, and schema history. P0 remains open.
