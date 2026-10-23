create table if not exists public.creator_recordings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null,
  language text not null check (language in ('es','en')),
  storage_bucket text not null check (storage_bucket = 'atlas-creator-recordings'),
  storage_path text not null check (length(trim(storage_path)) > 0),
  mime_type text not null check (mime_type in ('video/webm','video/mp4','video/quicktime')),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 536870912),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  source text not null default 'teleprompter' check (source = 'teleprompter'),
  created_at timestamptz not null default now()
);

create index if not exists creator_recordings_org_created_idx
  on public.creator_recordings (organization_id, created_at desc);

alter table public.creator_recordings enable row level security;

drop policy if exists creator_recordings_org_read on public.creator_recordings;
create policy creator_recordings_org_read
on public.creator_recordings
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.org_id = creator_recordings.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

revoke all on public.creator_recordings from authenticated;
grant select on public.creator_recordings to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'atlas-creator-recordings',
  'atlas-creator-recordings',
  false,
  536870912,
  array['video/webm','video/mp4','video/quicktime']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

comment on table public.creator_recordings is
  'Private organization-scoped ATLAS Studio teleprompter recordings. Browser access is mediated by atlas-creator and short-lived signed URLs.';
