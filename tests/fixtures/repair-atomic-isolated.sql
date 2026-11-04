-- ATLAS 777 REVIEW: ISOLATED POSTGRES TEST FIXTURE ONLY.
-- Not a production migration. Do not apply to atlas-core.
-- Requires a disposable PostgreSQL instance with pgcrypto and a dedicated test DB.
-- This draft deliberately does NOT expose an executable completion RPC.
BEGIN;
CREATE SCHEMA IF NOT EXISTS atlas_repair_test;
CREATE TABLE atlas_repair_test.jobs (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, actor_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('claimed','applying','completed','failed')),
 lease_epoch bigint NOT NULL CHECK(lease_epoch > 0),
 lease_until timestamptz NOT NULL, claimed_by text NOT NULL,
 target_sha text NOT NULL, observed_sha text,
 CHECK (target_sha ~ '^[0-9a-f]{40}$')
);
CREATE TABLE atlas_repair_test.members (
 org_id uuid NOT NULL, user_id uuid NOT NULL, role text NOT NULL,
 status text NOT NULL, PRIMARY KEY(org_id,user_id)
);
CREATE TABLE atlas_repair_test.audit_receipts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 org_id uuid NOT NULL, job_id uuid NOT NULL,
 idempotency_key text NOT NULL, evidence_digest text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(org_id,job_id,idempotency_key)
);
-- One transaction must lock jobs FOR UPDATE, check active membership,
-- compare lease_epoch and lease_until, check SHA/evidence, insert receipt
-- RETURNING id, and update status; any error must abort the transaction.
-- Do not implement SECURITY DEFINER until grants and auth context are proven.
ROLLBACK;
