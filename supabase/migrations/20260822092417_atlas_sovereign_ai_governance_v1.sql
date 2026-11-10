create table if not exists public.atlas_agent_tool_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  subject_type text not null check (subject_type in ('role','user','agent')),
  subject_ref text not null,
  tool_key text not null,
  action_key text not null default '*',
  effect text not null check (effect in ('allow','deny')),
  environment text not null default 'production' check (environment in ('development','staging','production')),
  enabled boolean not null default true,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,subject_type,subject_ref,tool_key,action_key,environment)
);
alter table public.atlas_agent_tool_policies enable row level security;
create policy atlas_agent_tool_policies_read on public.atlas_agent_tool_policies for select to authenticated using (public.has_org_role(org_id,array['owner','admin','manager']));
create policy atlas_agent_tool_policies_insert on public.atlas_agent_tool_policies for insert to authenticated with check (public.has_org_role(org_id,array['owner','admin']) and created_by=(select auth.uid()) and updated_by=(select auth.uid()));
create policy atlas_agent_tool_policies_update on public.atlas_agent_tool_policies for update to authenticated using (public.has_org_role(org_id,array['owner','admin'])) with check (public.has_org_role(org_id,array['owner','admin']) and updated_by=(select auth.uid()));
create policy atlas_agent_tool_policies_delete on public.atlas_agent_tool_policies for delete to authenticated using (public.has_org_role(org_id,array['owner','admin']));
create index if not exists atlas_agent_tool_policies_lookup_idx on public.atlas_agent_tool_policies(org_id,environment,subject_type,subject_ref,tool_key,action_key) where enabled;

create or replace function public.atlas_tool_allowed(p_org_id uuid,p_subject_type text,p_subject_ref text,p_tool_key text,p_action_key text default '*',p_environment text default 'production')
returns boolean language sql stable security invoker set search_path=public as $$
  with p as (
    select effect from public.atlas_agent_tool_policies
    where org_id=p_org_id and enabled and environment=p_environment
      and subject_type=p_subject_type and subject_ref=p_subject_ref
      and tool_key in (p_tool_key,'*') and action_key in (p_action_key,'*')
  )
  select case when exists(select 1 from p where effect='deny') then false
              when exists(select 1 from p where effect='allow') then true
              else false end;
$$;
revoke all on function public.atlas_tool_allowed(uuid,text,text,text,text,text) from public, anon;
grant execute on function public.atlas_tool_allowed(uuid,text,text,text,text,text) to authenticated, service_role;

create table if not exists public.atlas_ai_budgets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  scope_type text not null check (scope_type in ('organization','user','agent','team')),
  scope_ref text not null,
  period text not null check (period in ('day','month')),
  soft_limit_usd numeric(14,4) check (soft_limit_usd is null or soft_limit_usd >= 0),
  hard_limit_usd numeric(14,4) check (hard_limit_usd is null or hard_limit_usd >= 0),
  enabled boolean not null default true,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,scope_type,scope_ref,period)
);
alter table public.atlas_ai_budgets enable row level security;
create policy atlas_ai_budgets_read on public.atlas_ai_budgets for select to authenticated using (public.has_org_role(org_id,array['owner','admin','manager','accountant']));
create policy atlas_ai_budgets_insert on public.atlas_ai_budgets for insert to authenticated with check (public.has_org_role(org_id,array['owner','admin']) and created_by=(select auth.uid()) and updated_by=(select auth.uid()));
create policy atlas_ai_budgets_update on public.atlas_ai_budgets for update to authenticated using (public.has_org_role(org_id,array['owner','admin'])) with check (public.has_org_role(org_id,array['owner','admin']) and updated_by=(select auth.uid()));
create policy atlas_ai_budgets_delete on public.atlas_ai_budgets for delete to authenticated using (public.has_org_role(org_id,array['owner','admin']));

create table if not exists public.atlas_ai_usage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id),
  agent_ref text,
  model_id uuid references public.atlas_ai_models(id) on delete set null,
  task_class text not null,
  input_tokens integer not null default 0 check (input_tokens>=0),
  output_tokens integer not null default 0 check (output_tokens>=0),
  estimated_cost_usd numeric(14,6) not null default 0 check (estimated_cost_usd>=0),
  data_classification text not null default 'internal' check (data_classification in ('public','internal','confidential','restricted')),
  status text not null default 'completed' check (status in ('completed','failed','blocked')),
  trace_id uuid,
  created_at timestamptz not null default now()
);
alter table public.atlas_ai_usage enable row level security;
create policy atlas_ai_usage_read on public.atlas_ai_usage for select to authenticated using (public.has_org_role(org_id,array['owner','admin','manager','accountant']));
create policy atlas_ai_usage_insert on public.atlas_ai_usage for insert to authenticated with check (public.has_org_role(org_id,array['owner','admin','manager','accountant','staff']) and actor_id=(select auth.uid()));
create index if not exists atlas_ai_usage_org_time_idx on public.atlas_ai_usage(org_id,created_at desc);
create index if not exists atlas_ai_usage_actor_time_idx on public.atlas_ai_usage(org_id,actor_id,created_at desc);
create index if not exists atlas_ai_usage_model_idx on public.atlas_ai_usage(model_id);

