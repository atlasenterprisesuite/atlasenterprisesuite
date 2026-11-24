create table public.atlas_feature_flags (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  flag_key text not null,
  name text not null,
  description text,
  environment text not null default 'production' check (environment in ('development','staging','production')),
  enabled boolean not null default false,
  rollout_percentage integer not null default 0 check (rollout_percentage between 0 and 100),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_feature_flags_key_format check (flag_key ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  unique (org_id, environment, flag_key)
);

create index atlas_feature_flags_org_env_idx
  on public.atlas_feature_flags(org_id, environment, flag_key);

alter table public.atlas_feature_flags enable row level security;

create policy atlas_feature_flags_read on public.atlas_feature_flags
  for select to authenticated
  using (public.is_org_member(org_id));

create policy atlas_feature_flags_insert on public.atlas_feature_flags
  for insert to authenticated
  with check (public.has_org_role(org_id, array['owner','admin']));

create policy atlas_feature_flags_update on public.atlas_feature_flags
  for update to authenticated
  using (public.has_org_role(org_id, array['owner','admin']))
  with check (public.has_org_role(org_id, array['owner','admin']));

create policy atlas_feature_flags_delete on public.atlas_feature_flags
  for delete to authenticated
  using (public.has_org_role(org_id, array['owner','admin']));

create trigger atlas_updated_atlas_feature_flags
  before update on public.atlas_feature_flags
  for each row execute function public.set_updated_at();

create trigger atlas_audit_atlas_feature_flags
  after insert or update or delete on public.atlas_feature_flags
  for each row execute function public.audit_row_change();

create or replace function public.atlas_feature_enabled(
  organization_uuid uuid,
  feature_key text,
  environment_name text default 'production',
  subject_uuid uuid default null
)
returns boolean
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  feature_row public.atlas_feature_flags%rowtype;
  bucket integer;
  effective_subject uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_org_member(organization_uuid) then
    raise exception 'Organization membership required';
  end if;
  if environment_name not in ('development','staging','production') then
    raise exception 'Unsupported environment';
  end if;

  select * into feature_row
  from public.atlas_feature_flags
  where org_id = organization_uuid
    and flag_key = feature_key
    and environment = environment_name;

  if feature_row.id is null or feature_row.enabled is false or feature_row.rollout_percentage <= 0 then
    return false;
  end if;
  if feature_row.rollout_percentage >= 100 then
    return true;
  end if;

  effective_subject := coalesce(subject_uuid, auth.uid());
  bucket := ((hashtextextended(organization_uuid::text || ':' || feature_key || ':' || effective_subject::text, 0) % 100) + 100) % 100;
  return bucket < feature_row.rollout_percentage;
end;
$$;

revoke all on function public.atlas_feature_enabled(uuid,text,text,uuid) from public, anon;
grant execute on function public.atlas_feature_enabled(uuid,text,text,uuid) to authenticated, service_role;
comment on table public.atlas_feature_flags is 'ATLAS sovereign feature flags. Tenant-scoped, environment-scoped, audited, and provider-independent.';
comment on function public.atlas_feature_enabled(uuid,text,text,uuid) is 'Deterministic tenant-scoped feature-flag evaluation using RLS and percentage rollout.';
