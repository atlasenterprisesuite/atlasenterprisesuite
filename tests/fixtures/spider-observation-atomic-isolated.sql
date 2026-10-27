-- ATLAS Spider 777: disposable PostgreSQL fixture ONLY. Never apply to production.
-- Requires a disposable DB. No SECURITY DEFINER or public RPC.
BEGIN;
CREATE SCHEMA spider_test;
CREATE TABLE spider_test.members (
  tenant_id text NOT NULL, actor_id uuid NOT NULL, active boolean NOT NULL,
  revoked boolean NOT NULL DEFAULT false, role text NOT NULL,
  PRIMARY KEY (tenant_id, actor_id)
);
CREATE TABLE spider_test.observations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id text NOT NULL, actor_id uuid NOT NULL,
  signal_id text NOT NULL, idempotency_key text NOT NULL,
  evidence_sha text NOT NULL CHECK (evidence_sha ~ '^[a-f0-9]{40}$'),
  audit_receipt_id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (tenant_id, audit_receipt_id)
);
ALTER TABLE spider_test.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE spider_test.observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA spider_test FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA spider_test FROM PUBLIC;
-- No access grants or policies: deny all until trusted actor context and membership
-- source are proven. Transactional insertion must check membership and audit
-- receipt in the same transaction. A UNIQUE constraint arbitrates racing inserts.
ROLLBACK;
