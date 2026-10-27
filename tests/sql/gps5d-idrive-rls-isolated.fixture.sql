-- ATLAS GPS 5D isolated RLS contract, synthetic data only.
-- PostgreSQL 15+. Execute with psql -X -v ON_ERROR_STOP=1 against a
-- freshly initialized disposable local cluster, offline, without secrets.
-- This is NOT a production migration. Requires an ephemeral superuser.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE gps5d_fixture_alice NOLOGIN;
CREATE ROLE gps5d_fixture_bob NOLOGIN;
CREATE ROLE gps5d_fixture_anon NOLOGIN;
CREATE SCHEMA gps5d_fixture;
GRANT USAGE ON SCHEMA gps5d_fixture TO gps5d_fixture_alice, gps5d_fixture_bob;
CREATE TABLE gps5d_fixture.members (
  tenant text NOT NULL, actor name NOT NULL, status text NOT NULL,
  PRIMARY KEY (tenant, actor)
);
CREATE TABLE gps5d_fixture.developments (
  id integer PRIMARY KEY, tenant text NOT NULL,
  verification text NOT NULL CHECK (verification IN ('verified','unverified')),
  license text NOT NULL CHECK (license IN ('permission-granted','unknown')),
  source_url text NOT NULL CHECK (source_url LIKE 'https://%'),
  start_year integer NOT NULL CHECK (start_year BETWEEN 1800 AND 2300),
  end_year integer NOT NULL CHECK (end_year BETWEEN start_year AND 2300),
  title text NOT NULL
);
INSERT INTO gps5d_fixture.members VALUES
 ('a','gps5d_fixture_alice','active'), ('b','gps5d_fixture_bob','active');
INSERT INTO gps5d_fixture.developments VALUES
 (1,'a','verified','permission-granted','https://example.org/a',2026,2028,'A'),
 (2,'b','verified','permission-granted','https://example.org/b',2026,2028,'B'),
 (3,'a','unverified','unknown','https://example.org/c',2026,2028,'Unpublished'),
 (4,'a','verified','unknown','https://example.org/d',2026,2028,'Unlicensed');
GRANT SELECT ON gps5d_fixture.members TO gps5d_fixture_alice, gps5d_fixture_bob;
GRANT SELECT, INSERT, UPDATE, DELETE ON gps5d_fixture.developments
  TO gps5d_fixture_alice, gps5d_fixture_bob;
ALTER TABLE gps5d_fixture.developments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps5d_fixture.developments FORCE ROW LEVEL SECURITY;
CREATE POLICY gps5d_read ON gps5d_fixture.developments
  FOR SELECT TO gps5d_fixture_alice, gps5d_fixture_bob USING (
    verification = 'verified' AND license = 'permission-granted'
    AND EXISTS (
      SELECT 1 FROM gps5d_fixture.members m
      WHERE m.tenant = developments.tenant
        AND m.actor = current_user::name AND m.status = 'active'
    )
  );
-- No INSERT/UPDATE/DELETE policies. Despite GRANT, RLS must deny writes.
-- current_user is the PostgreSQL role, NOT a caller-settable custom GUC.
SET LOCAL ROLE gps5d_fixture_alice;
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM gps5d_fixture.developments;
  IF n <> 1 THEN RAISE EXCEPTION 'Alice visibility expected 1, got %', n; END IF;
  IF EXISTS (SELECT 1 FROM gps5d_fixture.developments WHERE id <> 1)
    THEN RAISE EXCEPTION 'Cross-tenant/unverified/unlicensed data visible'; END IF;
  UPDATE gps5d_fixture.developments SET title='forged' WHERE id=1;
  IF FOUND THEN RAISE EXCEPTION 'RLS UPDATE unexpectedly affected a row'; END IF;
  DELETE FROM gps5d_fixture.developments WHERE id=1;
  IF FOUND THEN RAISE EXCEPTION 'RLS DELETE unexpectedly affected a row'; END IF;
  BEGIN
    INSERT INTO gps5d_fixture.developments VALUES
      (5,'a','verified','permission-granted','https://example.org/e',2026,2028,'Forged');
    RAISE EXCEPTION 'RLS INSERT unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET LOCAL ROLE gps5d_fixture_bob;
DO $$
BEGIN
  IF (SELECT count(*) FROM gps5d_fixture.developments) <> 1
     OR NOT EXISTS (SELECT 1 FROM gps5d_fixture.developments WHERE id=2)
    THEN RAISE EXCEPTION 'Bob tenant isolation failed'; END IF;
END $$;
RESET ROLE;
-- Revoke membership as fixture owner, then verify deny as Alice.
UPDATE gps5d_fixture.members SET status='revoked'
 WHERE tenant='a' AND actor='gps5d_fixture_alice';
SET LOCAL ROLE gps5d_fixture_alice;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM gps5d_fixture.developments)
    THEN RAISE EXCEPTION 'Revoked member still sees rows'; END IF;
END $$;
RESET ROLE;
-- No schema grant for anon, even if a policy were accidentally added.
DO $$
BEGIN
  IF has_schema_privilege('gps5d_fixture_anon','gps5d_fixture','USAGE')
    THEN RAISE EXCEPTION 'Anonymous schema access granted'; END IF;
  IF has_table_privilege('gps5d_fixture_anon','gps5d_fixture.developments','SELECT')
    THEN RAISE EXCEPTION 'Anonymous table access granted'; END IF;
  IF (SELECT count(*) FROM gps5d_fixture.developments) <> 4
    THEN RAISE EXCEPTION 'Denied writes changed fixture rows'; END IF;
  BEGIN
    INSERT INTO gps5d_fixture.developments VALUES
      (1,'a','verified','permission-granted','https://example.org/a',2026,2028,'Duplicate');
    RAISE EXCEPTION 'Duplicate primary key unexpectedly accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;
ROLLBACK;
-- Fail if transactional DDL/roles survived rollback.
DO $$
BEGIN
  IF to_regnamespace('gps5d_fixture') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN
       ('gps5d_fixture_alice','gps5d_fixture_bob','gps5d_fixture_anon'))
    THEN RAISE EXCEPTION 'Rollback left fixture schema or roles behind'; END IF;
END $$;
