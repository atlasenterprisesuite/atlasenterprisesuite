-- GPS 5D standalone RLS fixture. PostgreSQL 15+.
-- RUN ONLY in a fresh, local disposable PostgreSQL cluster with no network
-- access, no production secrets and an ephemeral superuser.
-- All DDL, roles and fixture data are rolled back. Never a production migration.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE gps5d_fixture_actor NOLOGIN;
CREATE SCHEMA gps5d_fixture;
GRANT USAGE ON SCHEMA gps5d_fixture TO gps5d_fixture_actor;

CREATE TABLE gps5d_fixture.members (
  tenant text NOT NULL, actor text NOT NULL, status text NOT NULL,
  PRIMARY KEY (tenant, actor)
);
CREATE TABLE gps5d_fixture.developments (
  id integer PRIMARY KEY, tenant text NOT NULL,
  verification text NOT NULL CHECK (verification IN ('verified', 'unverified')),
  license text NOT NULL CHECK (license IN ('permission-granted','unknown')),
  source_url text NOT NULL CHECK (source_url LIKE 'https://%'),
  start_year integer NOT NULL CHECK (start_year BETWEEN 1800 AND 2300),
  end_year integer NOT NULL CHECK (end_year BETWEEN start_year AND 2300),
  title text NOT NULL
);
INSERT INTO gps5d_fixture.members VALUES
 ('a','alice','active'), ('b','bob','active');
INSERT INTO gps5d_fixture.developments VALUES
 (1,'a','verified','permission-granted','https://example.org/a',2026,2028,'A'),
 (2,'b','verified','permission-granted','https://example.org/b',2026,2028,'B'),
 (3,'a','unverified','unknown','https://example.org/c',2026,2028,'Unpublished');

GRANT SELECT ON gps5d_fixture.members TO gps5d_fixture_actor;
GRANT SELECT, INSERT, UPDATE, DELETE ON gps5d_fixture.developments TO gps5d_fixture_actor;
ALTER TABLE gps5d_fixture.developments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps5d_fixture.developments FORCE ROW LEVEL SECURITY;
CREATE POLICY gps5d_read ON gps5d_fixture.developments
  FOR SELECT TO gps5d_fixture_actor USING (
    verification = 'verified' AND license = 'permission-granted'
    AND EXISTS (
      SELECT 1 FROM gps5d_fixture.members m
      WHERE m.tenant = developments.tenant
      AND m.actor = current_setting('gps5d.actor', true)
      AND m.status = 'active'
    )
  );
-- No write policies: default deny. Published-source mutations must use
-- a separately reviewed privileged workflow, not client role permissions.
SET LOCAL ROLE gps5d_fixture_actor;
SELECT set_config('gps5d.actor','alice',true);
DO $$
BEGIN
  IF (SELECT count(*) FROM gps5d_fixture.developments) <> 1 THEN
    RAISE EXCEPTION 'RLS failed: Alice should see only one published A row';
  END IF;
  IF EXISTS (SELECT 1 FROM gps5d_fixture.developments WHERE tenant = 'b') THEN
    RAISE EXCEPTION 'RLS failed: cross-tenant read';
  END IF;
  IF EXISTS (SELECT 1 FROM gps5d_fixture.developments WHERE verification <> 'verified') THEN
    RAISE EXCEPTION 'RLS failed: unverified data visible';
  END IF;
  UPDATE gps5d_fixture.developments SET title='forged' WHERE id=1;
  IF FOUND THEN RAISE EXCEPTION 'RLS failed: update allowed'; END IF;
  DELETE FROM gps5d_fixture.developments WHERE id=1;
  IF FOUND THEN RAISE EXCEPTION 'RLS failed: delete allowed'; END IF;
  BEGIN
    INSERT INTO gps5d_fixture.developments VALUES
      (4,'a','verified','permission-granted','https://example.org/d',2026,2028,'Injected');
    RAISE EXCEPTION 'RLS failed: insert allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
-- Revoke membership and check denial under actor role.
UPDATE gps5d_fixture.members SET status='revoked' WHERE tenant='a' AND actor='alice';
SET LOCAL ROLE gps5d_fixture_actor;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM gps5d_fixture.developments) THEN
    RAISE EXCEPTION 'RLS failed: revoked member still reads data';
  END IF;
END $$;
RESET ROLE;
-- Ensure duplicate fixture keys are rejected (idempotency gate).
DO $$
BEGIN
  BEGIN
    INSERT INTO gps5d_fixture.developments VALUES
      (1,'a','verified','permission-granted','https://example.org/a',2026,2028,'Duplicate');
    RAISE EXCEPTION 'Idempotency gate failed';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;
ROLLBACK;
-- Runner must also check that schema/role are absent after rollback.
