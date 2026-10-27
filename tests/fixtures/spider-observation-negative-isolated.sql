-- Disposable PostgreSQL only; run in dedicated empty test database, never production.
-- This test uses temporary tables and transaction-local fixtures, then ROLLBACK.
BEGIN;
CREATE TEMP TABLE spider_members (
 tenant_id text NOT NULL, actor_id uuid NOT NULL, active boolean NOT NULL,
 revoked boolean NOT NULL, role text NOT NULL, PRIMARY KEY(tenant_id, actor_id)
) ON COMMIT DROP;
CREATE TEMP TABLE spider_observations (
 tenant_id text NOT NULL, actor_id uuid NOT NULL, signal_id text NOT NULL,
 idempotency_key text NOT NULL, evidence_sha text NOT NULL CHECK (evidence_sha ~ '^[a-f0-9]{40}$'),
 audit_receipt_id uuid NOT NULL,
 UNIQUE(tenant_id,idempotency_key), UNIQUE(tenant_id,audit_receipt_id)
) ON COMMIT DROP;
INSERT INTO spider_members VALUES
 ('tenant-a','00000000-0000-0000-0000-000000000001',true,false,'spider:observe'),
 ('tenant-b','00000000-0000-0000-0000-000000000002',false,true,'spider:observe');
DO $$
DECLARE v_count integer;
BEGIN
 -- Active membership in tenant A only.
 INSERT INTO spider_observations VALUES
 ('tenant-a','00000000-0000-0000-0000-000000000001','signal-1','idem-1',repeat('a',40),'00000000-0000-0000-0000-000000000011');
 BEGIN
  INSERT INTO spider_observations VALUES
  ('tenant-a','00000000-0000-0000-0000-000000000001','signal-2','idem-1',repeat('a',40),'00000000-0000-0000-0000-000000000012');
  RAISE EXCEPTION 'false_success_duplicate';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 SELECT count(*) INTO v_count FROM spider_observations WHERE tenant_id='tenant-a' AND idempotency_key='idem-1';
 IF v_count <> 1 THEN RAISE EXCEPTION 'duplicate_was_persisted'; END IF;
 -- Simulate an audit failure in a nested transaction: observation must roll back.
 BEGIN
  INSERT INTO spider_observations VALUES
  ('tenant-a','00000000-0000-0000-0000-000000000001','signal-3','idem-rollback',repeat('a',40),'00000000-0000-0000-0000-000000000013');
  RAISE EXCEPTION 'audit_failure';
 EXCEPTION WHEN raise_exception THEN NULL;
 END;
 SELECT count(*) INTO v_count FROM spider_observations WHERE idempotency_key='idem-rollback';
 IF v_count <> 0 THEN RAISE EXCEPTION 'false_success_rollback'; END IF;
 -- A test-side predicate rejects revoked and cross-tenant membership.
 IF EXISTS (
   SELECT 1 FROM spider_members WHERE tenant_id='tenant-b'
    AND actor_id='00000000-0000-0000-0000-000000000002'
    AND active AND NOT revoked AND role='spider:observe'
 ) THEN RAISE EXCEPTION 'revoked_membership_accepted'; END IF;
 IF EXISTS (
   SELECT 1 FROM spider_members WHERE tenant_id='tenant-a'
    AND actor_id='00000000-0000-0000-0000-000000000002'
    AND active AND NOT revoked
 ) THEN RAISE EXCEPTION 'cross_tenant_membership_accepted'; END IF;
END $$;
ROLLBACK;
-- Concurrency must be exercised by two separate psql sessions against a
-- persistent disposable schema; this single-session fixture does NOT test races.
