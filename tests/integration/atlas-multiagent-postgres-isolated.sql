-- ATLAS 777 PostgreSQL isolated negative suite.
-- Run ONLY against disposable PostgreSQL with the historical orchestrator
-- migrations and 20261026185000_atlas_multiagent_atomic_claim.sql applied.
-- Requires a test-only runtime authorization fixture; never production Vault.
-- This script rolls back all fixtures and does not invoke Manus.
BEGIN;
INSERT INTO public.atlas_orchestrator_tasks
 (tenant_id,organization_id,task_id,schema_version,state,task_json,created_at,updated_at)
VALUES
 ('test-tenant-a','test-org-a','test-task-a',1,'queued','{}',now(),now()),
 ('test-tenant-b','test-org-b','test-task-b',1,'queued','{}',now(),now());
DO $$
BEGIN
  BEGIN
    INSERT INTO public.atlas_multiagent_dispatch_claims
      (tenant_id,organization_id,idempotency_key,task_id,provider_id)
    VALUES ('test-tenant-a','test-org-a','wrong-task','test-task-b','manus');
    RAISE EXCEPTION 'P0: cross-tenant foreign key unexpectedly accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.atlas_multiagent_dispatch_claims
      (tenant_id,organization_id,idempotency_key,task_id,provider_id)
    VALUES ('test-tenant-a','test-org-a','missing-task','absent','manus');
    RAISE EXCEPTION 'P0: missing task unexpectedly accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;
INSERT INTO public.atlas_multiagent_dispatch_claims
 (tenant_id,organization_id,idempotency_key,task_id,provider_id)
VALUES ('test-tenant-a','test-org-a','same-key','test-task-a','manus')
ON CONFLICT (tenant_id,organization_id,idempotency_key) DO NOTHING;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.atlas_multiagent_dispatch_claims
      WHERE tenant_id='test-tenant-a' AND organization_id='test-org-a'
        AND idempotency_key='same-key') <> 1 THEN
    RAISE EXCEPTION 'P0: idempotency uniqueness failed';
  END IF;
END $$;
ROLLBACK;
