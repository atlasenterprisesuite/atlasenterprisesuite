create table if not exists public.creator_web_launch_blueprints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  created_by uuid not null,
  title text not null,
  state_json jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_web_launch_blueprints_org_updated_idx
  on public.creator_web_launch_blueprints (organization_id, updated_at desc);

alter table public.creator_web_launch_blueprints enable row level security;

revoke all on public.creator_web_launch_blueprints from anon, authenticated;
