create table if not exists public.accounting_ai_insights (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  snapshot_hash text not null,
  model text not null,
  analysis text not null,
  response_id text,
  bill_count integer not null default 0,
  open_balance numeric not null default 0,
  snapshot_summary jsonb not null default '{}'::jsonb,
  generated_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists accounting_ai_insights_org_created_idx
  on public.accounting_ai_insights (org_id, created_at desc);

create index if not exists accounting_ai_insights_snapshot_idx
  on public.accounting_ai_insights (org_id, snapshot_hash, model, created_at desc);

alter table public.accounting_ai_insights enable row level security;

revoke all on public.accounting_ai_insights from anon;
revoke all on public.accounting_ai_insights from authenticated;
grant select on public.accounting_ai_insights to authenticated;

drop policy if exists accounting_ai_insights_read on public.accounting_ai_insights;
create policy accounting_ai_insights_read
  on public.accounting_ai_insights
  for select
  to authenticated
  using (public.is_org_member(org_id));
