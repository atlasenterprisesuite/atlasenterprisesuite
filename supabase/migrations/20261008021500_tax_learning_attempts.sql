-- Educational progress only; never stores personal return data or confers a credential.
begin;
create table public.atlas_tax_learning_attempts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  course_version text not null check (course_version = '2025-v1'),
  lesson_id text not null check (lesson_id in ('intake', 'status', 'interest', 'itemized', 'receipts', 'se', 'depreciation', 'basis', 'capital', 'rental', 'farm', 'qbi', 'credits', 'partnership', 'scorp', 'ccorp', 'fiduciary', 'amended', 'efile', 'capstone')),
  correct_count integer not null,
  total_count integer not null check (total_count = case when lesson_id = 'se' then 3 else 2 end),
  created_at timestamptz not null default now(),
  check (correct_count >= 0 and correct_count <= total_count)
);
comment on table public.atlas_tax_learning_attempts is 'Self-reported educational exercise scores, scoped to user and organization. Not an exam certificate or taxpayer record.';
create index atlas_tax_learning_attempts_user_org_version_idx on public.atlas_tax_learning_attempts (user_id, org_id, course_version, lesson_id);
alter table public.atlas_tax_learning_attempts enable row level security;
revoke all on public.atlas_tax_learning_attempts from public, anon, authenticated;
grant select on public.atlas_tax_learning_attempts to authenticated;
grant insert (id, org_id, user_id, course_version, lesson_id, correct_count, total_count) on public.atlas_tax_learning_attempts to authenticated;
create policy atlas_tax_learning_read_own on public.atlas_tax_learning_attempts for select to authenticated
  using (user_id = (select auth.uid()) and public.is_org_member(org_id));
create policy atlas_tax_learning_insert_own on public.atlas_tax_learning_attempts for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_org_member(org_id));

create function public.atlas_tax_learning_progress(p_org_id uuid, p_course_version text)
returns table (lesson_id text, attempts bigint, best_percent integer, last_attempt timestamptz)
language sql stable security invoker set search_path = public
as $$
  select a.lesson_id, count(*), max(round(100.0 * a.correct_count / a.total_count))::integer, max(a.created_at)
  from public.atlas_tax_learning_attempts a
  where a.user_id = (select auth.uid()) and a.org_id = p_org_id and a.course_version = p_course_version
  group by a.lesson_id
$$;
revoke all on function public.atlas_tax_learning_progress(uuid,text) from public, anon;
grant execute on function public.atlas_tax_learning_progress(uuid,text) to authenticated;
commit;
