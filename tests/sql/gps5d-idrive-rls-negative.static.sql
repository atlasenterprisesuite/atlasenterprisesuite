-- ATLAS GPS 5D I-Drive negative RLS assertions: DOCUMENTATION ONLY.
-- Not a migration. Run only in a disposable, fully isolated PostgreSQL fixture
-- after seeding test organizations, auth users, and organization_members.
-- Never run against production or with a privileged application service key.
-- Assertions intentionally fail closed until the future GPS 5D table and
-- authorization contract have been installed in that disposable fixture.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.atlas_gps5d_developments') IS NULL THEN
    RAISE EXCEPTION 'P0: GPS 5D RLS fixture not installed; no test executed';
  END IF;
END $$;
-- Required negative cases for a subsequent executable fixture:
-- 1. anonymous SELECT/INSERT/UPDATE/DELETE denied.
-- 2. tenant A user cannot SELECT or mutate tenant B records.
-- 3. inactive/revoked membership denies all operations.
-- 4. authenticated user cannot forge organization membership or source approval.
-- 5. unverified or unlicensed development cannot enter published layer.
-- 6. rollback leaves no persisted changes; retries remain idempotent.
ROLLBACK;
