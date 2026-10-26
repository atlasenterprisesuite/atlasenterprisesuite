# Marketing Intelligence 777 — PostgreSQL security gate (DRAFT, NOT A MIGRATION)

Base SHA: 354ece685affeb1183f72d2a1283a940b17e4fa6
Status: P0 OPEN. Do not apply to production.

## Confirmed repository patterns
- `20260925031000_atlas_chat_core.sql`: organization_members(org_id,user_id,status='active') and RLS policies.
- `20260925093000_atlas_chat_postgrest_runtime.sql`: writes public.audit_logs(org_id,user_id,action,table_name,record_id,new_data).
- `20260923203000_atlas_payroll_core.sql`: public.has_identity_permission(org_id, permission).
- Definition, grants, triggers and constraints for public.audit_logs remain **unverified**. Search matches do not prove absence.

## Proposed tenant-scoped schema (requires review before executable migration)
1. marketing_campaign_drafts: id UUID PK, org_id UUID NOT NULL, content_sha256 TEXT NOT NULL, revision INTEGER NOT NULL CHECK > 0, created_by UUID, UNIQUE(org_id,id,revision).
2. marketing_consent_receipts: id UUID PK, org_id UUID, subject_id UUID, purpose TEXT, version INTEGER CHECK > 0, granted BOOLEAN, created_at timestamptz; append-only and tenant-scoped.
3. marketing_approval_receipts: id UUID PK, org_id UUID, campaign_id UUID, revision INTEGER, content_sha256 TEXT, approved_by UUID, approved_at timestamptz, expires_at timestamptz; composite tenant FK to campaign revision.
4. marketing_execution_receipts: id UUID PK, org_id UUID, campaign_id UUID, idempotency_key TEXT NOT NULL, status TEXT CHECK (status IN ('reserved','blocked','completed','failed')), UNIQUE(org_id,idempotency_key), UNIQUE(org_id,id), approval_id UUID; append-only transition history separate from mutable reservation state.
5. Composite foreign keys including org_id on all relationships; revoke direct INSERT/UPDATE/DELETE on approval, consent, execution receipts from anon/authenticated; RLS enabled and forced for every table. No permissive cross-tenant policies.
6. One SECURITY DEFINER RPC with fixed search_path, authenticated actor from auth.uid(), active organization membership plus dedicated marketing.execute permission. Lock relevant consent/campaign rows, verify current consent and approval exact content hash, reserve idempotency key via INSERT ... ON CONFLICT DO NOTHING, write audit evidence in same transaction, and return a receipt. Fail and roll back if audit write fails. No external API call inside transaction.
7. Separate durable outbox worker, disabled by default, must re-check consent, revocation, approval, tenant and audit before delivery. Delivery exactly-once cannot be guaranteed by DB uniqueness alone; provider idempotency/reconciliation required.

## Negative tests to implement in isolated PostgreSQL
- Cross-tenant read/write and forged org_id rejected.
- Missing/inactive membership, revoked consent, stale version/hash, absent approval rejected.
- Two concurrent transactions with same (org_id,idempotency_key): one reservation only.
- Audit insertion failure rolls back reservation and associated state.
- Revocation races with reservation and worker dispatch: dispatch fails closed.
- Direct authenticated inserts/updates/deletes to receipt tables denied.
- Missing audit_logs definition/permissions fails migration preflight, not silently skipped.
- Adapter remains disabled; no network calls.

## Gate
No claim of implemented persistence, passing tests, or complete audit_logs inventory until migration discovery and isolated PostgreSQL tests are evidenced by exact SHA.
