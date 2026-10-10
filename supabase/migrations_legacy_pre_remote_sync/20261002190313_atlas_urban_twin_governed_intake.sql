-- ATLAS Urban Twin governed intake and verification boundary.

insert into public.identity_permissions (code, description)
values
  ('city.twin.verify', 'Verify or revoke Urban Twin entities and external bindings only when evidence is present.')
on conflict (code) do update
set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner', 'city.twin.verify'),
  ('admin', 'city.twin.verify')
on conflict do nothing;

alter table public.atlas_urban_twin_entities
  add column if not exists verification_evidence_refs jsonb not null default '[]'::jsonb,
  add column if not exists verified_by uuid references auth.users(id),
  add column if not exists verified_at timestamptz;

alter table public.atlas_urban_twin_bindings
  add column if not exists verified_by uuid references auth.users(id),
  add column if not exists verified_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'atlas_urban_twin_entities_verification_evidence_array'
      and conrelid = 'public.atlas_urban_twin_entities'::regclass
  ) then
    alter table public.atlas_urban_twin_entities
      add constraint atlas_urban_twin_entities_verification_evidence_array
      check (jsonb_typeof(verification_evidence_refs) = 'array');
  end if;
end $$;

create index if not exists atlas_urban_twin_entities_verified_by_idx
  on public.atlas_urban_twin_entities(verified_by)
  where verified_by is not null;

create index if not exists atlas_urban_twin_bindings_verified_by_idx
  on public.atlas_urban_twin_bindings(verified_by)
  where verified_by is not null;

comment on column public.atlas_urban_twin_entities.verification_evidence_refs is
  'Evidence references required before an entity may be promoted to verified.';
comment on column public.atlas_urban_twin_entities.verified_by is
  'Authenticated actor who last verified the entity through the governed Urban Twin control plane.';
comment on column public.atlas_urban_twin_bindings.verified_by is
  'Authenticated actor who last verified the external binding through the governed Urban Twin control plane.';