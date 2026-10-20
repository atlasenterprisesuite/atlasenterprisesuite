-- ATLAS Spatial Capture: private per-organization mobile photographic evidence.
-- All records start unverified. Client SHA-256 is a claim, never server attestation.
create table if not exists public.atlas_spatial_capture_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  entity_id uuid not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  status text not null default 'unverified' check (status = 'unverified'),
  consent_recorded boolean not null check (consent_recorded),
  site_authorized boolean not null check (site_authorized),
  created_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (entity_id, org_id) references public.atlas_urban_twin_entities(id, org_id)
);
create table if not exists public.atlas_spatial_capture_photos (
  id uuid primary key,
  org_id uuid not null references public.organizations(id),
  session_id uuid not null,
  object_path text not null unique,
  sha256_client text not null check (sha256_client ~ '^[0-9a-f]{64}$'),
  original_filename text not null check (char_length(original_filename) between 1 and 240),
  media_type text not null check (media_type in ('image/jpeg','image/png','image/heic','image/heif')),
  bytes bigint not null check (bytes between 1 and 26214400),
  integrity_state text not null default 'client_claim_unverified'
    check (integrity_state = 'client_claim_unverified'),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (session_id, org_id) references public.atlas_spatial_capture_sessions(id, org_id),
  check (object_path = org_id::text || '/' || session_id::text || '/' || id::text)
);
alter table public.atlas_spatial_capture_sessions enable row level security;
alter table public.atlas_spatial_capture_photos enable row level security;
revoke all on public.atlas_spatial_capture_sessions from anon;
revoke all on public.atlas_spatial_capture_photos from anon;
grant select, insert on public.atlas_spatial_capture_sessions to authenticated;
grant select, insert on public.atlas_spatial_capture_photos to authenticated;
create policy spatial_sessions_read on public.atlas_spatial_capture_sessions
  for select to authenticated using (public.has_identity_permission(org_id, 'city.twin.read'));
create policy spatial_sessions_insert on public.atlas_spatial_capture_sessions
  for insert to authenticated with check (
    created_by = auth.uid() and consent_recorded and site_authorized
    and public.has_identity_permission(org_id, 'city.twin.manage')
  );
create policy spatial_photos_read on public.atlas_spatial_capture_photos
  for select to authenticated using (public.has_identity_permission(org_id, 'city.twin.read'));
create policy spatial_photos_insert on public.atlas_spatial_capture_photos
  for insert to authenticated with check (
    created_by = auth.uid()
    and public.has_identity_permission(org_id, 'city.twin.manage')
  );
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('atlas-spatial-captures','atlas-spatial-captures',false,26214400,
  array['image/jpeg','image/png','image/heic','image/heif'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
create policy spatial_capture_storage_insert on storage.objects for insert to authenticated
with check (
 bucket_id='atlas-spatial-captures'
 and exists (
   select 1 from public.atlas_spatial_capture_sessions s
   where s.org_id::text=split_part(name,'/',1)
     and s.id::text=split_part(name,'/',2)
     and s.created_by=auth.uid()
     and public.has_identity_permission(s.org_id,'city.twin.manage')
     and split_part(name,'/',3) ~ '^[0-9a-f-]{36}$'
     and array_length(string_to_array(name,'/'),1)=3
 )
);
create policy spatial_capture_storage_read on storage.objects for select to authenticated
using (
 bucket_id='atlas-spatial-captures'
 and exists (
   select 1 from public.atlas_spatial_capture_photos p
   where p.object_path=name
     and public.has_identity_permission(p.org_id,'city.twin.read')
 )
);
