-- Advisory external-provider readiness foundation.
-- Keeps provider authorization fail-closed, reuses the canonical integration registry,
-- and records firm-scoped audit evidence whenever an Advisory-bound connection changes.

alter table public.atlas_oauth_states
  drop constraint if exists atlas_oauth_states_provider_check;
alter table public.atlas_oauth_states
  add constraint atlas_oauth_states_provider_check
  check (provider ~ '^[a-z][a-z0-9_-]{1,63}$');

alter table public.atlas_integration_credentials
  drop constraint if exists atlas_integration_credentials_provider_check;
alter table public.atlas_integration_credentials
  add constraint atlas_integration_credentials_provider_check
  check (provider ~ '^[a-z][a-z0-9_-]{1,63}$');

alter table public.atlas_external_object_links
  drop constraint if exists atlas_external_object_links_provider_check;
alter table public.atlas_external_object_links
  add constraint atlas_external_object_links_provider_check
  check (provider ~ '^[a-z][a-z0-9_-]{1,63}$');

alter table public.atlas_integration_sync_runs
  drop constraint if exists atlas_integration_sync_runs_provider_check;
alter table public.atlas_integration_sync_runs
  add constraint atlas_integration_sync_runs_provider_check
  check (provider ~ '^[a-z][a-z0-9_-]{1,63}$');

alter table public.atlas_integration_connections
  drop constraint if exists atlas_integration_connections_provider_slug_check;
alter table public.atlas_integration_connections
  add constraint atlas_integration_connections_provider_slug_check
  check (provider ~ '^[a-z][a-z0-9_-]{1,63}$');

create or replace function public.atlas_audit_advisory_provider_connection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_org uuid;
  v_connection uuid;
  v_metadata jsonb;
  v_firm uuid;
  v_capability text;
  v_action text;
begin
  if tg_op = 'DELETE' then
    v_org := old.org_id;
    v_connection := old.id;
    v_metadata := coalesce(old.metadata, '{}'::jsonb);
    v_action := 'delete';
  elsif tg_op = 'INSERT' then
    v_org := new.org_id;
    v_connection := new.id;
    v_metadata := coalesce(new.metadata, '{}'::jsonb);
    v_action := 'insert';
  else
    v_org := new.org_id;
    v_connection := new.id;
    v_metadata := case
      when coalesce(new.metadata, '{}'::jsonb) ? 'advisory_capability' then coalesce(new.metadata, '{}'::jsonb)
      else coalesce(old.metadata, '{}'::jsonb)
    end;
    v_action := 'update';
  end if;

  if not (v_metadata ? 'advisory_capability') then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  v_capability := nullif(trim(v_metadata ->> 'advisory_capability'), '');
  if v_capability is null or v_capability not in (
    'esign',
    'print_fulfillment',
    'paid_media',
    'payment',
    'publishing'
  ) then
    raise exception 'advisory_provider_capability_invalid';
  end if;

  select f.id
    into v_firm
  from public.advisory_firms f
  where f.org_id = v_org
    and f.id::text = coalesce(v_metadata ->> 'advisory_firm_id', '')
  limit 1;

  if v_firm is null then
    raise exception 'advisory_provider_firm_required';
  end if;

  insert into public.advisory_audit_events(
    org_id,
    firm_id,
    entity_type,
    entity_id,
    action,
    actor_user_id
  )
  values (
    v_org,
    v_firm,
    'integration_connection',
    v_connection,
    v_action,
    auth.uid()
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

revoke all on function public.atlas_audit_advisory_provider_connection() from public, anon, authenticated;

drop trigger if exists atlas_advisory_provider_connection_audit
  on public.atlas_integration_connections;

create trigger atlas_advisory_provider_connection_audit
after insert or update or delete
on public.atlas_integration_connections
for each row
execute function public.atlas_audit_advisory_provider_connection();

comment on function public.atlas_audit_advisory_provider_connection() is
  'Validates firm-scoped Advisory provider capability metadata and writes audit evidence when canonical provider connection truth changes.';
