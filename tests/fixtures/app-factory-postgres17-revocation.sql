-- ATLAS 777 REVIEW / PR #973
-- ISOLATED PostgreSQL 17 fixture ONLY. Not a Supabase migration.
-- Execute exclusively in a disposable PostgreSQL database, never atlas-core/main.
-- Two psql sessions are required to prove READ COMMITTED interleavings.
BEGIN;
CREATE SCHEMA app_factory_test;
CREATE TABLE app_factory_test.memberships (
  organization_id text NOT NULL,
  actor_id text NOT NULL,
  permission text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (organization_id, actor_id, permission)
);
CREATE TABLE app_factory_test.previews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id text NOT NULL,
  actor_id text NOT NULL,
  content text NOT NULL
);
INSERT INTO app_factory_test.memberships(organization_id, actor_id, permission)
VALUES ('tenant_a','alice','app_factory.preview'),
       ('tenant_b','bob','app_factory.preview');
CREATE OR REPLACE FUNCTION app_factory_test.create_preview(
  p_org text, p_actor text, p_content text
) RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_id bigint;
BEGIN
  -- Lock membership row to serialize revocation with preview creation.
  -- Under READ COMMITTED a concurrent UPDATE waits for this lock.
  PERFORM 1 FROM app_factory_test.memberships
   WHERE organization_id = p_org AND actor_id = p_actor
     AND permission = 'app_factory.preview' AND active
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'app_factory_forbidden'; END IF;
  INSERT INTO app_factory_test.previews(organization_id,actor_id,content)
  VALUES (p_org,p_actor,p_content) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
COMMIT;
-- A/B assertions (execute in disposable DB only):
-- SELECT app_factory_test.create_preview('tenant_b','alice','x');
-- EXPECT ERROR app_factory_forbidden.
-- Session 1: BEGIN ISOLATION LEVEL READ COMMITTED;
-- SELECT app_factory_test.create_preview('tenant_a','alice','before revoke');
-- HOLD transaction open.
-- Session 2: BEGIN; UPDATE app_factory_test.memberships SET active=false
-- WHERE organization_id='tenant_a' AND actor_id='alice'
-- AND permission='app_factory.preview'; COMMIT;
-- EXPECT session 2 to WAIT for session 1's row lock.
-- Session 1: COMMIT; session 2 then completes.
-- After session 2 commits, SELECT app_factory_test.create_preview(
-- 'tenant_a','alice','after revoke');
-- EXPECT ERROR app_factory_forbidden.
-- Invert ordering: session 2 updates+commits before session 1 begins;
-- EXPECT session 1 to be denied.
-- This isolated contract does NOT prove actual Supabase RLS or auth.uid().
