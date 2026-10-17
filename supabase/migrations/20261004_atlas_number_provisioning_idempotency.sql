alter table public.atlas_number_resources
  add column if not exists idempotency_key text,
  add column if not exists request_digest text,
  add column if not exists created_by uuid;

create unique index if not exists atlas_number_resources_org_idempotency_uidx
  on public.atlas_number_resources (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists atlas_number_resources_org_creator_idx
  on public.atlas_number_resources (organization_id, created_by, updated_at desc)
  where created_by is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'atlas_number_resources_idempotency_key_length_check'
  ) then
    alter table public.atlas_number_resources
      add constraint atlas_number_resources_idempotency_key_length_check
      check (idempotency_key is null or length(trim(idempotency_key)) between 8 and 160);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'atlas_number_resources_request_digest_check'
  ) then
    alter table public.atlas_number_resources
      add constraint atlas_number_resources_request_digest_check
      check (request_digest is null or request_digest ~ '^[a-f0-9]{64}$');
  end if;
end $$;

insert into public.identity_permissions (code, description)
values
  ('communication.telephony.provision', 'Provision and clean up explicitly gated ATLAS telephony test resources.')
on conflict (code) do update
set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner', 'communication.telephony.provision'),
  ('admin', 'communication.telephony.provision')
on conflict do nothing;

comment on column public.atlas_number_resources.idempotency_key is
  'Stable organization-scoped key for one logical provider provisioning test mutation.';
comment on column public.atlas_number_resources.request_digest is
  'SHA-256 digest of normalized provisioning criteria; changed-payload replays fail closed.';
comment on column public.atlas_number_resources.created_by is
  'Authenticated ATLAS user who initiated the gated test provisioning record.';
