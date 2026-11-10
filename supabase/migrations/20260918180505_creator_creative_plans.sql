create table if not exists public.creator_creative_plans (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null,
  title text not null default '',
  source_brief text not null default '',
  media_kinds text[] not null default '{}'::text[],
  plan_json jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_creative_plans_org_updated_idx
  on public.creator_creative_plans (organization_id, updated_at desc);

alter table public.creator_creative_plans enable row level security;

create policy creator_creative_plans_member_read
on public.creator_creative_plans
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.org_id = creator_creative_plans.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

revoke all on public.creator_creative_plans from authenticated;
grant select on public.creator_creative_plans to authenticated;