create table if not exists public.atlas_ai_data_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  data_classification text not null check (data_classification in ('public','internal','confidential','restricted')),
  allow_external boolean not null default true,
  require_zero_retention boolean not null default false,
  require_local boolean not null default false,
  allowed_connector_kinds text[] not null default '{}',
  allowed_regions text[] not null default '{}',
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,data_classification)
);
alter table public.atlas_ai_data_policies enable row level security;
create policy atlas_ai_data_policies_read on public.atlas_ai_data_policies for select to authenticated using (public.has_org_role(org_id,array['owner','admin','manager']));
create policy atlas_ai_data_policies_insert on public.atlas_ai_data_policies for insert to authenticated with check (public.has_org_role(org_id,array['owner','admin']) and created_by=(select auth.uid()) and updated_by=(select auth.uid()));
create policy atlas_ai_data_policies_update on public.atlas_ai_data_policies for update to authenticated using (public.has_org_role(org_id,array['owner','admin'])) with check (public.has_org_role(org_id,array['owner','admin']) and updated_by=(select auth.uid()));
create policy atlas_ai_data_policies_delete on public.atlas_ai_data_policies for delete to authenticated using (public.has_org_role(org_id,array['owner','admin']));

alter table public.atlas_ai_models add column if not exists retention_mode text not null default 'unknown' check (retention_mode in ('unknown','standard','zero','local'));
alter table public.atlas_ai_models add column if not exists deployment_region text;
alter table public.atlas_ai_routes add column if not exists routing_strategy text not null default 'quality-first' check (routing_strategy in ('quality-first','cost-first','latency-first','privacy-first','local-only','critical-task'));
alter table public.atlas_ai_routes add column if not exists max_estimated_cost_usd numeric(14,6) check (max_estimated_cost_usd is null or max_estimated_cost_usd>=0);

create table if not exists public.atlas_feature_flag_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  snapshot_hash text not null,
  environment text not null check (environment in ('development','staging','production')),
  flags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(org_id,snapshot_hash)
);
alter table public.atlas_feature_flag_snapshots enable row level security;
create policy atlas_feature_flag_snapshots_read on public.atlas_feature_flag_snapshots for select to authenticated using (public.has_org_role(org_id,array['owner','admin','manager']));
create policy atlas_feature_flag_snapshots_insert on public.atlas_feature_flag_snapshots for insert to authenticated with check (public.has_org_role(org_id,array['owner','admin','manager','accountant','staff']));
create index if not exists atlas_feature_flag_snapshots_org_time_idx on public.atlas_feature_flag_snapshots(org_id,created_at desc);

alter table public.atlas_trace_spans add column if not exists conversation_id uuid;
alter table public.atlas_trace_spans add column if not exists agent_ref text;
alter table public.atlas_trace_spans add column if not exists tool_name text;
alter table public.atlas_trace_spans add column if not exists approval_state text check (approval_state is null or approval_state in ('not_required','pending','approved','denied'));
alter table public.atlas_trace_spans add column if not exists input_tokens integer check (input_tokens is null or input_tokens>=0);
alter table public.atlas_trace_spans add column if not exists output_tokens integer check (output_tokens is null or output_tokens>=0);
alter table public.atlas_trace_spans add column if not exists estimated_cost_usd numeric(14,6) check (estimated_cost_usd is null or estimated_cost_usd>=0);
alter table public.atlas_trace_spans add column if not exists feature_snapshot_hash text;
create index if not exists atlas_trace_spans_conversation_idx on public.atlas_trace_spans(org_id,conversation_id,occurred_at desc) where conversation_id is not null;
create index if not exists atlas_trace_spans_agent_idx on public.atlas_trace_spans(org_id,agent_ref,occurred_at desc) where agent_ref is not null;

create table if not exists public.atlas_eval_suites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  suite_key text not null,
  name text not null,
  module text not null,
  enabled boolean not null default true,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,suite_key)
);
alter table public.atlas_eval_suites enable row level security;
create policy atlas_eval_suites_read on public.atlas_eval_suites for select to authenticated using (public.has_org_role(org_id,array['owner','admin','manager']));
create policy atlas_eval_suites_write on public.atlas_eval_suites for all to authenticated using (public.has_org_role(org_id,array['owner','admin'])) with check (public.has_org_role(org_id,array['owner','admin']));

