-- ATLAS Academy F2.32 — isolated PostgreSQL 17 negative contract.
-- TEST ONLY. Run in a disposable database; never apply to atlas-core/production.
-- This transaction rolls back every object and fixture on completion.
BEGIN;
CREATE SCHEMA academy_f232;
CREATE TABLE academy_f232.enrollments (
  id text PRIMARY KEY, org_id text NOT NULL, user_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('active','revoked'))
);
CREATE TABLE academy_f232.credentials (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id text NOT NULL, enrollment_id text NOT NULL,
  idempotency_key text NOT NULL,
  UNIQUE (org_id,idempotency_key)
);
CREATE TABLE academy_f232.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id text NOT NULL, event_name text NOT NULL,
  CONSTRAINT reject_audit CHECK (event_name <> 'force-failure')
);
ALTER TABLE academy_f232.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_f232.enrollments FORCE ROW LEVEL SECURITY;
ALTER TABLE academy_f232.credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_f232.credentials FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_enrollment ON academy_f232.enrollments
  USING (org_id = current_setting('app.tenant_id',true))
  WITH CHECK (org_id = current_setting('app.tenant_id',true));
CREATE POLICY tenant_credential ON academy_f232.credentials
  USING (org_id = current_setting('app.tenant_id',true))
  WITH CHECK (org_id = current_setting('app.tenant_id',true));
-- Fixture setup: role-independent owner writes are performed with RLS disabled,
-- then re-enabled. Real auth role/RLS grants MUST be tested separately.
ALTER TABLE academy_f232.enrollments DISABLE ROW LEVEL SECURITY;
INSERT INTO academy_f232.enrollments VALUES
 ('enroll-a','org-a','user-a','active'),
 ('enroll-b','org-b','user-b','active'),
 ('enroll-revoked','org-a','user-a','revoked');
ALTER TABLE academy_f232.enrollments ENABLE ROW LEVEL SECURITY;
-- The postgres service administrator bypasses RLS; verify using a restricted role.
CREATE ROLE academy_f232_reader NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA academy_f232 TO academy_f232_reader;
GRANT SELECT ON academy_f232.enrollments TO academy_f232_reader;
SET ROLE academy_f232_reader;
SELECT set_config('app.tenant_id','org-a',true);
DO $$
BEGIN
 IF (SELECT count(*) FROM academy_f232.enrollments) <> 2 THEN
   RAISE EXCEPTION 'P0: cross-tenant enrollment visible';
 END IF;
 IF EXISTS (SELECT 1 FROM academy_f232.enrollments WHERE id='enroll-b') THEN
   RAISE EXCEPTION 'P0: cross-tenant enrollment leaked';
 END IF;
 IF EXISTS (SELECT 1 FROM academy_f232.enrollments WHERE id='enroll-revoked' AND status='active') THEN
   RAISE EXCEPTION 'P0: revoked enrollment accepted';
 END IF;
END $;
RESET ROLE;
-- Simulate an atomic issuance/audit unit. A failed audit must undo issuance.
DO $$
BEGIN
 BEGIN
  INSERT INTO academy_f232.credentials(org_id,enrollment_id,idempotency_key)
    VALUES ('org-a','enroll-a','audit-rollback');
  INSERT INTO academy_f232.audit_events(org_id,event_name)
    VALUES ('org-a','force-failure');
  RAISE EXCEPTION 'P0: audit failure unexpectedly accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 IF EXISTS (SELECT 1 FROM academy_f232.credentials WHERE idempotency_key='audit-rollback') THEN
   RAISE EXCEPTION 'P0: credential survived failed audit';
 END IF;
END $$;
-- Sequential uniqueness contract only; NOT a concurrent two-session proof.
INSERT INTO academy_f232.credentials(org_id,enrollment_id,idempotency_key)
 VALUES ('org-a','enroll-a','same-request');
INSERT INTO academy_f232.credentials(org_id,enrollment_id,idempotency_key)
 VALUES ('org-a','enroll-a','same-request') ON CONFLICT (org_id,idempotency_key) DO NOTHING;
DO $$
BEGIN
 IF (SELECT count(*) FROM academy_f232.credentials WHERE idempotency_key='same-request') <> 1 THEN
   RAISE EXCEPTION 'P0: idempotency uniqueness failed';
 END IF;
END $$;
ROLLBACK;
