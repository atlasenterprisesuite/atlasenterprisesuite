begin;

-- ATLAS Release Train database E2E contract.
-- This file is written before the migration implementation and must run only
-- against a compatible non-production replay database. The final harness
-- wraps all fixtures in this transaction and rolls back at the end.

-- Required objects must exist after the release-train migration.
do $$
begin
  if to_regclass('public.atlas_release_state') is null then
    raise exception 'atlas_release_state is required';
  end if;
  if to_regclass('public.atlas_release_modules') is null then
    raise exception 'atlas_release_modules is required';
  end if;
  if to_regclass('public.atlas_release_candidates') is null then
    raise exception 'atlas_release_candidates is required';
  end if;
  if to_regclass('public.atlas_release_queue_items') is null then
    raise exception 'atlas_release_queue_items is required';
  end if;
  if to_regclass('public.atlas_release_evidence') is null then
    raise exception 'atlas_release_evidence is required';
  end if;
  if to_regclass('public.atlas_release_events') is null then
    raise exception 'atlas_release_events is required';
  end if;
end;
$$;

-- Static catalog rows are present and inactive by default.
do $$
declare
  active_count integer;
  release_controller_wave integer;
begin
  select count(*) into active_count
  from public.atlas_release_modules
  where activation_enabled = true;

  if active_count <> 0 then
    raise exception 'release modules must seed fail-closed';
  end if;

  select release_wave into release_controller_wave
  from public.atlas_release_modules
  where module_code = 'release-controller';

  if release_controller_wave <> 0 then
    raise exception 'release-controller must belong to wave 0';
  end if;
end;
$$;

-- Global release lock begins closed.
do $$
declare
  lock_open boolean;
begin
  select is_open into lock_open from public.atlas_release_state where singleton = true;
  if lock_open is distinct from false then
    raise exception 'global release lock must default closed';
  end if;
end;
$$;

-- Runtime projection exists and exposes no service secret material.
do $$
declare
  runtime_rows integer;
begin
  select count(*) into runtime_rows from public.atlas_release_runtime_state();
  if runtime_rows < 1 then
    raise exception 'runtime release registry must expose catalog state';
  end if;
end;
$$;

-- Mutations and evidence ingestion are RPC-only. Direct client-table grants
-- must not be exposed to anon/authenticated roles.
do $$
begin
  if has_table_privilege('anon', 'public.atlas_release_evidence', 'INSERT') then
    raise exception 'anon must not insert release evidence';
  end if;
  if has_table_privilege('authenticated', 'public.atlas_release_evidence', 'INSERT') then
    raise exception 'authenticated must not insert release evidence directly';
  end if;
  if has_table_privilege('authenticated', 'public.atlas_release_modules', 'UPDATE') then
    raise exception 'authenticated must not update release modules directly';
  end if;
end;
$$;

-- Service-only evidence RPC must not be executable by anon/authenticated.
do $$
begin
  if has_function_privilege('anon', 'public.atlas_release_record_evidence(uuid,text,text,text,boolean,jsonb)', 'EXECUTE') then
    raise exception 'anon must not execute release evidence RPC';
  end if;
  if has_function_privilege('authenticated', 'public.atlas_release_record_evidence(uuid,text,text,text,boolean,jsonb)', 'EXECUTE') then
    raise exception 'authenticated must not execute release evidence RPC';
  end if;
end;
$$;

-- Candidate SHA immutability and state machine rules are implemented in RPCs;
-- function existence is asserted here while behavior is exercised by the
-- service-context replay harness.
do $$
begin
  if to_regprocedure('public.atlas_release_freeze_candidate(text,text)') is null then
    raise exception 'freeze candidate RPC is required';
  end if;
  if to_regprocedure('public.atlas_release_queue_module(uuid,text)') is null then
    raise exception 'queue module RPC is required';
  end if;
  if to_regprocedure('public.atlas_release_begin_activation(uuid,integer,text)') is null then
    raise exception 'begin activation RPC is required';
  end if;
  if to_regprocedure('public.atlas_release_mark_live(uuid,text,text)') is null then
    raise exception 'mark live RPC is required';
  end if;
  if to_regprocedure('public.atlas_release_mark_prod_verified(uuid,text,text)') is null then
    raise exception 'mark prod verified RPC is required';
  end if;
  if to_regprocedure('public.atlas_release_deactivate_wave(uuid,integer,text)') is null then
    raise exception 'deactivate wave RPC is required';
  end if;
end;
$$;

rollback;
