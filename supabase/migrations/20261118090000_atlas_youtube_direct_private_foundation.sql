-- ATLAS YouTube Direct 777 — private execution foundation.
-- Reuses canonical ATLAS integration registry + encrypted credential vault.
-- NO OAuth plaintext tokens or media bytes live in these tables.
-- Deliberate fail-closed RLS: no authenticated/anon policies or DML grants.

-- Composite identity for tenant-bound references to the existing canonical
-- integration and social scheduling registries.
create unique index if not exists atlas_integration_connections_org_id_unique
  on public.atlas_integration_connections(org_id, id);

create unique index if not exists atlas_social_scheduled_posts_org_id_unique
  on public.atlas_social_scheduled_posts(org_id, id);


alter table public.atlas_oauth_states
  add column if not exists flow_context jsonb not null default '{}'::jsonb,
  add column if not exists pkce_ciphertext text,
  add column if not exists pkce_iv text,
  add column if not exists pkce_key_version text;

do $atlas_pkce$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'atlas_oauth_states_pkce_bundle_check'
      and conrelid = 'public.atlas_oauth_states'::regclass
  ) then
    alter table public.atlas_oauth_states
      add constraint atlas_oauth_states_pkce_bundle_check check (
        (pkce_ciphertext is null and pkce_iv is null and pkce_key_version is null)
        or
        (pkce_ciphertext is not null and pkce_iv is not null and pkce_key_version is not null)
      );
  end if;
end
$atlas_pkce$;

create table if not exists public.atlas_youtube_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  channel_id text not null check (length(btrim(channel_id)) between 1 and 128),
  connection_id uuid not null,
  created_by uuid not null,
  title text not null check (length(btrim(title)) between 1 and 100),
  description text not null default '',
  media_bucket text not null check (length(btrim(media_bucket)) > 0),
  media_object_path text not null check (length(btrim(media_object_path)) > 0),
  media_sha256 text not null check (media_sha256 ~ '^[a-f0-9]{64}$'),
  media_status text not null default 'pending'
    check (media_status in ('pending', 'ready', 'rejected')),
  created_at timestamptz not null default now(),
  unique (org_id, channel_id, id),
  foreign key (org_id, connection_id)
    references public.atlas_integration_connections (org_id, id)
    on delete restrict
);

create table if not exists public.atlas_youtube_publication_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  channel_id text not null,
  connection_id uuid not null,
  draft_id uuid not null,
  social_post_id uuid not null,
  publication_key text not null check (length(btrim(publication_key)) between 1 and 256),
  status text not null default 'queued'
    check (status in ('queued', 'leased', 'published', 'blocked', 'failed')),
  scheduled_for timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  lease_owner text null,
  lease_expires_at timestamptz null,
  provider_video_id text null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, channel_id, publication_key),
  unique (org_id, channel_id, social_post_id),
  unique (org_id, channel_id, id),
  foreign key (org_id, connection_id)
    references public.atlas_integration_connections (org_id, id)
    on delete restrict,
  foreign key (org_id, channel_id, draft_id)
    references public.atlas_youtube_drafts (org_id, channel_id, id)
    on delete restrict,
  foreign key (org_id, social_post_id)
    references public.atlas_social_scheduled_posts (org_id, id)
    on delete restrict,
  check (
    (status = 'leased' and lease_owner is not null and lease_expires_at is not null)
    or (status <> 'leased' and lease_owner is null and lease_expires_at is null)
  ),
  check (status <> 'published' or provider_video_id is not null)
);

create index if not exists atlas_youtube_jobs_due_idx
  on public.atlas_youtube_publication_jobs(scheduled_for)
  where status = 'queued';
create index if not exists atlas_youtube_jobs_org_status_idx
  on public.atlas_youtube_publication_jobs(org_id, status, scheduled_for);

create table if not exists public.atlas_youtube_publication_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  channel_id text not null,
  job_id uuid not null,
  event_type text not null check (length(btrim(event_type)) between 1 and 80),
  actor_id uuid null,
  correlation_id uuid not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (org_id, channel_id, job_id)
    references public.atlas_youtube_publication_jobs(org_id, channel_id, id)
    on delete restrict
);
create index if not exists atlas_youtube_events_job_idx
  on public.atlas_youtube_publication_events(org_id, channel_id, job_id, created_at);

alter table public.atlas_youtube_drafts enable row level security;
alter table public.atlas_youtube_publication_jobs enable row level security;
alter table public.atlas_youtube_publication_events enable row level security;

alter table public.atlas_youtube_drafts force row level security;
alter table public.atlas_youtube_publication_jobs force row level security;
alter table public.atlas_youtube_publication_events force row level security;

revoke all on table public.atlas_youtube_drafts from public, anon, authenticated;
revoke all on table public.atlas_youtube_publication_jobs from public, anon, authenticated;
revoke all on table public.atlas_youtube_publication_events from public, anon, authenticated;

grant select, insert, update, delete on table public.atlas_youtube_drafts to service_role;
grant select, insert, update, delete on table public.atlas_youtube_publication_jobs to service_role;
grant select, insert on table public.atlas_youtube_publication_events to service_role;