create table if not exists public.atlas_eval_cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  suite_id uuid not null references public.atlas_eval_suites(id) on delete cascade,
  case_key text not null,
  input_ref text,
  expected_properties jsonb not null default '{}'::jsonb,
  sensitivity text not null default 'internal' check (sensitivity in ('public','internal','confidential','restricted')),
  enabled boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(org_id,suite_id,case_key)
);
alter table public.atlas_eval_cases enable row level security;
create policy atlas_eval_cases_read on public.atlas_eval_cases for select to authenticated using (public.has_org_role(org_id,array['owner','admin','manager']));
create policy atlas_eval_cases_write on public.atlas_eval_cases for all to authenticated using (public.has_org_role(org_id,array['owner','admin'])) with check (public.has_org_role(org_id,array['owner','admin']));
create index if not exists atlas_eval_cases_suite_idx on public.atlas_eval_cases(suite_id);

create table if not exists public.atlas_eval_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  suite_id uuid not null references public.atlas_eval_suites(id) on delete cascade,
  model_id uuid references public.atlas_ai_models(id) on delete set null,
  release_ref text,
  status text not null default 'queued' check (status in ('queued','running','passed','failed','cancelled')),
  score numeric(8,4),
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.atlas_eval_runs enable row level security;
create policy atlas_eval_runs_read on public.atlas_eval_runs for select to authenticated using (public.has_org_role(org_id,array['owner','admin','manager']));
create policy atlas_eval_runs_write on public.atlas_eval_runs for all to authenticated using (public.has_org_role(org_id,array['owner','admin'])) with check (public.has_org_role(org_id,array['owner','admin']));
create index if not exists atlas_eval_runs_suite_idx on public.atlas_eval_runs(suite_id,created_at desc);
create index if not exists atlas_eval_runs_model_idx on public.atlas_eval_runs(model_id);

create table if not exists public.atlas_eval_scores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.atlas_eval_runs(id) on delete cascade,
  case_id uuid not null references public.atlas_eval_cases(id) on delete cascade,
  metric_key text not null,
  score numeric(8,4) not null,
  passed boolean not null,
  created_at timestamptz not null default now()
);
alter table public.atlas_eval_scores enable row level security;
create policy atlas_eval_scores_read on public.atlas_eval_scores for select to authenticated using (public.has_org_role(org_id,array['owner','admin','manager']));
create policy atlas_eval_scores_write on public.atlas_eval_scores for all to authenticated using (public.has_org_role(org_id,array['owner','admin'])) with check (public.has_org_role(org_id,array['owner','admin']));
create index if not exists atlas_eval_scores_run_idx on public.atlas_eval_scores(run_id);
create index if not exists atlas_eval_scores_case_idx on public.atlas_eval_scores(case_id);

create or replace function public.atlas_ai_budget_status(p_org_id uuid,p_scope_type text,p_scope_ref text)
returns table(period text,soft_limit_usd numeric,hard_limit_usd numeric,spent_usd numeric,soft_exceeded boolean,hard_exceeded boolean)
language sql stable security invoker set search_path=public as $$
  select b.period,b.soft_limit_usd,b.hard_limit_usd,
    coalesce(sum(u.estimated_cost_usd) filter (where u.created_at >= case when b.period='day' then date_trunc('day',now()) else date_trunc('month',now()) end),0)::numeric as spent_usd,
    case when b.soft_limit_usd is null then false else coalesce(sum(u.estimated_cost_usd) filter (where u.created_at >= case when b.period='day' then date_trunc('day',now()) else date_trunc('month',now()) end),0) >= b.soft_limit_usd end as soft_exceeded,
    case when b.hard_limit_usd is null then false else coalesce(sum(u.estimated_cost_usd) filter (where u.created_at >= case when b.period='day' then date_trunc('day',now()) else date_trunc('month',now()) end),0) >= b.hard_limit_usd end as hard_exceeded
  from public.atlas_ai_budgets b
  left join public.atlas_ai_usage u on u.org_id=b.org_id and ((b.scope_type='organization') or (b.scope_type='user' and u.actor_id::text=b.scope_ref) or (b.scope_type='agent' and u.agent_ref=b.scope_ref))
  where b.org_id=p_org_id and b.scope_type=p_scope_type and b.scope_ref=p_scope_ref and b.enabled
  group by b.period,b.soft_limit_usd,b.hard_limit_usd;
$$;
revoke all on function public.atlas_ai_budget_status(uuid,text,text) from public,anon;
grant execute on function public.atlas_ai_budget_status(uuid,text,text) to authenticated,service_role;
