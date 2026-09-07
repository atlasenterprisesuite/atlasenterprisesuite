-- Canonical definition for ATLAS Health + Learning neuroplasticity activity plans.
-- Applied to Supabase project atlas-core on 2026-09-07.

create table if not exists public.atlas_neuroplasticity_programs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  goal text not null check (goal in ('memory','focus','language','professional','motor')),
  minutes_per_day integer not null check (minutes_per_day between 15 and 120),
  experience_level text not null check (experience_level in ('beginner','intermediate','advanced')),
  sleep_hours numeric(3,1) not null check (sleep_hours between 0 and 24),
  exercise_days_per_week integer not null check (exercise_days_per_week between 0 and 7),
  professional_review_recommended boolean not null default false,
  completed_activity_ids text[] not null default '{}',
  program_start_date date not null default current_date,
  plan_version text not null default 'v1' check (plan_version = 'v1'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);

comment on table public.atlas_neuroplasticity_programs is
'ATLAS Health + Learning activity-plan persistence. Stores general wellbeing/learning preferences and completion state; not a clinical record.';

alter table public.atlas_neuroplasticity_programs enable row level security;
revoke all on table public.atlas_neuroplasticity_programs from anon;
grant select, insert, update, delete on table public.atlas_neuroplasticity_programs to authenticated;

create policy atlas_neuroplasticity_select_own
on public.atlas_neuroplasticity_programs for select to authenticated
using ((select auth.uid()) = user_id and public.is_org_member(org_id));

create policy atlas_neuroplasticity_insert_own
on public.atlas_neuroplasticity_programs for insert to authenticated
with check ((select auth.uid()) = user_id and public.is_org_member(org_id));

create policy atlas_neuroplasticity_update_own
on public.atlas_neuroplasticity_programs for update to authenticated
using ((select auth.uid()) = user_id and public.is_org_member(org_id))
with check ((select auth.uid()) = user_id and public.is_org_member(org_id));

create policy atlas_neuroplasticity_delete_own
on public.atlas_neuroplasticity_programs for delete to authenticated
using ((select auth.uid()) = user_id and public.is_org_member(org_id));

create index if not exists atlas_neuroplasticity_programs_user_org_idx
on public.atlas_neuroplasticity_programs (user_id, org_id);
