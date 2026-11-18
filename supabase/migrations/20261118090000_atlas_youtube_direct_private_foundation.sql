-- ATLAS YouTube Direct 777 — private, non-public foundation.
-- NO OAuth credentials or media bytes live in these tables. Never dispatch
-- directly from these rows; worker must revalidate provider authorization.
-- Deliberate fail-closed RLS: NO authenticated/anon policies or DML grants.

create table if not exists public.atlas_youtube_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  owner_user_id uuid not null,
  channel_id text not null check (length(btrim(channel_id)) between 1 and 128),
  status text not null default 'pending'
    check (status in ('pending', 'connected', 'revoked', 'failed')),
  -- A reference only, not plaintext/ciphertext tokens.
  vault_secret_name text null check (vault_secret_name is null or length(btrim(vault_secret_name)) > 0),
  granted_scopes text[] not null default '{}',
  consent_expires_at timestamptz null,
  connected_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, channel_id),
  unique (org_id, channel_id, id),
  check ((status <> 'connected') or (vault_secret_name is not null and consent_expires_at is not null)),
  check ((status <> 'revoked') or revoked_at is not null)
);

create table if not exists public.atlas_youtube_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  channel_id text not null,
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
  foreign key (org_id, channel_id, connection_id)
    references public.atlas_youtube_connections (org_id, channel_id, id)
    on delete restrict
);

create table if not exists public.atlas_youtube_publication_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  channel_id text not null,
  connection_id uuid not null,
  draft_id uuid not null,
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
  unique (org_id, channel_id, id),
  foreign key (org_id, channel_id, connection_id)
    references public.atlas_youtube_connections (org_id, channel_id, id)
    on delete restrict,
  foreign key (org_id, channel_id, draft_id)
    references public.atlas_youtube_drafts (org_id, channel_id, id)
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

alter table public.atlas_youtube_connections enable row level security;
alter table public.atlas_youtube_drafts enable row level security;
alter table public.atlas_youtube_publication_jobs enable row level security;
alter table public.atlas_youtube_publication_events enable row level security;

-- Prevent any future table-owner bypass by clients; service operations only.
alter table public.atlas_youtube_connections force row level security;
alter table public.atlas_youtube_drafts force row level security;
alter table public.atlas_youtube_publication_jobs force row level security;
alter table public.atlas_youtube_publication_events force row level security;

revoke all on table public.atlas_youtube_connections from public, anon, authenticated;
revoke all on table public.atlas_youtube_drafts from public, anon, authenticated;
revoke all on table public.atlas_youtube_publication_jobs from public, anon, authenticated;
revoke all on table public.atlas_youtube_publication_events from public, anon, authenticated;

-- Regrant only to trusted backend. No end-user/API access until reviewed RPC
-- functions enforce membership, channel ownership and role checks.
grant select, insert, update, delete on table public.atlas_youtube_connections to service_role;
grant select, insert, update, delete on table public.atlas_youtube_drafts to service_role;
grant select, insert, update, delete on table public.atlas_youtube_publication_jobs to service_role;
grant select, insert on table public.atlas_youtube_publication_events to service_role;
